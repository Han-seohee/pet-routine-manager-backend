jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    authorizationCode: {
      create: jest.Mock;
      updateMany: jest.Mock;
      findUnique: jest.Mock;
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
      authorizationCode: {
        create: jest.fn().mockResolvedValue(undefined),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
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

  describe('createAuthorizationCode', () => {
    it('should create a one-time authorization code and store only its hash', async () => {
      const before = Date.now();

      const code = await authService.createAuthorizationCode(existingUser);
      const after = Date.now();
      const createCalls = prismaService.authorizationCode.create.mock
        .calls as Array<
        [{ data: { codeHash: string; userId: string; expiresAt: Date } }]
      >;
      const saved = createCalls[0][0].data;

      expect(code).toEqual(expect.any(String));
      expect(code.length).toBeGreaterThanOrEqual(43);
      expect(saved.codeHash).toBe(
        createHash('sha256').update(code).digest('hex'),
      );
      expect(saved.userId).toBe(existingUser.id);
      expect(saved).not.toHaveProperty('code');
      expect(JSON.stringify(saved)).not.toContain(code);
      expect(saved.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 60_000);
      expect(saved.expiresAt.getTime()).toBeLessThanOrEqual(after + 60_000);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('exchangeAuthorizationCode', () => {
    const code = 'app-authorization-code';
    const codeHash = createHash('sha256').update(code).digest('hex');

    it('should exchange a valid authorization code for a JWT', async () => {
      prismaService.authorizationCode.updateMany.mockResolvedValue({
        count: 1,
      });
      prismaService.authorizationCode.findUnique.mockResolvedValue({
        codeHash,
        userId: existingUser.id,
        user: existingUser,
      });
      jwtService.sign.mockReturnValue('signed-access-token');

      await expect(
        authService.exchangeAuthorizationCode(code),
      ).resolves.toEqual({
        accessToken: 'signed-access-token',
      });
      const updateCalls = prismaService.authorizationCode.updateMany.mock
        .calls as Array<
        [
          {
            where: {
              codeHash: string;
              usedAt: null;
              expiresAt: { gt: Date };
            };
            data: { usedAt: Date };
          },
        ]
      >;
      const updateArg = updateCalls[0][0];

      expect(updateArg.where.codeHash).toBe(codeHash);
      expect(updateArg.where.usedAt).toBeNull();
      expect(updateArg.where.expiresAt.gt).toBeInstanceOf(Date);
      expect(updateArg.data.usedAt).toBeInstanceOf(Date);
      expect(jwtService.sign).toHaveBeenCalledWith({ sub: existingUser.id });
    });

    it('should reject a reused authorization code with 401', async () => {
      prismaService.authorizationCode.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });
      prismaService.authorizationCode.findUnique.mockResolvedValue({
        codeHash,
        userId: existingUser.id,
        user: existingUser,
      });
      jwtService.sign.mockReturnValue('signed-access-token');

      await expect(
        authService.exchangeAuthorizationCode(code),
      ).resolves.toEqual({
        accessToken: 'signed-access-token',
      });
      await expect(
        authService.exchangeAuthorizationCode(code),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.sign).toHaveBeenCalledTimes(1);
    });

    it('should reject an expired authorization code with 401', async () => {
      prismaService.authorizationCode.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        authService.exchangeAuthorizationCode(code),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('should reject a missing authorization code with 401', async () => {
      prismaService.authorizationCode.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        authService.exchangeAuthorizationCode('unknown-code'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('should allow only one concurrent exchange of the same code', async () => {
      let consumed = false;

      prismaService.authorizationCode.updateMany.mockImplementation(() => {
        if (consumed) {
          return Promise.resolve({ count: 0 });
        }

        consumed = true;

        return Promise.resolve({ count: 1 });
      });
      prismaService.authorizationCode.findUnique.mockResolvedValue({
        codeHash,
        userId: existingUser.id,
        user: existingUser,
      });
      jwtService.sign.mockReturnValue('signed-access-token');

      const results = await Promise.allSettled([
        authService.exchangeAuthorizationCode(code),
        authService.exchangeAuthorizationCode(code),
      ]);

      const fulfilled = results.filter(
        (result) => result.status === 'fulfilled',
      );
      const rejected = results.filter((result) => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(fulfilled[0]).toEqual({
        status: 'fulfilled',
        value: { accessToken: 'signed-access-token' },
      });
      expect(rejected[0]?.status).toBe('rejected');
      if (rejected[0]?.status === 'rejected') {
        expect(rejected[0].reason).toBeInstanceOf(UnauthorizedException);
      }
      expect(jwtService.sign).toHaveBeenCalledTimes(1);
    });
  });
});
