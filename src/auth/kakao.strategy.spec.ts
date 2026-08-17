jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { Profile } from 'passport-kakao';
import { AuthService } from './auth.service';
import { KakaoStrategy } from './kakao.strategy';
import type { KakaoUserProfile } from './types/kakao-user-profile.type';

describe('KakaoStrategy', () => {
  let kakaoStrategy: KakaoStrategy;
  let authService: { findOrCreateUser: jest.Mock };

  const user = {
    id: 'user-id',
    provider: 'KAKAO' as const,
    providerId: 'kakao-user-id',
    email: null,
    displayName: 'Test User',
    profileImage: 'https://example.com/profile.png',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const kakaoProfile = {
    id: 'kakao-user-id',
    provider: 'kakao',
    displayName: 'Test User',
    _json: {
      id: 1234567890,
      kakao_account: {
        profile: {
          nickname: 'Test User',
          profile_image_url: 'https://example.com/profile.png',
        },
      },
    } satisfies KakaoUserProfile,
  } as Profile;

  beforeEach(async () => {
    authService = {
      findOrCreateUser: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        KakaoStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'PORT') {
                return 3001;
              }

              return defaultValue;
            }),
            getOrThrow: jest.fn((key: string) => {
              if (key === 'KAKAO_CLIENT_ID') {
                return 'test-kakao-client-id';
              }

              throw new Error(`Missing config: ${key}`);
            }),
          },
        },
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    kakaoStrategy = app.get<KakaoStrategy>(KakaoStrategy);
  });

  describe('validate', () => {
    it('should map Kakao profile to OAuthLoginDto and call findOrCreateUser', async () => {
      authService.findOrCreateUser.mockResolvedValue(user);

      await expect(
        kakaoStrategy.validate('access-token', 'refresh-token', kakaoProfile),
      ).resolves.toEqual(user);
      expect(authService.findOrCreateUser).toHaveBeenCalledWith({
        provider: 'KAKAO',
        providerId: '1234567890',
        email: null,
        displayName: 'Test User',
        profileImage: 'https://example.com/profile.png',
      });
    });

    it('should handle missing optional profile fields', async () => {
      authService.findOrCreateUser.mockResolvedValue(user);

      const minimalProfile = {
        id: '9876543210',
        provider: 'kakao',
        _json: {
          id: 9876543210,
        } satisfies KakaoUserProfile,
      } as Profile;

      await kakaoStrategy.validate(
        'access-token',
        'refresh-token',
        minimalProfile,
      );

      expect(authService.findOrCreateUser).toHaveBeenCalledWith({
        provider: 'KAKAO',
        providerId: '9876543210',
        email: null,
        displayName: null,
        profileImage: null,
      });
    });
  });
});
