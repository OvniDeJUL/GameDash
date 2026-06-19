import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import type {
  CreateMapRequest,
  CreateMapVersionRequest,
  CreatorMapStatsResponse,
  FavoriteMapRequest,
  MapDetailResponse,
  MapInteractionResponse,
  MapStatsResponse,
  MapStatus,
  MapSummary,
  MapVersionResponse,
  ReportMapRequest,
  TestMapRequest,
  VoteMapRequest
} from "@gamedash/contracts";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

const MAP_STATUSES: MapStatus[] = ["draft", "beta", "stable", "hidden"];
const MAX_TAGS = 8;

@Injectable()
export class MapsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listMaps(query: {
    q?: string;
    tag?: string;
    status?: MapStatus;
    creatorId?: string;
  } = {}, actor?: { id: string; role: string }): Promise<MapSummary[]> {
    const isPrivileged = actor?.role === "admin" || actor?.role === "staff";
    const isOwnMaps = query.creatorId && actor && query.creatorId === actor.id;
    const bypassReview = isPrivileged || isOwnMaps;

    const maps = await this.prisma.gameMap.findMany({
      where: {
        status: query.status
          ? (query.status.toUpperCase() as "DRAFT" | "BETA" | "STABLE" | "HIDDEN")
          : { not: "HIDDEN" },
        creatorId: query.creatorId ?? undefined,
        ...(!bypassReview ? { reviewStatus: { in: ["approved", "featured"] } } : {}),
        ...(query.tag ? { tags: { has: query.tag.toLowerCase() } } : {}),
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: "insensitive" } },
                { description: { contains: query.q, mode: "insensitive" } }
              ]
            }
          : {})
      },
      include: {
        versions: { orderBy: { createdAt: "desc" }, take: 1 },
        votes: true,
        tests: true,
        favorites: true,
        creator: { include: { profile: true } }
      },
      orderBy: [{ popularityScore: "desc" }, { updatedAt: "desc" }]
    });

    return maps.map((m) => this.toSummary(m));
  }

  async createMap(actor: AuthenticatedUser, body: CreateMapRequest): Promise<MapSummary> {
    const status = this.assertStatus(body.status);
    const tags = this.normalizeTags(body.tags ?? []);
    const now = new Date();

    const map = await this.prisma.gameMap.create({
      data: {
        id: randomUUID(),
        creatorId: actor.id,
        title: this.assertText(body.title, "Map title"),
        description: this.assertText(body.description, "Map description"),
        tags,
        screenshots: body.screenshots ?? [],
        status: status.toUpperCase() as "DRAFT" | "BETA" | "STABLE" | "HIDDEN",
        popularityScore: 0,
        createdAt: now,
        updatedAt: now
      },
      include: { versions: true, votes: true, tests: true, favorites: true }
    });

    await this.audit(actor.id, this.isPublished(status) ? "map.publish" : "map.create", "map", map.id, { status, tags });
    return this.toSummary(map);
  }

  async getMap(mapId: string): Promise<MapDetailResponse> {
    const map = await this.requireMap(mapId);
    return {
      ...this.toSummary(map),
      versions: map.versions.map((v) => this.toVersion(v))
    };
  }

  async createVersion(
    actor: AuthenticatedUser,
    mapId: string,
    body: CreateMapVersionRequest
  ): Promise<MapVersionResponse> {
    const map = await this.requireMap(mapId);
    this.assertCreator(actor, map);

    const labelExists = map.versions.some((v) => v.versionLabel === body.versionLabel);
    if (labelExists) throw new BadRequestException("Map version label already exists.");

    const now = new Date();
    const [version] = await Promise.all([
      this.prisma.mapVersion.create({
        data: {
          mapId,
          versionLabel: this.assertText(body.versionLabel, "Version label"),
          releaseNotes: this.assertText(body.releaseNotes, "Release notes"),
          createdAt: now
        }
      }),
      this.recalculatePopularity(mapId, now)
    ]);

    await this.audit(actor.id, "map.update", "map", mapId, { versionLabel: body.versionLabel });
    return this.toVersion(version);
  }

  async voteMap(actor: AuthenticatedUser, mapId: string, body: VoteMapRequest): Promise<MapInteractionResponse> {
    if (body.value !== 1 && body.value !== -1) {
      throw new BadRequestException("Vote value must be 1 or -1.");
    }
    await this.requireMap(mapId);

    await this.prisma.mapVote.upsert({
      where: { mapId_userId: { mapId, userId: actor.id } },
      create: { mapId, userId: actor.id, value: body.value },
      update: { value: body.value }
    });

    await this.recalculatePopularity(mapId);
    const updated = await this.requireMap(mapId);
    return { accepted: true, map: this.toSummary(updated) };
  }

  async testMap(actor: AuthenticatedUser, mapId: string, body: TestMapRequest): Promise<MapInteractionResponse> {
    await this.requireMap(mapId);

    await this.prisma.mapTest.upsert({
      where: { mapId_userId: { mapId, userId: actor.id } },
      create: { mapId, userId: actor.id, completed: body.completed },
      update: { completed: body.completed }
    });

    if (!body.completed) {
      const existing = await this.prisma.mapReport.findFirst({
        where: { mapId, reporterId: actor.id, status: "open" }
      });
      if (!existing) {
        await Promise.all([
          this.prisma.mapReport.create({
            data: { mapId, reporterId: actor.id, reason: "Flagged as not deployable during test review", status: "open" }
          }),
          this.prisma.gameMap.update({ where: { id: mapId }, data: { reportCount: { increment: 1 } } })
        ]);
      }
    }

    await this.recalculatePopularity(mapId);
    const updated = await this.requireMap(mapId);
    return { accepted: true, map: this.toSummary(updated) };
  }

  async favoriteMap(actor: AuthenticatedUser, mapId: string, body: FavoriteMapRequest): Promise<MapInteractionResponse> {
    await this.requireMap(mapId);

    if (body.favorited) {
      await this.prisma.mapFavorite.upsert({
        where: { mapId_userId: { mapId, userId: actor.id } },
        create: { mapId, userId: actor.id },
        update: {}
      });
    } else {
      await this.prisma.mapFavorite.deleteMany({ where: { mapId, userId: actor.id } });
    }

    await this.recalculatePopularity(mapId);
    const updated = await this.requireMap(mapId);
    return { accepted: true, map: this.toSummary(updated) };
  }

  async getMapStats(mapId: string): Promise<MapStatsResponse> {
    const map = await this.requireMap(mapId);
    return this.calculateStats(map);
  }

  async reportMap(actor: AuthenticatedUser, mapId: string, body: ReportMapRequest): Promise<MapInteractionResponse> {
    const map = await this.requireMap(mapId);
    const reason = this.assertText(body.reason, "Report reason");

    const existing = await this.prisma.mapReport.findFirst({
      where: { mapId, reporterId: actor.id, status: "open" }
    });
    if (existing) throw new BadRequestException("You already have an open report for this map.");

    await Promise.all([
      this.prisma.mapReport.create({ data: { mapId, reporterId: actor.id, reason, status: "open" } }),
      this.prisma.gameMap.update({ where: { id: mapId }, data: { reportCount: { increment: 1 } } })
    ]);

    await this.audit(actor.id, "map.report", "map", mapId, { reason });
    const updated = await this.requireMap(mapId);
    return { accepted: true, map: this.toSummary(updated) };
  }

  async getCreatorStats(creatorId: string): Promise<CreatorMapStatsResponse> {
    const maps = await this.prisma.gameMap.findMany({
      where: { creatorId },
      include: { versions: true, votes: true, tests: true, favorites: true }
    });

    const stats = maps.map((m) => this.calculateStats(m));
    const totalVotes = stats.reduce((s, x) => s + x.upvotes + x.downvotes, 0);
    const totalTests = stats.reduce((s, x) => s + x.completedTests, 0);
    const totalFavorites = stats.reduce((s, x) => s + x.favorites, 0);
    const avgScore = maps.length === 0 ? 0 : Number((maps.reduce((s, m) => s + m.popularityScore, 0) / maps.length).toFixed(2));

    return {
      creatorId,
      totalMaps: maps.length,
      publishedMaps: maps.filter((m) => m.status === "BETA" || m.status === "STABLE").length,
      totalVotes,
      totalTests,
      totalFavorites,
      averagePopularityScore: avgScore
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async requireMap(mapId: string) {
    const map = await this.prisma.gameMap.findUnique({
      where: { id: mapId },
      include: {
        versions: { orderBy: { createdAt: "desc" } },
        votes: true,
        tests: true,
        favorites: true,
        creator: { include: { profile: true } }
      }
    });
    if (!map) throw new NotFoundException("Map not found.");
    return map;
  }

  private assertCreator(actor: AuthenticatedUser, map: { creatorId: string }): void {
    if (map.creatorId === actor.id || actor.role === "admin" || actor.role === "staff") return;
    throw new BadRequestException("Only the creator or studio staff can update this map.");
  }

  private async recalculatePopularity(mapId: string, updatedAt?: Date): Promise<void> {
    const map = await this.requireMap(mapId);
    const stats = this.calculateStats(map);
    await this.prisma.gameMap.update({
      where: { id: mapId },
      data: { popularityScore: stats.popularityScore, updatedAt: updatedAt ?? new Date() }
    });
  }

  private calculateStats(map: {
    id: string;
    popularityScore: number;
    updatedAt: Date;
    versions: { id: string }[];
    votes: { value: number }[];
    tests: { completed: boolean }[];
    favorites: { id: string }[];
  }): MapStatsResponse {
    const upvotes = map.votes.filter((v) => v.value === 1).length;
    const downvotes = map.votes.filter((v) => v.value === -1).length;
    const completedTests = map.tests.filter((t) => t.completed).length;
    const failedTests = map.tests.filter((t) => !t.completed).length;
    const favorites = map.favorites.length;
    const versionCount = map.versions.length;
    const ageDays = Math.max(0, Math.floor((Date.now() - map.updatedAt.getTime()) / (1000 * 60 * 60 * 24)));
    const recencyBoost = Math.max(0, 10 - ageDays);
    const voteScore = upvotes - downvotes;
    const popularityScore = Math.max(0, Number((voteScore * 10 + completedTests * 100 - failedTests * 10 + favorites * 3 + versionCount * 2 + recencyBoost).toFixed(2)));

    return { mapId: map.id, versionCount, voteScore, upvotes, downvotes, completedTests, favorites, popularityScore };
  }

  private toSummary(map: {
    id: string;
    creatorId: string;
    title: string;
    description: string;
    tags: string[];
    screenshots: string[];
    status: string;
    reviewStatus: string;
    popularityScore: number;
    createdAt: Date;
    updatedAt: Date;
    versions: { id: string; versionLabel: string }[];
    votes: { value: number }[];
    tests: { completed: boolean }[];
    favorites: { id: string }[];
    creator?: { profile: { pseudo: string } | null } | null;
  }): MapSummary {
    return {
      id: map.id,
      creatorId: map.creatorId,
      creatorPseudo: map.creator?.profile?.pseudo,
      title: map.title,
      description: map.description,
      tags: map.tags,
      screenshots: map.screenshots,
      status: map.status.toLowerCase() as MapStatus,
      reviewStatus: map.reviewStatus,
      popularityScore: map.popularityScore,
      latestVersionLabel: map.versions[0]?.versionLabel,
      createdAt: map.createdAt.toISOString(),
      updatedAt: map.updatedAt.toISOString(),
      stats: this.calculateStats(map)
    };
  }

  private toVersion(v: { id: string; mapId: string; versionLabel: string; releaseNotes: string; createdAt: Date }): MapVersionResponse {
    return { id: v.id, mapId: v.mapId, versionLabel: v.versionLabel, releaseNotes: v.releaseNotes, createdAt: v.createdAt.toISOString() };
  }

  private assertStatus(status: MapStatus): MapStatus {
    if (!MAP_STATUSES.includes(status)) throw new BadRequestException("Unsupported map status.");
    return status;
  }

  private isPublished(status: MapStatus): boolean {
    return status === "beta" || status === "stable";
  }

  private assertText(value: string, label: string): string {
    const trimmed = value.trim();
    if (!trimmed) throw new BadRequestException(`${label} is required.`);
    return trimmed;
  }

  private normalizeTags(tags: string[]): string[] {
    const normalized = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
    if (normalized.length > MAX_TAGS) throw new BadRequestException(`A map can have at most ${MAX_TAGS} tags.`);
    return normalized;
  }

  private async audit(
    actorId: string,
    action: string,
    targetType: string,
    targetId?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.prisma.auditLog.create({ data: { actorId, action, targetType, targetId, metadata: metadata as never } });
  }
}
