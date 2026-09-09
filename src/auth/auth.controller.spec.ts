jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: {
    findOrCreateUser: jest.Mock;
    signAccessToken: jest.Mock;
    createAuthorizationCode: jest.Mock;
    exchangeAuthorizationCode: jest.Mock;
    refreshAccessToken: jest.Mock;
    logout: jest.Mock;
  };

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
      createAuthorizationCode: jest.fn(),
      exchangeAuthorizationCode: jest.fn(),
      refreshAccessToken: jest.fn(),
      logout: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'FRONTEND_URL') {
                return 'http://localhost:3000';
              }

              throw new Error(`Missing config: ${key}`);
            }),
          },
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
    it('should redirect to FRONTEND_URL with an app authorization code', async () => {
      const googleUser = {
        ...user,
        provider: 'GOOGLE' as const,
        providerId: 'google-789',
      };

      authService.createAuthorizationCode.mockResolvedValue(
        'app-authorization-code',
      );

      await expect(
        authController.googleAuthCallback({
          user: googleUser,
        } as Parameters<AuthController['googleAuthCallback']>[0]),
      ).resolves.toEqual({
        url: 'http://localhost:3000/auth/callback?code=app-authorization-code',
        statusCode: 302,
      });
      expect(authService.createAuthorizationCode).toHaveBeenCalledWith(
        googleUser,
      );
      expect(authService.signAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('kakao/callback', () => {
    it('should redirect to FRONTEND_URL with an app authorization code', async () => {
      const kakaoUser = {
        ...user,
        provider: 'KAKAO' as const,
        providerId: 'kakao-789',
        email: null,
      };

      authService.createAuthorizationCode.mockResolvedValue(
        'app-authorization-code',
      );

      await expect(
        authController.kakaoAuthCallback({
          user: kakaoUser,
        } as Parameters<AuthController['kakaoAuthCallback']>[0]),
      ).resolves.toEqual({
        url: 'http://localhost:3000/auth/callback?code=app-authorization-code',
        statusCode: 302,
      });
      expect(authService.createAuthorizationCode).toHaveBeenCalledWith(
        kakaoUser,
      );
      expect(authService.signAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('token', () => {
    it('should exchange an authorization code for a JWT and set a refresh cookie', async () => {
      authService.exchangeAuthorizationCode.mockResolvedValue({
        accessToken: 'signed-access-token',
        refreshToken: 'opaque-refresh-token',
      });
      const res = {
        cookie: jest.fn(),
      };

      await expect(
        authController.exchangeAuthorizationCode(
          {
            code: 'app-authorization-code',
          },
          res as unknown as Parameters<
            AuthController['exchangeAuthorizationCode']
          >[1],
        ),
      ).resolves.toEqual({
        accessToken: 'signed-access-token',
      });
      expect(authService.exchangeAuthorizationCode).toHaveBeenCalledWith(
        'app-authorization-code',
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'prm_refresh_token',
        'opaque-refresh-token',
        {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: false,
          maxAge: 30 * 24 * 60 * 60 * 1000,
        },
      );
    });
  });

  describe('refresh', () => {
    it('should read prm_refresh_token from the Cookie header', async () => {
      authService.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'rotated-refresh-token',
      });

      await authController.refreshAccessToken({
        headers: {
          cookie: 'other=value; prm_refresh_token=opaque-refresh-token',
        },
      } as Parameters<AuthController['refreshAccessToken']>[0]);

      expect(authService.refreshAccessToken).toHaveBeenCalledWith(
        'opaque-refresh-token',
      );
    });

    it('should return rotated access and refresh tokens', async () => {
      authService.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'rotated-refresh-token',
      });

      await expect(
        authController.refreshAccessToken({
          headers: {
            cookie: 'prm_refresh_token=opaque-refresh-token',
          },
        } as Parameters<AuthController['refreshAccessToken']>[0]),
      ).resolves.toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'rotated-refresh-token',
      });
    });

    it('should reject a missing refresh token cookie with 401', async () => {
      authService.refreshAccessToken.mockRejectedValue(
        new UnauthorizedException(),
      );

      await expect(
        authController.refreshAccessToken({
          headers: {},
        } as Parameters<AuthController['refreshAccessToken']>[0]),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(authService.refreshAccessToken).toHaveBeenCalledWith(undefined);
    });

    it('should reject an invalid refresh token with 401', async () => {
      authService.refreshAccessToken.mockRejectedValue(
        new UnauthorizedException(),
      );

      await expect(
        authController.refreshAccessToken({
          headers: {
            cookie: 'prm_refresh_token=invalid-refresh-token',
          },
        } as Parameters<AuthController['refreshAccessToken']>[0]),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(authService.refreshAccessToken).toHaveBeenCalledWith(
        'invalid-refresh-token',
      );
    });
  });

  describe('logout', () => {
    it('should read prm_refresh_token from the Cookie header', async () => {
      authService.logout.mockResolvedValue({ ok: true });

      await authController.logout({
        headers: {
          cookie: 'other=value; prm_refresh_token=opaque-refresh-token',
        },
      } as Parameters<AuthController['logout']>[0]);

      expect(authService.logout).toHaveBeenCalledWith('opaque-refresh-token');
    });

    it('should return ok without exposing the refresh token', async () => {
      authService.logout.mockResolvedValue({ ok: true });

      await expect(
        authController.logout({
          headers: {
            cookie: 'prm_refresh_token=opaque-refresh-token',
          },
        } as Parameters<AuthController['logout']>[0]),
      ).resolves.toEqual({ ok: true });
    });

    it('should succeed when the refresh token cookie is missing', async () => {
      authService.logout.mockResolvedValue({ ok: true });

      await expect(
        authController.logout({
          headers: {},
        } as Parameters<AuthController['logout']>[0]),
      ).resolves.toEqual({ ok: true });
      expect(authService.logout).toHaveBeenCalledWith(undefined);
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
