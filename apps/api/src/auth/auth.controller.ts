import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  UseGuards,
  SetMetadata,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthGuard } from "../iam/auth.guard";
import { Request } from "express";

// Decorator to bypass AuthGuard
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  async register(@Body() body: any) {
    // In Phase 2 this will use Zod Validation Pipe
    return this.authService.register(
      body.tenantId,
      body.email,
      body.password,
      body.firstName,
      body.lastName,
    );
  }

  @Public()
  @Post("login")
  async login(@Body() body: any) {
    return this.authService.login(body.tenantId, body.email, body.password);
  }

  @Public()
  @Post("refresh")
  async refresh(@Body() body: any) {
    return this.authService.refresh(body.refreshToken);
  }

  @UseGuards(AuthGuard)
  @Post("logout")
  async logout(@Req() req: Request) {
    // For JWT, true invalidation requires a token blacklist or Redis store.
    // For Phase 1.5, we return success to clear the client-side state.
    // A redis blacklist mechanism would be added here.
    return { success: true };
  }

  @UseGuards(AuthGuard)
  @Get("me")
  async getMe(@Req() req: Request) {
    const user = (req as any).user;
    return this.authService.getMe(user.sub);
  }
}
