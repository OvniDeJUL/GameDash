import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseGuards
} from "@nestjs/common";
import type {
  AuthTokensResponse,
  AuthUserResponse,
  LoginRequest,
  LogoutRequest,
  RefreshRequest,
  RegisterRequest
} from "@gamedash/contracts";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import type { AuthenticatedUser } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  @Post("register")
  register(@Body() body: RegisterRequest): Promise<AuthTokensResponse> {
    return this.authService.register(body);
  }

  @Post("login")
  login(@Body() body: LoginRequest): Promise<AuthTokensResponse> {
    return this.authService.login(body);
  }

  @Post("refresh")
  refresh(@Body() body: RefreshRequest): Promise<AuthTokensResponse> {
    return this.authService.refresh(body);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthUserResponse> {
    return this.authService.getCurrentUser(user);
  }

  @Post("logout")
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() body: LogoutRequest, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.authService.logout(body, user);
  }
}
