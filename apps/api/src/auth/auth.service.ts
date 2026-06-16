import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import type {
  AuthTokensResponse,
  AuthUserResponse,
  LoginRequest,
  LogoutRequest,
  PendingWarning,
  PlayerProfileResponse,
  RefreshRequest,
  RegisterRequest,
  Role,
  UpdatePlayerProfileRequest
} from "@gamedash/contracts";
import type { AuthenticatedUser } from "./auth.types";
import { PrismaService } from "../prisma/prisma.service";

interface AccessPayload {
  sub: string;
  email: string;
  role: Role;
  exp: number;
}

@Injectable()
export class AuthService {
  private readonly accessTtlSeconds = 15 * 60;
  private readonly refreshTtlSeconds = 30 * 24 * 60 * 60;
  private readonly accessSecret =
    process.env.JWT_ACCESS_SECRET ?? "local-dev-access-secret-change-me";

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async register(body: RegisterRequest): Promise<AuthTokensResponse> {
    const email = this.normalizeEmail(body.email);
    this.assertPassword(body.password);
    const pseudo = this.assertText(body.pseudo, "pseudo");

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException("Email already registered.");

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: this.hashPassword(body.password),
        role: "PLAYER",
        profile: {
          create: {
            pseudo,
            avatarUrl: normalizeOptional(body.avatarUrl),
            region: normalizeOptional(body.region),
            bio: normalizeOptional(body.bio)
          }
        }
      },
      include: { profile: true }
    });

    await this.audit(user.id, "auth.register", "user", user.id, { role: user.role });
    return this.issueTokenPair(user);
  }

  async login(body: LoginRequest): Promise<AuthTokensResponse> {
    const email = this.normalizeEmail(body.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true }
    });

    if (!user || !this.verifyPassword(body.password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    await this.assertNotSanctioned(user.id);

    await this.audit(user.id, "auth.login", "user", user.id);
    return this.issueTokenPair(user);
  }

  async refresh(body: RefreshRequest): Promise<AuthTokensResponse> {
    const tokenHash = this.hashToken(body.refreshToken);
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { profile: true } } }
    });

    if (!token || token.revokedAt || token.expiresAt <= new Date()) {
      throw new UnauthorizedException("Refresh token is invalid or expired.");
    }

    await this.assertNotSanctioned(token.userId);

    await this.prisma.refreshToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() }
    });

    await this.audit(token.userId, "auth.refresh", "refresh_token", token.id);
    return this.issueTokenPair(token.user);
  }

  async logout(body: LogoutRequest, actor: AuthenticatedUser): Promise<void> {
    const tokenHash = this.hashToken(body.refreshToken);
    const token = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!token || token.userId !== actor.id || token.revokedAt) {
      throw new UnauthorizedException("Refresh token is invalid.");
    }

    await this.prisma.refreshToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() }
    });
    await this.audit(actor.id, "auth.logout", "refresh_token", token.id);
  }

  /** Stays sync — JWT verification never needs DB (stateless design). */
  verifyAccessToken(accessToken: string): AuthenticatedUser {
    const parts = accessToken.split(".");
    if (parts.length !== 3) throw new UnauthorizedException("Malformed access token.");

    const [encodedHeader, encodedPayload, signature] = parts as [string, string, string];
    const expectedSignature = this.sign(`${encodedHeader}.${encodedPayload}`);

    if (!safeEqual(signature, expectedSignature)) {
      throw new UnauthorizedException("Invalid access token signature.");
    }

    const payload = JSON.parse(fromBase64Url(encodedPayload)) as AccessPayload;
    if (!payload.sub || !payload.email || !payload.role || payload.exp <= nowSeconds()) {
      throw new UnauthorizedException("Access token is invalid or expired.");
    }

    return { id: payload.sub, email: payload.email, role: payload.role };
  }

  async getCurrentUser(actor: AuthenticatedUser): Promise<AuthUserResponse> {
    const user = await this.requireUser(actor.id);
    return this.toAuthUser(user);
  }

  async getProfile(actor: AuthenticatedUser): Promise<PlayerProfileResponse> {
    const user = await this.requireUser(actor.id);
    return this.toProfile(user);
  }

  async updateProfile(
    actor: AuthenticatedUser,
    body: UpdatePlayerProfileRequest
  ): Promise<PlayerProfileResponse> {
    const user = await this.requireUser(actor.id);
    const current = user.profile!;

    const updated = await this.prisma.playerProfile.update({
      where: { userId: actor.id },
      data: {
        pseudo: body.pseudo ? this.assertText(body.pseudo, "pseudo") : current.pseudo,
        avatarUrl: body.avatarUrl === undefined ? current.avatarUrl : normalizeOptional(body.avatarUrl),
        region: body.region === undefined ? current.region : normalizeOptional(body.region),
        bio: body.bio === undefined ? current.bio : normalizeOptional(body.bio)
      }
    });

    await this.audit(actor.id, "profile.update", "user", actor.id);
    return {
      userId: actor.id,
      pseudo: updated.pseudo,
      avatarUrl: updated.avatarUrl ?? undefined,
      region: updated.region ?? undefined,
      bio: updated.bio ?? undefined
    };
  }

  /** Used by AuthGuard on every request to block sanctioned users immediately. */
  async checkActiveSanction(userId: string): Promise<void> {
    return this.assertNotSanctioned(userId);
  }

  async getPendingWarnings(userId: string): Promise<PendingWarning[]> {
    const warns = await this.prisma.moderationHistory.findMany({
      where: {
        targetType: "account",
        targetId: userId,
        action: "account.warn",
        acknowledgedAt: null
      },
      orderBy: { createdAt: "asc" }
    });
    return warns.map((w) => ({
      id: w.id,
      reason: w.reason,
      actorId: w.actorId,
      createdAt: w.createdAt.toISOString()
    }));
  }

  async acknowledgeWarning(userId: string, warningId: string): Promise<void> {
    const warn = await this.prisma.moderationHistory.findFirst({
      where: { id: warningId, targetId: userId, targetType: "account", action: "account.warn" }
    });
    if (!warn) throw new NotFoundException("Warning not found.");
    if (warn.acknowledgedAt) return;
    await this.prisma.moderationHistory.update({
      where: { id: warningId },
      data: { acknowledgedAt: new Date() }
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async assertNotSanctioned(userId: string): Promise<void> {
    const sanction = await this.prisma.sanction.findFirst({
      where: {
        userId,
        status: "active",
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }]
      }
    });
    if (!sanction) return;

    const type = sanction.type === "BAN" ? "banned" : "suspended";
    const until = sanction.endsAt
      ? ` until ${sanction.endsAt.toISOString()}`
      : " permanently";
    throw new ForbiddenException(`Account ${type}${until}. Reason: ${sanction.reason}`);
  }

  private async issueTokenPair(
    user: { id: string; email: string; role: string; profile: { pseudo: string; avatarUrl: string | null; region: string | null; bio: string | null } | null }
  ): Promise<AuthTokensResponse> {
    const role = user.role.toLowerCase() as Role;
    const accessToken = this.createAccessToken(user.id, user.email, role);
    const rawRefresh = `gd_rt_${randomBytes(32).toString("base64url")}`;

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(rawRefresh),
        expiresAt: new Date(Date.now() + this.refreshTtlSeconds * 1000)
      }
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      role,
      user: this.toAuthUser(user)
    };
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    role: string;
    profile: { pseudo: string; avatarUrl: string | null; region: string | null; bio: string | null } | null;
  }): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      role: user.role.toLowerCase() as Role,
      profile: this.toProfile(user)
    };
  }

  private toProfile(user: {
    id: string;
    profile: { pseudo: string; avatarUrl: string | null; region: string | null; bio: string | null } | null;
  }): PlayerProfileResponse {
    const p = user.profile;
    return {
      userId: user.id,
      pseudo: p?.pseudo ?? "",
      avatarUrl: p?.avatarUrl ?? undefined,
      region: p?.region ?? undefined,
      bio: p?.bio ?? undefined
    };
  }

  private async requireUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });
    if (!user) throw new UnauthorizedException("User no longer exists.");
    return user;
  }

  private createAccessToken(userId: string, email: string, role: Role): string {
    const encodedHeader = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const encodedPayload = toBase64Url(
      JSON.stringify({
        sub: userId,
        email,
        role,
        exp: nowSeconds() + this.accessTtlSeconds
      } satisfies AccessPayload)
    );
    const unsigned = `${encodedHeader}.${encodedPayload}`;
    return `${unsigned}.${this.sign(unsigned)}`;
  }

  private sign(value: string): string {
    return createHmac("sha256", this.accessSecret).update(value).digest("base64url");
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString("base64url");
    const derived = pbkdf2Sync(password, salt, 120_000, 64, "sha512").toString("base64url");
    return `pbkdf2_sha512$120000$${salt}$${derived}`;
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    const [algorithm, iterationsRaw, salt, expected] = storedHash.split("$");
    if (algorithm !== "pbkdf2_sha512" || !iterationsRaw || !salt || !expected) return false;
    const actual = pbkdf2Sync(password, salt, Number(iterationsRaw), 64, "sha512").toString("base64url");
    return safeEqual(actual, expected);
  }

  private hashToken(token: string): string {
    return createHmac("sha256", this.accessSecret).update(token).digest("hex");
  }

  private normalizeEmail(email: string): string {
    const normalized = normalizeOptional(email)?.toLowerCase();
    if (!normalized || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
      throw new BadRequestException("A valid email is required.");
    }
    return normalized;
  }

  private assertPassword(password: string): void {
    if (typeof password !== "string" || password.length < 8) {
      throw new BadRequestException("Password must contain at least 8 characters.");
    }
  }

  private assertText(value: string, field: string): string {
    const normalized = normalizeOptional(value);
    if (!normalized) throw new BadRequestException(`${field} is required.`);
    return normalized;
  }

  private async audit(
    actorId: string,
    action: string,
    targetType: string,
    targetId?: string,
    metadata?: Record<string, string | number | boolean | null>
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { actorId, action, targetType, targetId, metadata: metadata as never }
    });
  }
}

// ─── Pure helpers ──────────────────────────────────────────────────────────

function normalizeOptional(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEqual(actual: string, expected: string): boolean {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
