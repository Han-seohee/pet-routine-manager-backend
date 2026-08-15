import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import type { User } from '../../generated/prisma/client';
import { AuthService } from './auth.service';
import type { OAuthLoginDto } from './dto/oauth-login.dto';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const port = configService.get<number>('PORT', 3001);

    super({
      clientID: configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: `http://localhost:${port}/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<User> {
    const oauthProfile: OAuthLoginDto = {
      provider: 'GOOGLE',
      providerId: profile.id,
      email: profile.emails?.[0]?.value ?? null,
      displayName: profile.displayName ?? null,
      profileImage: profile.photos?.[0]?.value ?? null,
    };

    return this.authService.findOrCreateUser(oauthProfile);
  }
}
