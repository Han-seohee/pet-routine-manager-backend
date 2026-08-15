jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { Profile } from 'passport-google-oauth20';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';

describe('GoogleStrategy', () => {
  let googleStrategy: GoogleStrategy;
  let authService: { findOrCreateUser: jest.Mock };

  const user = {
    id: 'user-id',
    provider: 'GOOGLE' as const,
    providerId: 'google-123',
    email: 'user@example.com',
    displayName: 'Test User',
    profileImage: 'https://example.com/avatar.png',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const googleProfile = {
    id: 'google-123',
    displayName: 'Test User',
    emails: [{ value: 'user@example.com' }],
    photos: [{ value: 'https://example.com/avatar.png' }],
  } as Profile;

  beforeEach(async () => {
    authService = {
      findOrCreateUser: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleStrategy,
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
              if (key === 'GOOGLE_CLIENT_ID') {
                return 'test-client-id';
              }

              if (key === 'GOOGLE_CLIENT_SECRET') {
                return 'test-client-secret';
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

    googleStrategy = app.get<GoogleStrategy>(GoogleStrategy);
  });

  describe('validate', () => {
    it('should map Google profile and call findOrCreateUser', async () => {
      authService.findOrCreateUser.mockResolvedValue(user);

      await expect(
        googleStrategy.validate('access-token', 'refresh-token', googleProfile),
      ).resolves.toEqual(user);
      expect(authService.findOrCreateUser).toHaveBeenCalledWith({
        provider: 'GOOGLE',
        providerId: 'google-123',
        email: 'user@example.com',
        displayName: 'Test User',
        profileImage: 'https://example.com/avatar.png',
      });
    });

    it('should handle missing optional profile fields', async () => {
      authService.findOrCreateUser.mockResolvedValue(user);

      const minimalProfile = {
        id: 'google-456',
        displayName: 'Minimal User',
      } as Profile;

      await googleStrategy.validate(
        'access-token',
        'refresh-token',
        minimalProfile,
      );

      expect(authService.findOrCreateUser).toHaveBeenCalledWith({
        provider: 'GOOGLE',
        providerId: 'google-456',
        email: null,
        displayName: 'Minimal User',
        profileImage: null,
      });
    });
  });
});
