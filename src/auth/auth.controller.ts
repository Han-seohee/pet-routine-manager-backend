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
import type { OAuthLoginDto } from './dto/oauth-login.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';

type AuthenticatedRequest = Request & { user: User };

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
    @Req() req: AuthenticatedRequest,
  ): { user: User } {
    return { user: req.user };
  }
}
