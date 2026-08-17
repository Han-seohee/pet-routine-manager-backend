import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-kakao';
import type { User } from '../../generated/prisma/client';
import { AuthService } from './auth.service';
import type { OAuthLoginDto } from './dto/oauth-login.dto';
import type { KakaoUserProfile } from './types/kakao-user-profile.type';

@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, 'kakao') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const port = configService.get<number>('PORT', 3001);

    super({
      clientID: configService.getOrThrow<string>('KAKAO_CLIENT_ID'),
      callbackURL: `http://localhost:${port}/auth/kakao/callback`,
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<User> {
    const oauthProfile = this.toOAuthLoginDto(profile);

    return this.authService.findOrCreateUser(oauthProfile);
  }

  private toOAuthLoginDto(profile: Profile): OAuthLoginDto {
    const json = profile._json as KakaoUserProfile;
    const kakaoAccountProfile = json.kakao_account?.profile;

    return {
      provider: 'KAKAO',
      providerId: String(json.id ?? profile.id),
      email: null,
      displayName:
        kakaoAccountProfile?.nickname ??
        profile.displayName ??
        json.properties?.nickname ??
        null,
      profileImage:
        kakaoAccountProfile?.profile_image_url ??
        json.properties?.profile_image ??
        null,
    };
  }
}
