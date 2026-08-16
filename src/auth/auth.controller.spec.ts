jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: { findOrCreateUser: jest.Mock; signAccessToken: jest.Mock };

  const oauthProfile = {
    provider: 'KAKAO' as const,
    providerId: 'kakao-456',
    email: 'kakao@example.com',
    displayName: 'Kakao User',
    profileImage: null,
  };

  const user = {
    id: 'user-id',
    ...oauthProfile,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    authService = {
      findOrCreateUser: jest.fn(),
      signAccessToken: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    authController = app.get<AuthController>(AuthController);
  });

  describe('oauth/login', () => {
    it('should return the user from AuthService', async () => {
      authService.findOrCreateUser.mockResolvedValue(user);

      await expect(authController.oauthLogin(oauthProfile)).resolves.toEqual({
        user,
      });
      expect(authService.findOrCreateUser).toHaveBeenCalledWith(oauthProfile);
    });
  });

  describe('google/callback', () => {
    it('should return the authenticated user and access token', () => {
      const googleUser = {
        ...user,
        provider: 'GOOGLE' as const,
        providerId: 'google-789',
      };

      authService.signAccessToken.mockReturnValue('signed-access-token');

      expect(
        authController.googleAuthCallback({
          user: googleUser,
        } as Parameters<AuthController['googleAuthCallback']>[0]),
      ).toEqual({
        user: googleUser,
        accessToken: 'signed-access-token',
      });
      expect(authService.signAccessToken).toHaveBeenCalledWith(googleUser);
    });
  });

  describe('me', () => {
    it('should return the authenticated user from JWT', () => {
      expect(
        authController.getProfile({
          user: { userId: 'user-id' },
        } as Parameters<AuthController['getProfile']>[0]),
      ).toEqual({ userId: 'user-id' });
    });
  });
});
