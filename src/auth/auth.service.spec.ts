jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };
  let jwtService: {
    sign: jest.Mock;
  };

  const oauthProfile = {
    provider: 'GOOGLE' as const,
    providerId: 'google-123',
    email: 'user@example.com',
    displayName: 'Test User',
    profileImage: 'https://example.com/avatar.png',
  };

  const existingUser = {
    id: 'user-id',
    ...oauthProfile,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    jwtService = {
      sign: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    authService = app.get<AuthService>(AuthService);
  });

  describe('findOrCreateUser', () => {
    it('should return an existing user when provider and providerId match', async () => {
      prismaService.user.findUnique.mockResolvedValue(existingUser);

      await expect(authService.findOrCreateUser(oauthProfile)).resolves.toEqual(
        existingUser,
      );
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          provider_providerId: {
            provider: oauthProfile.provider,
            providerId: oauthProfile.providerId,
          },
        },
      });
      expect(prismaService.user.create).not.toHaveBeenCalled();
    });

    it('should create a new user when no matching user exists', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(existingUser);

      await expect(authService.findOrCreateUser(oauthProfile)).resolves.toEqual(
        existingUser,
      );
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          provider: oauthProfile.provider,
          providerId: oauthProfile.providerId,
          email: oauthProfile.email,
          displayName: oauthProfile.displayName,
          profileImage: oauthProfile.profileImage,
        },
      });
    });
  });

  describe('signAccessToken', () => {
    it('should sign a JWT with the user id in the payload', () => {
      jwtService.sign.mockReturnValue('signed-access-token');

      expect(authService.signAccessToken(existingUser)).toBe(
        'signed-access-token',
      );
      expect(jwtService.sign).toHaveBeenCalledWith({ sub: existingUser.id });
    });
  });
});
