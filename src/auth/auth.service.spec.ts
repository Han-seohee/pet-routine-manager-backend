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
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
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
      refreshToken: {
        create: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
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

    it('should exchange a valid authorization code for a JWT and refresh token', async () => {
      prismaService.authorizationCode.updateMany.mockResolvedValue({
        count: 1,
      });
      prismaService.authorizationCode.findUnique.mockResolvedValue({
        codeHash,
        userId: existingUser.id,
        user: existingUser,
      });
      jwtService.sign.mockReturnValue('signed-access-token');
      const before = Date.now();

      const result = await authService.exchangeAuthorizationCode(code);
      const after = Date.now();
      const refreshCreateCalls = prismaService.refreshToken.create.mock
        .calls as Array<
        [
          {
            data: {
              tokenHash: string;
              userId: string;
              expiresAt: Date;
              revokedAt: null;
            };
          },
        ]
      >;
      const savedRefreshToken = refreshCreateCalls[0][0].data;
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      expect(result.accessToken).toBe('signed-access-token');
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.refreshToken.length).toBeGreaterThanOrEqual(43);
      expect(savedRefreshToken.tokenHash).toBe(
        createHash('sha256').update(result.refreshToken).digest('hex'),
      );
      expect(savedRefreshToken.tokenHash).not.toBe(result.refreshToken);
      expect(savedRefreshToken.userId).toBe(existingUser.id);
      expect(savedRefreshToken.revokedAt).toBeNull();
      expect(savedRefreshToken).not.toHaveProperty('token');
      expect(JSON.stringify(savedRefreshToken)).not.toContain(
        result.refreshToken,
      );
      expect(savedRefreshToken.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + thirtyDaysMs,
      );
      expect(savedRefreshToken.expiresAt.getTime()).toBeLessThanOrEqual(
        after + thirtyDaysMs,
      );
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

      const firstResult = await authService.exchangeAuthorizationCode(code);

      expect(firstResult.accessToken).toBe('signed-access-token');
      expect(firstResult.refreshToken).toEqual(expect.any(String));
      await expect(
        authService.exchangeAuthorizationCode(code),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.sign).toHaveBeenCalledTimes(1);
      expect(prismaService.refreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('should reject an expired authorization code with 401', async () => {
      prismaService.authorizationCode.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        authService.exchangeAuthorizationCode(code),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
      expect(prismaService.refreshToken.create).not.toHaveBeenCalled();
    });

    it('should reject a missing authorization code with 401', async () => {
      prismaService.authorizationCode.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        authService.exchangeAuthorizationCode('unknown-code'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
      expect(prismaService.refreshToken.create).not.toHaveBeenCalled();
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
      expect(fulfilled[0]?.status).toBe('fulfilled');
      if (fulfilled[0]?.status === 'fulfilled') {
        expect(fulfilled[0].value.accessToken).toBe('signed-access-token');
        expect(fulfilled[0].value.refreshToken).toEqual(expect.any(String));
      }
      expect(rejected[0]?.status).toBe('rejected');
      if (rejected[0]?.status === 'rejected') {
        expect(rejected[0].reason).toBeInstanceOf(UnauthorizedException);
      }
      expect(jwtService.sign).toHaveBeenCalledTimes(1);
      expect(prismaService.refreshToken.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshAccessToken', () => {
    const refreshToken = 'opaque-refresh-token';
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const storedRefreshToken = {
      id: 'refresh-token-id',
      tokenHash,
      userId: existingUser.id,
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      user: existingUser,
    };
    const rotatedRefreshTokenRecord = {
      id: 'rotated-refresh-token-id',
      tokenHash: 'rotated-token-hash',
      userId: existingUser.id,
      expiresAt: new Date('2026-10-09T00:00:00.000Z'),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date('2026-09-09T00:00:00.000Z'),
    };

    const mockSuccessfulRotation = () => {
      const tx = {
        refreshToken: {
          create: jest.fn().mockResolvedValue(rotatedRefreshTokenRecord),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      prismaService.$transaction.mockImplementation(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      );

      return tx;
    };

    it('should rotate a valid refresh token and issue new tokens', async () => {
      prismaService.refreshToken.findUnique.mockResolvedValue(
        storedRefreshToken,
      );
      jwtService.sign.mockReturnValue('new-access-token');
      const tx = mockSuccessfulRotation();
      const before = Date.now();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      const result = await authService.refreshAccessToken(refreshToken);
      const after = Date.now();
      const created = (
        tx.refreshToken.create.mock.calls[0] as [
          {
            data: {
              tokenHash: string;
              userId: string;
              expiresAt: Date;
              revokedAt: null;
            };
          },
        ]
      )[0].data;
      const revoked = (
        tx.refreshToken.updateMany.mock.calls[0] as [
          {
            where: {
              id: string;
              revokedAt: null;
              expiresAt: { gt: Date };
            };
            data: { revokedAt: Date; replacedByTokenId: string };
          },
        ]
      )[0];

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.refreshToken).not.toBe(refreshToken);
      expect(result.refreshToken.length).toBeGreaterThanOrEqual(43);
      expect(created.tokenHash).toBe(
        createHash('sha256').update(result.refreshToken).digest('hex'),
      );
      expect(created.tokenHash).not.toBe(result.refreshToken);
      expect(created.userId).toBe(existingUser.id);
      expect(created.revokedAt).toBeNull();
      expect(JSON.stringify(created)).not.toContain(result.refreshToken);
      expect(created.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + thirtyDaysMs,
      );
      expect(created.expiresAt.getTime()).toBeLessThanOrEqual(
        after + thirtyDaysMs,
      );
      expect(revoked.where.id).toBe(storedRefreshToken.id);
      expect(revoked.where.revokedAt).toBeNull();
      expect(revoked.data.revokedAt).toBeInstanceOf(Date);
      expect(revoked.data.replacedByTokenId).toBe(rotatedRefreshTokenRecord.id);
      expect(jwtService.sign).toHaveBeenCalledWith({ sub: existingUser.id });
      expect(prismaService.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash },
        include: { user: true },
      });
    });

    it('should reject a missing refresh token with 401', async () => {
      await expect(
        authService.refreshAccessToken(undefined),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(authService.refreshAccessToken('')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prismaService.refreshToken.findUnique).not.toHaveBeenCalled();
      expect(prismaService.$transaction).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('should reject an unknown refresh token with 401', async () => {
      prismaService.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        authService.refreshAccessToken(refreshToken),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prismaService.$transaction).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('should reject an expired refresh token with 401', async () => {
      prismaService.refreshToken.findUnique.mockResolvedValue({
        ...storedRefreshToken,
        expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      });

      await expect(
        authService.refreshAccessToken(refreshToken),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prismaService.$transaction).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('should reject a revoked refresh token without reuse detection', async () => {
      prismaService.refreshToken.findUnique.mockResolvedValue({
        ...storedRefreshToken,
        revokedAt: new Date('2026-02-01T00:00:00.000Z'),
        replacedByTokenId: null,
      });

      await expect(
        authService.refreshAccessToken(refreshToken),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prismaService.$transaction).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('should reject a refresh token whose user no longer exists with 401', async () => {
      prismaService.refreshToken.findUnique.mockResolvedValue({
        ...storedRefreshToken,
        user: null,
      });

      await expect(
        authService.refreshAccessToken(refreshToken),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prismaService.$transaction).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('should not revoke another device refresh token during rotation', async () => {
      prismaService.refreshToken.findUnique.mockResolvedValue(
        storedRefreshToken,
      );
      jwtService.sign.mockReturnValue('new-access-token');
      const tx = mockSuccessfulRotation();

      await authService.refreshAccessToken(refreshToken);

      const revoked = (
        tx.refreshToken.updateMany.mock.calls[0] as [
          { where: { id: string } },
        ]
      )[0];

      expect(revoked.where.id).toBe(storedRefreshToken.id);
      expect(revoked.where).not.toEqual(
        expect.objectContaining({ userId: existingUser.id }),
      );
      expect(tx.refreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('should reject a concurrent rotation of the same refresh token', async () => {
      prismaService.refreshToken.findUnique.mockResolvedValue(
        storedRefreshToken,
      );
      jwtService.sign.mockReturnValue('new-access-token');
      let revoked = false;
      prismaService.$transaction.mockImplementation(
        async (callback: (client: unknown) => Promise<unknown>) => {
          const tx = {
            refreshToken: {
              create: jest.fn().mockResolvedValue({
                ...rotatedRefreshTokenRecord,
                id: revoked ? 'refresh-token-c-id' : 'rotated-refresh-token-id',
              }),
              updateMany: jest.fn().mockImplementation(() => {
                if (revoked) {
                  return Promise.resolve({ count: 0 });
                }

                revoked = true;

                return Promise.resolve({ count: 1 });
              }),
            },
          };

          return callback(tx);
        },
      );

      const results = await Promise.allSettled([
        authService.refreshAccessToken(refreshToken),
        authService.refreshAccessToken(refreshToken),
      ]);
      const fulfilled = results.filter(
        (result) => result.status === 'fulfilled',
      );
      const rejected = results.filter((result) => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      if (fulfilled[0]?.status === 'fulfilled') {
        expect(fulfilled[0].value.accessToken).toBe('new-access-token');
        expect(fulfilled[0].value.refreshToken).toEqual(expect.any(String));
      }
      if (rejected[0]?.status === 'rejected') {
        expect(rejected[0].reason).toBeInstanceOf(UnauthorizedException);
      }
      expect(jwtService.sign).toHaveBeenCalledTimes(1);
    });

    it('should look up the refresh token by hash and never persist the raw token', async () => {
      prismaService.refreshToken.findUnique.mockResolvedValue(
        storedRefreshToken,
      );
      jwtService.sign.mockReturnValue('new-access-token');
      mockSuccessfulRotation();

      const result = await authService.refreshAccessToken(refreshToken);
      const lookup = prismaService.refreshToken.findUnique.mock.calls[0][0] as {
        where: { tokenHash: string };
      };

      expect(lookup.where.tokenHash).toBe(tokenHash);
      expect(lookup.where.tokenHash).not.toBe(refreshToken);
      expect(JSON.stringify(lookup)).not.toContain(refreshToken);
      expect(JSON.stringify(lookup)).not.toContain(result.refreshToken);
    });

    it('should revoke the full device chain when a rotated token is reused', async () => {
      const tokenA = {
        id: 'token-a-id',
        tokenHash,
        userId: existingUser.id,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        revokedAt: new Date('2026-09-01T00:00:00.000Z'),
        replacedByTokenId: 'token-b-id',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        user: existingUser,
      };
      const tokenB = {
        id: 'token-b-id',
        userId: existingUser.id,
        replacedByTokenId: 'token-c-id',
      };
      const tokenC = {
        id: 'token-c-id',
        userId: existingUser.id,
        replacedByTokenId: null,
      };
      const tokens = [tokenA, tokenB, tokenC];
      const tx = {
        refreshToken: {
          create: jest.fn(),
          findUnique: jest.fn(
            (args: {
              where: { id?: string; replacedByTokenId?: string };
            }) => {
              if (args.where.id) {
                return Promise.resolve(
                  tokens.find((token) => token.id === args.where.id) ?? null,
                );
              }

              if (args.where.replacedByTokenId) {
                return Promise.resolve(
                  tokens.find(
                    (token) =>
                      token.replacedByTokenId === args.where.replacedByTokenId,
                  ) ?? null,
                );
              }

              return Promise.resolve(null);
            },
          ),
          updateMany: jest.fn().mockResolvedValue({ count: 3 }),
        },
      };

      prismaService.refreshToken.findUnique.mockResolvedValue(tokenA);
      prismaService.$transaction.mockImplementation(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      );

      await expect(
        authService.refreshAccessToken(refreshToken),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(tx.refreshToken.create).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
      expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['token-a-id', 'token-b-id', 'token-c-id'] },
          userId: existingUser.id,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
      expect(JSON.stringify(tx.refreshToken.updateMany.mock.calls)).not.toContain(
        refreshToken,
      );
    });

    it('should revoke the latest token when a middle chain token is reused', async () => {
      const tokenA = {
        id: 'token-a-id',
        userId: existingUser.id,
        replacedByTokenId: 'token-b-id',
      };
      const tokenB = {
        id: 'token-b-id',
        tokenHash,
        userId: existingUser.id,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        revokedAt: new Date('2026-09-02T00:00:00.000Z'),
        replacedByTokenId: 'token-c-id',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        user: existingUser,
      };
      const tokenC = {
        id: 'token-c-id',
        userId: existingUser.id,
        replacedByTokenId: 'token-d-id',
      };
      const tokenD = {
        id: 'token-d-id',
        userId: existingUser.id,
        replacedByTokenId: null,
      };
      const tokens = [tokenA, tokenB, tokenC, tokenD];
      const tx = {
        refreshToken: {
          create: jest.fn(),
          findUnique: jest.fn(
            (args: {
              where: { id?: string; replacedByTokenId?: string };
            }) => {
              if (args.where.id) {
                return Promise.resolve(
                  tokens.find((token) => token.id === args.where.id) ?? null,
                );
              }

              if (args.where.replacedByTokenId) {
                return Promise.resolve(
                  tokens.find(
                    (token) =>
                      token.replacedByTokenId === args.where.replacedByTokenId,
                  ) ?? null,
                );
              }

              return Promise.resolve(null);
            },
          ),
          updateMany: jest.fn().mockResolvedValue({ count: 4 }),
        },
      };

      prismaService.refreshToken.findUnique.mockResolvedValue(tokenB);
      prismaService.$transaction.mockImplementation(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      );

      await expect(
        authService.refreshAccessToken(refreshToken),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(tx.refreshToken.create).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
      expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['token-a-id', 'token-b-id', 'token-c-id', 'token-d-id'],
          },
          userId: existingUser.id,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
    });

    it('should not revoke another device chain during reuse detection', async () => {
      const tokenA = {
        id: 'token-a-id',
        tokenHash,
        userId: existingUser.id,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        revokedAt: new Date('2026-09-01T00:00:00.000Z'),
        replacedByTokenId: 'token-b-id',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        user: existingUser,
      };
      const tokenB = {
        id: 'token-b-id',
        userId: existingUser.id,
        replacedByTokenId: 'token-c-id',
      };
      const tokenC = {
        id: 'token-c-id',
        userId: existingUser.id,
        replacedByTokenId: null,
      };
      const tokens = [tokenA, tokenB, tokenC];
      const tx = {
        refreshToken: {
          create: jest.fn(),
          findUnique: jest.fn(
            (args: {
              where: { id?: string; replacedByTokenId?: string };
            }) => {
              if (args.where.id) {
                return Promise.resolve(
                  tokens.find((token) => token.id === args.where.id) ?? null,
                );
              }

              if (args.where.replacedByTokenId) {
                return Promise.resolve(
                  tokens.find(
                    (token) =>
                      token.replacedByTokenId === args.where.replacedByTokenId,
                  ) ?? null,
                );
              }

              return Promise.resolve(null);
            },
          ),
          updateMany: jest.fn().mockResolvedValue({ count: 3 }),
        },
      };

      prismaService.refreshToken.findUnique.mockResolvedValue(tokenA);
      prismaService.$transaction.mockImplementation(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      );

      await expect(
        authService.refreshAccessToken(refreshToken),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      const revoked = (
        tx.refreshToken.updateMany.mock.calls[0] as [
          { where: { id: { in: string[] }; userId: string } },
        ]
      )[0];

      expect(revoked.where.id.in).toEqual([
        'token-a-id',
        'token-b-id',
        'token-c-id',
      ]);
      expect(revoked.where.id.in).not.toContain('token-x-id');
      expect(revoked.where.id.in).not.toContain('token-y-id');
    });

    it('should reject the latest token after its chain was revoked by reuse', async () => {
      prismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'token-c-id',
        tokenHash,
        userId: existingUser.id,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        revokedAt: new Date('2026-09-09T00:00:00.000Z'),
        replacedByTokenId: null,
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
        user: existingUser,
      });

      await expect(
        authService.refreshAccessToken(refreshToken),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prismaService.$transaction).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    const refreshToken = 'opaque-refresh-token';
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    it('should revoke only the current active refresh token', async () => {
      prismaService.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await expect(authService.logout(refreshToken)).resolves.toEqual({
        ok: true,
      });
      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          tokenHash,
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
      expect(prismaService.refreshToken.update).not.toHaveBeenCalled();
      expect(prismaService.$transaction).not.toHaveBeenCalled();
      expect(prismaService.refreshToken.create).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('should not revoke another device refresh token', async () => {
      prismaService.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await authService.logout(refreshToken);

      const revoked = prismaService.refreshToken.updateMany.mock.calls[0][0] as {
        where: { tokenHash: string; revokedAt: null };
      };

      expect(revoked.where.tokenHash).toBe(tokenHash);
      expect(revoked.where).not.toEqual(
        expect.objectContaining({ userId: existingUser.id }),
      );
    });

    it('should succeed without changing an already revoked token', async () => {
      prismaService.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(authService.logout(refreshToken)).resolves.toEqual({
        ok: true,
      });
      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          tokenHash,
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
      expect(prismaService.refreshToken.update).not.toHaveBeenCalled();
    });

    it('should succeed for an unknown refresh token without creating rows', async () => {
      prismaService.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(authService.logout('invalid-refresh-token')).resolves.toEqual(
        {
          ok: true,
        },
      );
      expect(prismaService.refreshToken.create).not.toHaveBeenCalled();
      expect(prismaService.refreshToken.delete).not.toHaveBeenCalled();
    });

    it('should succeed without a refresh token cookie and skip the database', async () => {
      await expect(authService.logout(undefined)).resolves.toEqual({
        ok: true,
      });
      await expect(authService.logout('')).resolves.toEqual({ ok: true });
      expect(prismaService.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('should reject refresh after logout without reuse detection', async () => {
      prismaService.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      prismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'token-c-id',
        tokenHash,
        userId: existingUser.id,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        revokedAt: new Date('2026-09-09T00:00:00.000Z'),
        replacedByTokenId: null,
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
        user: existingUser,
      });

      await expect(authService.logout(refreshToken)).resolves.toEqual({
        ok: true,
      });
      await expect(
        authService.refreshAccessToken(refreshToken),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prismaService.$transaction).not.toHaveBeenCalled();
      expect(prismaService.refreshToken.create).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
    });
  });
});
