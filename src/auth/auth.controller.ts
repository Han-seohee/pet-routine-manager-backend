import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../../generated/prisma/client';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './dto/jwt-payload.dto';
import type { OAuthLoginDto } from './dto/oauth-login.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { KakaoAuthGuard } from './guards/kakao-auth.guard';

type GoogleAuthenticatedRequest = Request & { user: User };
type KakaoAuthenticatedRequest = Request & { user: User };
type JwtAuthenticatedRequest = Request & { user: AuthenticatedUser };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('oauth/login')
  async oauthLogin(
    @Body() body: OAuthLoginDto,
  ): Promise<{ user: User }> {
    const user = await this.authService.findOrCreateUser(body);

    return { user };
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth(): void {
    // Passport redirects to Google OAuth.
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleAuthCallback(
    @Req() req: GoogleAuthenticatedRequest,
  ): { user: User; accessToken: string } {
    const accessToken = this.authService.signAccessToken(req.user);

    return { user: req.user, accessToken };
  }

  @Get('kakao')
  @UseGuards(KakaoAuthGuard)
  kakaoAuth(): void {
    // Passport redirects to Kakao OAuth.
  }

  @Get('kakao/callback')
  @UseGuards(KakaoAuthGuard)
  kakaoAuthCallback(
    @Req() req: KakaoAuthenticatedRequest,
  ): { user: User; accessToken: string } {
    const accessToken = this.authService.signAccessToken(req.user);

    return { user: req.user, accessToken };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: JwtAuthenticatedRequest): AuthenticatedUser {
    return req.user;
  }
}
