jest.mock('../src/prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => {
    const refreshToken = {
      create: jest.fn().mockImplementation((args) =>
        Promise.resolve({
          id: 'new-refresh-token-id',
          tokenHash: args.data.tokenHash,
          userId: args.data.userId,
          expiresAt: args.data.expiresAt,
          revokedAt: args.data.revokedAt ?? null,
          replacedByTokenId: args.data.replacedByTokenId ?? null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      delete: jest.fn(),
    };

    return {
    onModuleInit: jest.fn().mockResolvedValue(undefined),
    onModuleDestroy: jest.fn().mockResolvedValue(undefined),
    pingDatabase: jest.fn().mockResolvedValue(undefined),
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((args) =>
        Promise.resolve({
          id: 'new-user-id',
          ...args.data,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ),
    },
    authorizationCode: {
      create: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    refreshToken,
    $transaction: jest.fn().mockImplementation(async (callback) => {
      const tx = {
        family: {
          create: jest.fn().mockImplementation((args) =>
            Promise.resolve({
              id: 'new-family-id',
              ...args.data,
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            }),
          ),
        },
        familyMember: {
          create: jest.fn().mockImplementation((args) =>
            Promise.resolve({
              id: 'new-member-id',
              ...args.data,
              joinedAt: new Date('2026-01-01T00:00:00.000Z'),
            }),
          ),
          findMany: jest.fn().mockResolvedValue([]),
        },
        pet: {
          create: jest.fn().mockImplementation((args) =>
            Promise.resolve({
              id: 'new-pet-id',
              ...args.data,
            }),
          ),
        },
        category: {
          create: jest.fn().mockImplementation((args) =>
            Promise.resolve({
              id: `new-category-${args.data.name}`,
              ...args.data,
            }),
          ),
        },
        subCategory: {
          create: jest.fn().mockImplementation((args) =>
            Promise.resolve({
              id: `new-sub-${args.data.name}`,
              ...args.data,
            }),
          ),
        },
        refreshToken,
      };

      return callback(tx);
    }),
    familyMember: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((args) =>
        Promise.resolve({
          id: 'new-added-member-id',
          ...args.data,
          joinedAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ),
    },
    family: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockImplementation((args) =>
        Promise.resolve({
          id: args.where.id,
          name: args.data.name,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-03T00:00:00.000Z'),
        }),
      ),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    pet: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((args) =>
        Promise.resolve({
          id: 'new-pet-id',
          ...args.data,
        }),
      ),
      update: jest.fn().mockImplementation((args) =>
        Promise.resolve({
          id: args.where.id,
          familyId: 'existing-family-id',
          name: '초코',
          birthDate: new Date('2024-01-15T00:00:00.000Z'),
          gender: 'MALE',
          breed: '푸들',
          image: null,
          registrationNumber: '123456789',
          ...args.data,
        }),
      ),
      delete: jest.fn().mockResolvedValue(undefined),
    },
  };
  }),
}));

process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? 'test-google-client-secret';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';
process.env.KAKAO_CLIENT_ID =
  process.env.KAKAO_CLIENT_ID ?? 'test-kakao-client-id';

import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  const refreshUser = {
    id: 'refresh-user-id',
    provider: 'GOOGLE' as const,
    providerId: 'google-refresh-123',
    email: 'refresh@example.com',
    displayName: 'Refresh User',
    profileImage: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const mockRefreshTokenLookup = (
    prismaService: PrismaService,
    tokens: Array<{
      id: string;
      tokenHash?: string;
      userId: string;
      replacedByTokenId: string | null;
      revokedAt: Date | null;
      expiresAt?: Date;
      createdAt?: Date;
      user?: typeof refreshUser | null;
    }>,
  ) => {
    jest.spyOn(prismaService.refreshToken, 'findUnique').mockImplementation(
      (args: {
        where?: { tokenHash?: string; id?: string; replacedByTokenId?: string };
      }) => {
        const where = args.where ?? {};

        if (where.tokenHash) {
          return Promise.resolve(
            tokens.find((token) => token.tokenHash === where.tokenHash) ?? null,
          );
        }

        if (where.id) {
          return Promise.resolve(
            tokens.find((token) => token.id === where.id) ?? null,
          );
        }

        if (where.replacedByTokenId) {
          return Promise.resolve(
            tokens.find(
              (token) => token.replacedByTokenId === where.replacedByTokenId,
            ) ?? null,
          );
        }

        return Promise.resolve(null);
      },
    );
  };

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('/health/db (GET)', () => {
    return request(app.getHttpServer())
      .get('/health/db')
      .expect(200)
      .expect({ status: 'ok', database: 'connected' });
  });

  it('/auth/oauth/login (POST)', () => {
    return request(app.getHttpServer())
      .post('/auth/oauth/login')
      .send({
        provider: 'GOOGLE',
        providerId: 'google-e2e-123',
        email: 'e2e@example.com',
        displayName: 'E2E User',
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.user).toMatchObject({
          id: 'new-user-id',
          provider: 'GOOGLE',
          providerId: 'google-e2e-123',
          email: 'e2e@example.com',
          displayName: 'E2E User',
        });
      });
  });

  it('/auth/google (GET) redirects to Google OAuth', () => {
    return request(app.getHttpServer())
      .get('/auth/google')
      .expect(302)
      .expect((response) => {
        expect(response.headers.location).toContain('accounts.google.com');
      });
  });

  it('/auth/kakao (GET) redirects to Kakao OAuth', () => {
    return request(app.getHttpServer())
      .get('/auth/kakao')
      .expect(302)
      .expect((response) => {
        expect(response.headers.location).toContain('kauth.kakao.com');
      });
  });

  it('/auth/token (POST) rejects an invalid authorization code', () => {
    return request(app.getHttpServer())
      .post('/auth/token')
      .send({ code: 'invalid-code' })
      .expect(401);
  });

  it('/auth/token (POST) issues an access token and refresh token cookie', async () => {
    const prismaService = app.get(PrismaService);
    const user = {
      id: 'token-user-id',
      provider: 'GOOGLE' as const,
      providerId: 'google-token-123',
      email: 'token@example.com',
      displayName: 'Token User',
      profileImage: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const thirtyDaysSeconds = 30 * 24 * 60 * 60;

    jest
      .spyOn(prismaService.authorizationCode, 'updateMany')
      .mockResolvedValue({ count: 1 });
    jest.spyOn(prismaService.authorizationCode, 'findUnique').mockResolvedValue(
      {
        id: 'authorization-code-id',
        codeHash: 'hashed-code',
        userId: user.id,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        usedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        user,
      },
    );
    const refreshTokenCreate = jest
      .spyOn(prismaService.refreshToken, 'create')
      .mockResolvedValue({
        id: 'refresh-token-id',
        tokenHash: 'hashed-refresh-token',
        userId: user.id,
        expiresAt: new Date('2026-02-01T00:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
    const before = Date.now();

    const response = await request(app.getHttpServer())
      .post('/auth/token')
      .send({ code: 'valid-app-authorization-code' })
      .expect(201);

    const after = Date.now();
    const setCookie = response.headers['set-cookie'];
    const cookies = Array.isArray(setCookie)
      ? setCookie
      : setCookie
        ? [setCookie]
        : [];
    const refreshCookie = cookies.find((cookie) =>
      cookie.startsWith('prm_refresh_token='),
    );
    const rawToken = decodeURIComponent(
      refreshCookie?.split(';')[0]?.slice('prm_refresh_token='.length) ?? '',
    );
    const saved = (
      refreshTokenCreate.mock.calls[0] as [
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

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body).not.toHaveProperty('refreshToken');
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain(`Max-Age=${thirtyDaysSeconds}`);
    expect(refreshCookie).toContain('Path=/');
    expect(refreshCookie).toContain('SameSite=Lax');
    expect(rawToken.length).toBeGreaterThanOrEqual(43);
    expect(refreshTokenCreate).toHaveBeenCalledTimes(1);
    expect(saved.tokenHash).toBe(
      createHash('sha256').update(rawToken).digest('hex'),
    );
    expect(saved.tokenHash).not.toBe(rawToken);
    expect(saved.userId).toBe(user.id);
    expect(saved.revokedAt).toBeNull();
    expect(JSON.stringify(saved)).not.toContain(rawToken);
    expect(saved.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + thirtyDaysMs,
    );
    expect(saved.expiresAt.getTime()).toBeLessThanOrEqual(after + thirtyDaysMs);
  });

  it('/auth/refresh (POST) rotates the refresh token and returns new tokens', async () => {
    const prismaService = app.get(PrismaService);
    const user = {
      id: 'refresh-user-id',
      provider: 'GOOGLE' as const,
      providerId: 'google-refresh-123',
      email: 'refresh@example.com',
      displayName: 'Refresh User',
      profileImage: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    let refreshTokenCreateCount = 0;

    jest
      .spyOn(prismaService.authorizationCode, 'updateMany')
      .mockResolvedValue({ count: 1 });
    jest.spyOn(prismaService.authorizationCode, 'findUnique').mockResolvedValue(
      {
        id: 'authorization-code-id',
        codeHash: 'hashed-code',
        userId: user.id,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        usedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        user,
      },
    );
    const refreshTokenCreate = jest
      .spyOn(prismaService.refreshToken, 'create')
      .mockImplementation((args: { data: Record<string, unknown> }) => {
        refreshTokenCreateCount += 1;

        return Promise.resolve({
          id:
            refreshTokenCreateCount === 1
              ? 'refresh-token-a-id'
              : 'refresh-token-b-id',
          tokenHash: args.data.tokenHash,
          userId: args.data.userId,
          expiresAt: args.data.expiresAt,
          revokedAt: args.data.revokedAt ?? null,
          replacedByTokenId: args.data.replacedByTokenId ?? null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        });
      });
    const refreshTokenUpdateMany = jest
      .spyOn(prismaService.refreshToken, 'updateMany')
      .mockResolvedValue({ count: 1 });

    const tokenResponse = await request(app.getHttpServer())
      .post('/auth/token')
      .send({ code: 'valid-app-authorization-code' })
      .expect(201);

    const setCookie = tokenResponse.headers['set-cookie'];
    const cookies = Array.isArray(setCookie)
      ? setCookie
      : setCookie
        ? [setCookie]
        : [];
    const refreshCookie = cookies.find((cookie) =>
      cookie.startsWith('prm_refresh_token='),
    );
    const rawTokenA = decodeURIComponent(
      refreshCookie?.split(';')[0]?.slice('prm_refresh_token='.length) ?? '',
    );
    const savedA = (
      refreshTokenCreate.mock.calls[0] as [
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
    const storedRefreshTokenA = {
      id: 'refresh-token-a-id',
      tokenHash: savedA.tokenHash,
      userId: savedA.userId,
      expiresAt: savedA.expiresAt,
      revokedAt: savedA.revokedAt,
      replacedByTokenId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      user,
    };

    jest
      .spyOn(prismaService.refreshToken, 'findUnique')
      .mockResolvedValue(storedRefreshTokenA);

    const before = Date.now();
    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `prm_refresh_token=${rawTokenA}`)
      .expect(200);
    const after = Date.now();

    const jwtService = app.get(JwtService);
    const savedB = (
      refreshTokenCreate.mock.calls[1] as [
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
    const rotated = (
      refreshTokenUpdateMany.mock.calls[0] as [
        {
          where: { id: string; revokedAt: null };
          data: { revokedAt: Date; replacedByTokenId: string };
        },
      ]
    )[0];
    const rawTokenB = refreshResponse.body.refreshToken as string;

    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));
    expect(rawTokenB).toEqual(expect.any(String));
    expect(rawTokenB).not.toBe(rawTokenA);
    expect(jwtService.verify(refreshResponse.body.accessToken)).toMatchObject({
      sub: user.id,
    });
    expect(refreshResponse.headers['set-cookie']).toBeUndefined();
    expect(savedB.tokenHash).toBe(
      createHash('sha256').update(rawTokenB).digest('hex'),
    );
    expect(savedB.tokenHash).not.toBe(rawTokenB);
    expect(savedB.userId).toBe(savedA.userId);
    expect(savedB.revokedAt).toBeNull();
    expect(savedB.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + thirtyDaysMs,
    );
    expect(savedB.expiresAt.getTime()).toBeLessThanOrEqual(
      after + thirtyDaysMs,
    );
    expect(JSON.stringify(savedB)).not.toContain(rawTokenB);
    expect(rotated.where.id).toBe('refresh-token-a-id');
    expect(rotated.where.revokedAt).toBeNull();
    expect(rotated.data.revokedAt).toBeInstanceOf(Date);
    expect(rotated.data.replacedByTokenId).toBe('refresh-token-b-id');
    expect(refreshTokenCreate).toHaveBeenCalledTimes(2);
  });

  it('/auth/refresh (POST) does not rotate another device refresh token', async () => {
    const prismaService = app.get(PrismaService);
    const user = {
      id: 'refresh-user-id',
      provider: 'GOOGLE' as const,
      providerId: 'google-refresh-123',
      email: 'refresh@example.com',
      displayName: 'Refresh User',
      profileImage: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const refreshTokenA = 'device-a-refresh-token';

    jest.spyOn(prismaService.refreshToken, 'findUnique').mockResolvedValue({
      id: 'refresh-token-a-id',
      tokenHash: createHash('sha256').update(refreshTokenA).digest('hex'),
      userId: user.id,
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      user,
    });
    jest.spyOn(prismaService.refreshToken, 'create').mockResolvedValue({
      id: 'refresh-token-b-id',
      tokenHash: 'hashed-b',
      userId: user.id,
      expiresAt: new Date('2026-10-09T00:00:00.000Z'),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date('2026-09-09T00:00:00.000Z'),
    });
    const refreshTokenUpdateMany = jest
      .spyOn(prismaService.refreshToken, 'updateMany')
      .mockResolvedValue({ count: 1 });

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `prm_refresh_token=${refreshTokenA}`)
      .expect(200);

    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'refresh-token-a-id',
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: {
        revokedAt: expect.any(Date),
        replacedByTokenId: 'refresh-token-b-id',
      },
    });
    expect(refreshTokenUpdateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'refresh-token-x-id' }),
      }),
    );
  });

  it('/auth/refresh (POST) rejects a missing refresh token cookie', () => {
    return request(app.getHttpServer()).post('/auth/refresh').expect(401);
  });

  it('/auth/refresh (POST) rejects an unknown refresh token', () => {
    return request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', 'prm_refresh_token=unknown-refresh-token')
      .expect(401);
  });

  it('/auth/refresh (POST) rejects an expired refresh token without rotating', async () => {
    const prismaService = app.get(PrismaService);
    const refreshToken = 'expired-refresh-token';
    const refreshTokenCreate = jest.spyOn(prismaService.refreshToken, 'create');
    const refreshTokenUpdateMany = jest.spyOn(
      prismaService.refreshToken,
      'updateMany',
    );

    jest.spyOn(prismaService.refreshToken, 'findUnique').mockResolvedValue({
      id: 'expired-refresh-token-id',
      tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
      userId: 'refresh-user-id',
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      user: {
        id: 'refresh-user-id',
        provider: 'GOOGLE',
        providerId: 'google-refresh-123',
        email: 'refresh@example.com',
        displayName: 'Refresh User',
        profileImage: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `prm_refresh_token=${refreshToken}`)
      .expect(401);

    expect(refreshTokenCreate).not.toHaveBeenCalled();
    expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
  });

  it('/auth/refresh (POST) rejects a revoked refresh token without reuse detection', async () => {
    const prismaService = app.get(PrismaService);
    const refreshToken = 'revoked-without-rotation-token';
    const refreshTokenCreate = jest.spyOn(prismaService.refreshToken, 'create');
    const refreshTokenUpdateMany = jest.spyOn(
      prismaService.refreshToken,
      'updateMany',
    );

    jest.spyOn(prismaService.refreshToken, 'findUnique').mockResolvedValue({
      id: 'revoked-refresh-token-id',
      tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
      userId: refreshUser.id,
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      revokedAt: new Date('2026-02-01T00:00:00.000Z'),
      replacedByTokenId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      user: refreshUser,
    });

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `prm_refresh_token=${refreshToken}`)
      .expect(401);

    expect(refreshTokenCreate).not.toHaveBeenCalled();
    expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
  });

  it('/auth/refresh (POST) revokes the full chain when a rotated token is reused', async () => {
    const prismaService = app.get(PrismaService);
    const rawTokenA = 'rotated-token-a';
    const tokens = [
      {
        id: 'token-a-id',
        tokenHash: createHash('sha256').update(rawTokenA).digest('hex'),
        userId: refreshUser.id,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        revokedAt: new Date('2026-09-01T00:00:00.000Z'),
        replacedByTokenId: 'token-b-id',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        user: refreshUser,
      },
      {
        id: 'token-b-id',
        userId: refreshUser.id,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        revokedAt: new Date('2026-09-02T00:00:00.000Z'),
        replacedByTokenId: 'token-c-id',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        user: refreshUser,
      },
      {
        id: 'token-c-id',
        userId: refreshUser.id,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        revokedAt: null,
        replacedByTokenId: null,
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
        user: refreshUser,
      },
    ];
    const refreshTokenCreate = jest.spyOn(prismaService.refreshToken, 'create');
    const refreshTokenUpdateMany = jest
      .spyOn(prismaService.refreshToken, 'updateMany')
      .mockResolvedValue({ count: 3 });

    mockRefreshTokenLookup(prismaService, tokens);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `prm_refresh_token=${rawTokenA}`)
      .expect(401);

    expect(refreshTokenCreate).not.toHaveBeenCalled();
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['token-a-id', 'token-b-id', 'token-c-id'] },
        userId: refreshUser.id,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it('/auth/refresh (POST) revokes the latest token when a middle chain token is reused', async () => {
    const prismaService = app.get(PrismaService);
    const rawTokenB = 'rotated-token-b';
    const tokens = [
      {
        id: 'token-a-id',
        userId: refreshUser.id,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        revokedAt: new Date('2026-09-01T00:00:00.000Z'),
        replacedByTokenId: 'token-b-id',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        user: refreshUser,
      },
      {
        id: 'token-b-id',
        tokenHash: createHash('sha256').update(rawTokenB).digest('hex'),
        userId: refreshUser.id,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        revokedAt: new Date('2026-09-02T00:00:00.000Z'),
        replacedByTokenId: 'token-c-id',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        user: refreshUser,
      },
      {
        id: 'token-c-id',
        userId: refreshUser.id,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        revokedAt: new Date('2026-09-03T00:00:00.000Z'),
        replacedByTokenId: 'token-d-id',
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
        user: refreshUser,
      },
      {
        id: 'token-d-id',
        userId: refreshUser.id,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        revokedAt: null,
        replacedByTokenId: null,
        createdAt: new Date('2026-01-04T00:00:00.000Z'),
        user: refreshUser,
      },
    ];
    const refreshTokenCreate = jest.spyOn(prismaService.refreshToken, 'create');
    const refreshTokenUpdateMany = jest
      .spyOn(prismaService.refreshToken, 'updateMany')
      .mockResolvedValue({ count: 4 });

    mockRefreshTokenLookup(prismaService, tokens);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `prm_refresh_token=${rawTokenB}`)
      .expect(401);

    expect(refreshTokenCreate).not.toHaveBeenCalled();
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['token-a-id', 'token-b-id', 'token-c-id', 'token-d-id'],
        },
        userId: refreshUser.id,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it('/auth/refresh (POST) does not revoke another device chain on reuse', async () => {
    const prismaService = app.get(PrismaService);
    const rawTokenA = 'device-1-token-a';
    const tokens = [
      {
        id: 'token-a-id',
        tokenHash: createHash('sha256').update(rawTokenA).digest('hex'),
        userId: refreshUser.id,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        revokedAt: new Date('2026-09-01T00:00:00.000Z'),
        replacedByTokenId: 'token-b-id',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        user: refreshUser,
      },
      {
        id: 'token-b-id',
        userId: refreshUser.id,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        revokedAt: new Date('2026-09-02T00:00:00.000Z'),
        replacedByTokenId: 'token-c-id',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        user: refreshUser,
      },
      {
        id: 'token-c-id',
        userId: refreshUser.id,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        revokedAt: null,
        replacedByTokenId: null,
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
        user: refreshUser,
      },
      {
        id: 'token-x-id',
        userId: refreshUser.id,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        revokedAt: new Date('2026-09-01T00:00:00.000Z'),
        replacedByTokenId: 'token-y-id',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        user: refreshUser,
      },
      {
        id: 'token-y-id',
        userId: refreshUser.id,
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        revokedAt: null,
        replacedByTokenId: null,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        user: refreshUser,
      },
    ];
    const refreshTokenUpdateMany = jest
      .spyOn(prismaService.refreshToken, 'updateMany')
      .mockResolvedValue({ count: 3 });

    mockRefreshTokenLookup(prismaService, tokens);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `prm_refresh_token=${rawTokenA}`)
      .expect(401);

    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['token-a-id', 'token-b-id', 'token-c-id'] },
        userId: refreshUser.id,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
    expect(refreshTokenUpdateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: expect.objectContaining({
            in: expect.arrayContaining(['token-x-id', 'token-y-id']),
          }),
        }),
      }),
    );
  });

  it('/auth/refresh (POST) rejects the latest token after reuse revoked its chain', async () => {
    const prismaService = app.get(PrismaService);
    const rawTokenC = 'revoked-latest-token-c';
    const refreshTokenCreate = jest.spyOn(prismaService.refreshToken, 'create');
    const refreshTokenUpdateMany = jest.spyOn(
      prismaService.refreshToken,
      'updateMany',
    );

    jest.spyOn(prismaService.refreshToken, 'findUnique').mockResolvedValue({
      id: 'token-c-id',
      tokenHash: createHash('sha256').update(rawTokenC).digest('hex'),
      userId: refreshUser.id,
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      revokedAt: new Date('2026-09-09T00:00:00.000Z'),
      replacedByTokenId: null,
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
      user: refreshUser,
    });

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `prm_refresh_token=${rawTokenC}`)
      .expect(401);

    expect(refreshTokenCreate).not.toHaveBeenCalled();
    expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
  });

  it('/auth/refresh (POST) allows only one concurrent rotation of the same token', async () => {
    const prismaService = app.get(PrismaService);
    const user = {
      id: 'refresh-user-id',
      provider: 'GOOGLE' as const,
      providerId: 'google-refresh-123',
      email: 'refresh@example.com',
      displayName: 'Refresh User',
      profileImage: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const refreshTokenA = 'concurrent-refresh-token';
    let revoked = false;

    jest.spyOn(prismaService.refreshToken, 'findUnique').mockResolvedValue({
      id: 'refresh-token-a-id',
      tokenHash: createHash('sha256').update(refreshTokenA).digest('hex'),
      userId: user.id,
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      user,
    });
    jest.spyOn(prismaService.refreshToken, 'create').mockImplementation(
      (args: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: revoked ? 'refresh-token-c-id' : 'refresh-token-b-id',
          tokenHash: args.data.tokenHash,
          userId: args.data.userId,
          expiresAt: args.data.expiresAt,
          revokedAt: null,
          replacedByTokenId: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
    );
    jest.spyOn(prismaService.refreshToken, 'updateMany').mockImplementation(
      () => {
        if (revoked) {
          return Promise.resolve({ count: 0 });
        }

        revoked = true;

        return Promise.resolve({ count: 1 });
      },
    );

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', `prm_refresh_token=${refreshTokenA}`),
      request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', `prm_refresh_token=${refreshTokenA}`),
    ]);
    const statuses = responses.map((response) => response.status).sort();
    const successful = responses.filter((response) => response.status === 200);

    expect(statuses).toEqual([200, 401]);
    expect(successful).toHaveLength(1);
    expect(successful[0]?.body.refreshToken).toEqual(expect.any(String));
    expect(prismaService.refreshToken.updateMany).toHaveBeenCalledTimes(2);
  });

  it('/auth/logout (POST) revokes the current refresh token', async () => {
    const prismaService = app.get(PrismaService);
    const rawToken = 'active-refresh-token';
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const refreshTokenUpdateMany = jest
      .spyOn(prismaService.refreshToken, 'updateMany')
      .mockResolvedValue({ count: 1 });

    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', `prm_refresh_token=${rawToken}`)
      .expect(200);

    expect(response.body).toEqual({ ok: true });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it('/auth/logout (POST) does not revoke another device refresh token', async () => {
    const prismaService = app.get(PrismaService);
    const rawTokenC = 'device-1-token-c';
    const tokenHash = createHash('sha256').update(rawTokenC).digest('hex');
    const refreshTokenUpdateMany = jest
      .spyOn(prismaService.refreshToken, 'updateMany')
      .mockResolvedValue({ count: 1 });

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', `prm_refresh_token=${rawTokenC}`)
      .expect(200)
      .expect({ ok: true });

    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
    expect(refreshTokenUpdateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: expect.anything(),
        }),
      }),
    );
  });

  it('/auth/logout (POST) keeps replacedByTokenId when logging out the current token', async () => {
    const prismaService = app.get(PrismaService);
    const rawTokenC = 'current-chain-token-c';
    const refreshTokenUpdateMany = jest
      .spyOn(prismaService.refreshToken, 'updateMany')
      .mockResolvedValue({ count: 1 });

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', `prm_refresh_token=${rawTokenC}`)
      .expect(200);

    const revoked = refreshTokenUpdateMany.mock.calls[0][0] as {
      data: { revokedAt: Date; replacedByTokenId?: string };
    };

    expect(revoked.data.revokedAt).toBeInstanceOf(Date);
    expect(revoked.data).not.toHaveProperty('replacedByTokenId');
  });

  it('/auth/logout (POST) succeeds for an already revoked token', async () => {
    const prismaService = app.get(PrismaService);
    const refreshTokenUpdateMany = jest
      .spyOn(prismaService.refreshToken, 'updateMany')
      .mockResolvedValue({ count: 0 });

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', 'prm_refresh_token=already-revoked-token')
      .expect(200)
      .expect({ ok: true });

    expect(refreshTokenUpdateMany).toHaveBeenCalledTimes(1);
    expect(prismaService.refreshToken.update).not.toHaveBeenCalled();
  });

  it('/auth/logout (POST) succeeds for an unknown refresh token', async () => {
    const prismaService = app.get(PrismaService);
    const refreshTokenCreate = jest.spyOn(prismaService.refreshToken, 'create');
    jest
      .spyOn(prismaService.refreshToken, 'updateMany')
      .mockResolvedValue({ count: 0 });

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', 'prm_refresh_token=invalid-token')
      .expect(200)
      .expect({ ok: true });

    expect(refreshTokenCreate).not.toHaveBeenCalled();
  });

  it('/auth/logout (POST) succeeds without a refresh token cookie', async () => {
    const prismaService = app.get(PrismaService);
    const refreshTokenUpdateMany = jest.spyOn(
      prismaService.refreshToken,
      'updateMany',
    );

    await request(app.getHttpServer()).post('/auth/logout').expect(200).expect({
      ok: true,
    });

    expect(refreshTokenUpdateMany).not.toHaveBeenCalled();
  });

  it('/auth/logout then /auth/refresh rejects the same token without reuse detection', async () => {
    const prismaService = app.get(PrismaService);
    const rawToken = 'logout-then-refresh-token';
    const refreshTokenCreate = jest.spyOn(prismaService.refreshToken, 'create');
    const refreshTokenUpdateMany = jest
      .spyOn(prismaService.refreshToken, 'updateMany')
      .mockResolvedValue({ count: 1 });

    jest.spyOn(prismaService.refreshToken, 'findUnique').mockResolvedValue({
      id: 'token-c-id',
      tokenHash: createHash('sha256').update(rawToken).digest('hex'),
      userId: refreshUser.id,
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      revokedAt: new Date('2026-09-09T00:00:00.000Z'),
      replacedByTokenId: null,
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
      user: refreshUser,
    });

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', `prm_refresh_token=${rawToken}`)
      .expect(200)
      .expect({ ok: true });

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `prm_refresh_token=${rawToken}`)
      .expect(401);

    expect(refreshTokenCreate).not.toHaveBeenCalled();
    expect(refreshTokenUpdateMany).toHaveBeenCalledTimes(1);
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: createHash('sha256').update(rawToken).digest('hex'),
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it('/auth/me (GET) rejects requests without JWT', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('/auth/me (GET) rejects invalid JWT', () => {
    return request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('/auth/me (GET) returns authenticated user for valid JWT', async () => {
    const jwtService = app.get(JwtService);
    const accessToken = jwtService.sign({ sub: 'jwt-user-id' });

    return request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect({ userId: 'jwt-user-id' });
  });

  it('/families (POST) rejects requests without JWT', () => {
    return request(app.getHttpServer())
      .post('/families')
      .send({ name: '우리 가족' })
      .expect(401);
  });

  it('/families (POST) creates a family for authenticated user', async () => {
    const jwtService = app.get(JwtService);
    const accessToken = jwtService.sign({ sub: 'jwt-user-id' });

    return request(app.getHttpServer())
      .post('/families')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '우리 가족' })
      .expect(201)
      .expect((response) => {
        expect(response.body.family).toMatchObject({
          id: 'new-family-id',
          name: '우리 가족',
        });
        expect(response.body.member).toMatchObject({
          id: 'new-member-id',
          userId: 'jwt-user-id',
          familyId: 'new-family-id',
          role: 'OWNER',
        });
      });
  });

  it('/families (GET) rejects requests without JWT', () => {
    return request(app.getHttpServer()).get('/families').expect(401);
  });

  it('/families (GET) returns families for authenticated user', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'jwt-user-id' });
    const family = {
      id: 'existing-family-id',
      name: '우리 가족',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    jest.spyOn(prismaService.familyMember, 'findMany').mockResolvedValue([
      {
        id: 'existing-member-id',
        userId: 'jwt-user-id',
        familyId: family.id,
        role: 'OWNER',
        joinedAt: new Date('2026-01-01T00:00:00.000Z'),
        family,
      },
    ]);

    return request(app.getHttpServer())
      .get('/families')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual([
          {
            family: {
              id: family.id,
              name: family.name,
              createdAt: family.createdAt.toISOString(),
              updatedAt: family.updatedAt.toISOString(),
            },
            role: 'OWNER',
          },
        ]);
      });
  });

  it('/families (GET) returns an empty array when user has no families', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'user-without-family' });

    jest.spyOn(prismaService.familyMember, 'findMany').mockResolvedValue([]);

    return request(app.getHttpServer())
      .get('/families')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect([]);
  });

  it('/families/:id (GET) rejects requests without JWT', () => {
    return request(app.getHttpServer())
      .get('/families/existing-family-id')
      .expect(401);
  });

  it('/families/:id (GET) returns family for authenticated member', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'jwt-user-id' });
    const family = {
      id: 'existing-family-id',
      name: '우리 가족',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'existing-member-id',
      userId: 'jwt-user-id',
      familyId: family.id,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
      family,
    });

    return request(app.getHttpServer())
      .get(`/families/${family.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          id: family.id,
          name: family.name,
          createdAt: family.createdAt.toISOString(),
          updatedAt: family.updatedAt.toISOString(),
        });
      });
  });

  it('/families/:id (GET) returns 403 when user is not a member', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'non-member-user-id' });
    const family = {
      id: 'existing-family-id',
      name: '우리 가족',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    jest
      .spyOn(prismaService.familyMember, 'findUnique')
      .mockResolvedValue(null);
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(family);

    return request(app.getHttpServer())
      .get(`/families/${family.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('/families/:id (GET) returns 404 when family does not exist', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'jwt-user-id' });

    jest
      .spyOn(prismaService.familyMember, 'findUnique')
      .mockResolvedValue(null);
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(null);

    return request(app.getHttpServer())
      .get('/families/missing-family-id')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('/families/:id/members (GET) rejects requests without JWT', () => {
    return request(app.getHttpServer())
      .get('/families/existing-family-id/members')
      .expect(401);
  });

  it('/families/:id/members (GET) returns members for authenticated member', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'jwt-user-id' });
    const familyId = 'existing-family-id';

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'existing-member-id',
      userId: 'jwt-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.familyMember, 'findMany').mockResolvedValue([
      {
        id: 'existing-member-id',
        userId: 'jwt-user-id',
        familyId,
        role: 'OWNER',
        joinedAt: new Date('2026-01-01T00:00:00.000Z'),
        user: {
          id: 'jwt-user-id',
          displayName: 'Test User',
          profileImage: 'https://example.com/avatar.png',
        },
      },
    ]);

    return request(app.getHttpServer())
      .get(`/families/${familyId}/members`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual([
          {
            userId: 'jwt-user-id',
            displayName: 'Test User',
            profileImage: 'https://example.com/avatar.png',
            role: 'OWNER',
          },
        ]);
      });
  });

  it('/families/:id/members (GET) returns 403 when user is not a member', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'non-member-user-id' });
    const family = {
      id: 'existing-family-id',
      name: '우리 가족',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    jest
      .spyOn(prismaService.familyMember, 'findUnique')
      .mockResolvedValue(null);
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(family);

    return request(app.getHttpServer())
      .get(`/families/${family.id}/members`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('/families/:id/members (GET) returns an empty array when family has no members', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'jwt-user-id' });
    const familyId = 'empty-family-id';

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'existing-member-id',
      userId: 'jwt-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.familyMember, 'findMany').mockResolvedValue([]);

    return request(app.getHttpServer())
      .get(`/families/${familyId}/members`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect([]);
  });

  it('/families/:id/members (GET) returns 404 when family does not exist', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'jwt-user-id' });

    jest
      .spyOn(prismaService.familyMember, 'findUnique')
      .mockResolvedValue(null);
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(null);

    return request(app.getHttpServer())
      .get('/families/missing-family-id/members')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('/families/:id/members (POST) rejects requests without JWT', () => {
    return request(app.getHttpServer())
      .post('/families/existing-family-id/members')
      .send({ userId: 'target-user-id' })
      .expect(401);
  });

  it('/families/:id/members (POST) adds a user as MEMBER for OWNER', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';
    const targetUser = {
      id: 'target-user-id',
      provider: 'GOOGLE' as const,
      providerId: 'google-target',
      email: 'target@example.com',
      displayName: 'Target User',
      profileImage: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    jest
      .spyOn(prismaService.familyMember, 'findUnique')
      .mockImplementation(
        (args: {
          where: { userId_familyId: { userId: string; familyId: string } };
        }) => {
          if (args.where.userId_familyId.userId === 'owner-user-id') {
            return Promise.resolve({
              id: 'owner-member-id',
              userId: 'owner-user-id',
              familyId,
              role: 'OWNER',
              joinedAt: new Date('2026-01-01T00:00:00.000Z'),
            });
          }

          return Promise.resolve(null);
        },
      );
    jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(targetUser);

    return request(app.getHttpServer())
      .post(`/families/${familyId}/members`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ userId: targetUser.id })
      .expect(201)
      .expect((response) => {
        expect(response.body).toEqual({
          id: 'new-added-member-id',
          userId: targetUser.id,
          familyId,
          role: 'MEMBER',
          joinedAt: '2026-01-01T00:00:00.000Z',
        });
      });
  });

  it('/families/:id/members (POST) returns 403 when user is MEMBER', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'member-user-id' });
    const family = {
      id: 'existing-family-id',
      name: '우리 가족',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'member-id',
      userId: 'member-user-id',
      familyId: family.id,
      role: 'MEMBER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(family);

    return request(app.getHttpServer())
      .post(`/families/${family.id}/members`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ userId: 'target-user-id' })
      .expect(403);
  });

  it('/families/:id/members (POST) returns 404 when family does not exist', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });

    jest
      .spyOn(prismaService.familyMember, 'findUnique')
      .mockResolvedValue(null);
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(null);

    return request(app.getHttpServer())
      .post('/families/missing-family-id/members')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ userId: 'target-user-id' })
      .expect(404);
  });

  it('/families/:id/members (POST) returns 404 when target user does not exist', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'owner-member-id',
      userId: 'owner-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);

    return request(app.getHttpServer())
      .post(`/families/${familyId}/members`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ userId: 'missing-user-id' })
      .expect(404);
  });

  it('/families/:id/members (POST) returns 409 when user is already a member', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';
    const targetUser = {
      id: 'target-user-id',
      provider: 'GOOGLE' as const,
      providerId: 'google-target',
      email: 'target@example.com',
      displayName: 'Target User',
      profileImage: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    jest
      .spyOn(prismaService.familyMember, 'findUnique')
      .mockImplementation(
        (args: {
          where: { userId_familyId: { userId: string; familyId: string } };
        }) => {
          if (args.where.userId_familyId.userId === 'owner-user-id') {
            return Promise.resolve({
              id: 'owner-member-id',
              userId: 'owner-user-id',
              familyId,
              role: 'OWNER',
              joinedAt: new Date('2026-01-01T00:00:00.000Z'),
            });
          }

          return Promise.resolve({
            id: 'existing-member-id',
            userId: targetUser.id,
            familyId,
            role: 'MEMBER',
            joinedAt: new Date('2026-01-01T00:00:00.000Z'),
          });
        },
      );
    jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(targetUser);

    return request(app.getHttpServer())
      .post(`/families/${familyId}/members`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ userId: targetUser.id })
      .expect(409);
  });

  it('/families/:id (PATCH) rejects requests without JWT', () => {
    return request(app.getHttpServer())
      .patch('/families/existing-family-id')
      .send({ name: '새 가족 이름' })
      .expect(401);
  });

  it('/families/:id (PATCH) updates family for OWNER', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'owner-member-id',
      userId: 'owner-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    return request(app.getHttpServer())
      .patch(`/families/${familyId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '새 가족 이름' })
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          id: familyId,
          name: '새 가족 이름',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-03T00:00:00.000Z',
        });
      });
  });

  it('/families/:id (PATCH) returns 403 when user is MEMBER', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'member-user-id' });
    const family = {
      id: 'existing-family-id',
      name: '우리 가족',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'member-id',
      userId: 'member-user-id',
      familyId: family.id,
      role: 'MEMBER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(family);

    return request(app.getHttpServer())
      .patch(`/families/${family.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '새 가족 이름' })
      .expect(403);
  });

  it('/families/:id (PATCH) returns 404 when family does not exist', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });

    jest
      .spyOn(prismaService.familyMember, 'findUnique')
      .mockResolvedValue(null);
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(null);

    return request(app.getHttpServer())
      .patch('/families/missing-family-id')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '새 가족 이름' })
      .expect(404);
  });

  it('/families/:id (PATCH) returns 400 for empty name', async () => {
    const jwtService = app.get(JwtService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });

    return request(app.getHttpServer())
      .patch('/families/existing-family-id')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '   ' })
      .expect(400);
  });

  it('/families/:id (DELETE) rejects requests without JWT', () => {
    return request(app.getHttpServer())
      .delete('/families/existing-family-id')
      .expect(401);
  });

  it('/families/:id (DELETE) deletes family for OWNER', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'owner-member-id',
      userId: 'owner-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    return request(app.getHttpServer())
      .delete(`/families/${familyId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);
  });

  it('/families/:id (DELETE) returns 403 when user is MEMBER', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'member-user-id' });
    const family = {
      id: 'existing-family-id',
      name: '우리 가족',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'member-id',
      userId: 'member-user-id',
      familyId: family.id,
      role: 'MEMBER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(family);

    return request(app.getHttpServer())
      .delete(`/families/${family.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('/families/:id (DELETE) returns 404 when family does not exist', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });

    jest
      .spyOn(prismaService.familyMember, 'findUnique')
      .mockResolvedValue(null);
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(null);

    return request(app.getHttpServer())
      .delete('/families/missing-family-id')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('/families/:familyId/pets (POST) rejects requests without JWT', () => {
    return request(app.getHttpServer())
      .post('/families/existing-family-id/pets')
      .send({
        name: '초코',
        gender: 'MALE',
        species: 'DOG',
        breed: '푸들',
      })
      .expect(401);
  });

  it('/families/:familyId/pets (POST) creates a pet for OWNER', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'owner-member-id',
      userId: 'owner-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.pet, 'findUnique').mockResolvedValue(null);

    return request(app.getHttpServer())
      .post(`/families/${familyId}/pets`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: '초코',
        birthDate: '2024-01-15T00:00:00.000Z',
        gender: 'MALE',
        species: 'DOG',
        breed: '푸들',
        registrationNumber: '123456789',
      })
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: 'new-pet-id',
          familyId,
          name: '초코',
          gender: 'MALE',
          species: 'DOG',
          breed: '푸들',
          registrationNumber: '123456789',
        });
      });
  });

  it('/families/:familyId/pets (POST) returns 403 when user is MEMBER', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'member-user-id' });
    const family = {
      id: 'existing-family-id',
      name: '우리 가족',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'member-id',
      userId: 'member-user-id',
      familyId: family.id,
      role: 'MEMBER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(family);

    return request(app.getHttpServer())
      .post(`/families/${family.id}/pets`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: '초코',
        gender: 'MALE',
        species: 'DOG',
        breed: '푸들',
      })
      .expect(403);
  });

  it('/families/:familyId/pets (POST) returns 404 when family does not exist', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });

    jest
      .spyOn(prismaService.familyMember, 'findUnique')
      .mockResolvedValue(null);
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(null);

    return request(app.getHttpServer())
      .post('/families/missing-family-id/pets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: '초코',
        gender: 'MALE',
        species: 'DOG',
        breed: '푸들',
      })
      .expect(404);
  });

  it('/families/:familyId/pets (POST) returns 409 when registrationNumber already exists', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'owner-member-id',
      userId: 'owner-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.pet, 'findUnique').mockResolvedValue({
      id: 'existing-pet-id',
      familyId,
      name: '초코',
      birthDate: new Date('2024-01-15T00:00:00.000Z'),
      gender: 'MALE',
      breed: '푸들',
      image: null,
      registrationNumber: '123456789',
    });

    return request(app.getHttpServer())
      .post(`/families/${familyId}/pets`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: '초코',
        gender: 'MALE',
        species: 'DOG',
        breed: '푸들',
        registrationNumber: '123456789',
      })
      .expect(409);
  });

  it('/families/:familyId/pets (POST) returns 400 for empty name', async () => {
    const jwtService = app.get(JwtService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });

    return request(app.getHttpServer())
      .post('/families/existing-family-id/pets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: '   ',
        gender: 'MALE',
        breed: '푸들',
      })
      .expect(400);
  });

  it('/families/:familyId/pets (GET) rejects requests without JWT', () => {
    return request(app.getHttpServer())
      .get('/families/existing-family-id/pets')
      .expect(401);
  });

  it('/families/:familyId/pets (GET) returns pets for OWNER', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';
    const pet = {
      id: 'pet-id',
      familyId,
      name: '초코',
      birthDate: new Date('2024-01-15T00:00:00.000Z'),
      gender: 'MALE' as const,
      breed: '푸들',
      image: null,
      registrationNumber: '123456789',
    };

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'owner-member-id',
      userId: 'owner-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.pet, 'findMany').mockResolvedValue([pet]);

    return request(app.getHttpServer())
      .get(`/families/${familyId}/pets`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual([
          {
            id: pet.id,
            familyId,
            name: pet.name,
            birthDate: pet.birthDate.toISOString(),
            gender: pet.gender,
            breed: pet.breed,
            image: null,
            registrationNumber: pet.registrationNumber,
          },
        ]);
      });
  });

  it('/families/:familyId/pets (GET) returns pets for MEMBER', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'member-user-id' });
    const familyId = 'existing-family-id';
    const pet = {
      id: 'pet-id',
      familyId,
      name: '초코',
      birthDate: null,
      gender: 'FEMALE' as const,
      breed: '푸들',
      image: null,
      registrationNumber: null,
    };

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'member-id',
      userId: 'member-user-id',
      familyId,
      role: 'MEMBER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.pet, 'findMany').mockResolvedValue([pet]);

    return request(app.getHttpServer())
      .get(`/families/${familyId}/pets`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual([
          {
            id: pet.id,
            familyId,
            name: pet.name,
            birthDate: null,
            gender: pet.gender,
            breed: pet.breed,
            image: null,
            registrationNumber: null,
          },
        ]);
      });
  });

  it('/families/:familyId/pets (GET) returns an empty array when family has no pets', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'owner-member-id',
      userId: 'owner-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.pet, 'findMany').mockResolvedValue([]);

    return request(app.getHttpServer())
      .get(`/families/${familyId}/pets`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect([]);
  });

  it('/families/:familyId/pets (GET) returns 403 when user is not a member', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'non-member-user-id' });
    const family = {
      id: 'existing-family-id',
      name: '우리 가족',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    jest
      .spyOn(prismaService.familyMember, 'findUnique')
      .mockResolvedValue(null);
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(family);

    return request(app.getHttpServer())
      .get(`/families/${family.id}/pets`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('/families/:familyId/pets (GET) returns 404 when family does not exist', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });

    jest
      .spyOn(prismaService.familyMember, 'findUnique')
      .mockResolvedValue(null);
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(null);

    return request(app.getHttpServer())
      .get('/families/missing-family-id/pets')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('/families/:familyId/pets/:petId (GET) rejects requests without JWT', () => {
    return request(app.getHttpServer())
      .get('/families/existing-family-id/pets/pet-id')
      .expect(401);
  });

  it('/families/:familyId/pets/:petId (GET) returns pet for OWNER', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';
    const pet = {
      id: 'pet-id',
      familyId,
      name: '초코',
      birthDate: new Date('2024-01-15T00:00:00.000Z'),
      gender: 'MALE' as const,
      breed: '푸들',
      image: 'https://example.com/choco.png',
      registrationNumber: '123456789',
    };

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'owner-member-id',
      userId: 'owner-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.pet, 'findFirst').mockResolvedValue(pet);

    return request(app.getHttpServer())
      .get(`/families/${familyId}/pets/${pet.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          id: pet.id,
          familyId,
          name: pet.name,
          birthDate: pet.birthDate.toISOString(),
          gender: pet.gender,
          breed: pet.breed,
          image: pet.image,
          registrationNumber: pet.registrationNumber,
        });
      });
  });

  it('/families/:familyId/pets/:petId (GET) returns pet for MEMBER', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'member-user-id' });
    const familyId = 'existing-family-id';
    const pet = {
      id: 'pet-id',
      familyId,
      name: '초코',
      birthDate: null,
      gender: 'FEMALE' as const,
      breed: '푸들',
      image: null,
      registrationNumber: '123456789',
    };

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'member-id',
      userId: 'member-user-id',
      familyId,
      role: 'MEMBER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.pet, 'findFirst').mockResolvedValue(pet);

    return request(app.getHttpServer())
      .get(`/families/${familyId}/pets/${pet.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          id: pet.id,
          familyId,
          name: pet.name,
          birthDate: null,
          gender: pet.gender,
          breed: pet.breed,
          image: null,
          registrationNumber: pet.registrationNumber,
        });
      });
  });

  it('/families/:familyId/pets/:petId (GET) returns 403 when user is not a member', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'non-member-user-id' });
    const family = {
      id: 'existing-family-id',
      name: '우리 가족',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    jest
      .spyOn(prismaService.familyMember, 'findUnique')
      .mockResolvedValue(null);
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(family);

    return request(app.getHttpServer())
      .get(`/families/${family.id}/pets/pet-id`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('/families/:familyId/pets/:petId (GET) returns 404 when family does not exist', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });

    jest
      .spyOn(prismaService.familyMember, 'findUnique')
      .mockResolvedValue(null);
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(null);

    return request(app.getHttpServer())
      .get('/families/missing-family-id/pets/pet-id')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('/families/:familyId/pets/:petId (GET) returns 404 when pet does not exist', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'owner-member-id',
      userId: 'owner-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.pet, 'findFirst').mockResolvedValue(null);

    return request(app.getHttpServer())
      .get(`/families/${familyId}/pets/missing-pet-id`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('/families/:familyId/pets/:petId (GET) returns 404 when pet belongs to another family', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'owner-member-id',
      userId: 'owner-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.pet, 'findFirst').mockResolvedValue(null);

    return request(app.getHttpServer())
      .get(`/families/${familyId}/pets/other-family-pet-id`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('/families/:familyId/pets/:petId (PATCH) rejects requests without JWT', () => {
    return request(app.getHttpServer())
      .patch('/families/existing-family-id/pets/pet-id')
      .send({ name: '새 이름' })
      .expect(401);
  });

  it('/families/:familyId/pets/:petId (PATCH) updates pet for OWNER', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';
    const pet = {
      id: 'pet-id',
      familyId,
      name: '초코',
      birthDate: new Date('2024-01-15T00:00:00.000Z'),
      gender: 'MALE' as const,
      breed: '푸들',
      image: 'https://example.com/choco.png',
      registrationNumber: '123456789',
    };
    const updatedPet = {
      ...pet,
      name: '새 이름',
    };

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'owner-member-id',
      userId: 'owner-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.pet, 'findFirst').mockResolvedValue(pet);
    jest.spyOn(prismaService.pet, 'update').mockResolvedValue(updatedPet);

    return request(app.getHttpServer())
      .patch(`/families/${familyId}/pets/${pet.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '새 이름' })
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          id: pet.id,
          familyId,
          name: '새 이름',
          birthDate: pet.birthDate.toISOString(),
          gender: pet.gender,
          breed: pet.breed,
          image: pet.image,
          registrationNumber: pet.registrationNumber,
        });
      });
  });

  it('/families/:familyId/pets/:petId (PATCH) returns 403 when user is MEMBER', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'member-user-id' });
    const family = {
      id: 'existing-family-id',
      name: '우리 가족',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'member-id',
      userId: 'member-user-id',
      familyId: family.id,
      role: 'MEMBER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(family);

    return request(app.getHttpServer())
      .patch(`/families/${family.id}/pets/pet-id`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '새 이름' })
      .expect(403);
  });

  it('/families/:familyId/pets/:petId (PATCH) returns 403 when user is not a member', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'non-member-user-id' });
    const family = {
      id: 'existing-family-id',
      name: '우리 가족',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    jest
      .spyOn(prismaService.familyMember, 'findUnique')
      .mockResolvedValue(null);
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(family);

    return request(app.getHttpServer())
      .patch(`/families/${family.id}/pets/pet-id`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '새 이름' })
      .expect(403);
  });

  it('/families/:familyId/pets/:petId (PATCH) returns 404 when family does not exist', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });

    jest
      .spyOn(prismaService.familyMember, 'findUnique')
      .mockResolvedValue(null);
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(null);

    return request(app.getHttpServer())
      .patch('/families/missing-family-id/pets/pet-id')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '새 이름' })
      .expect(404);
  });

  it('/families/:familyId/pets/:petId (PATCH) returns 404 when pet belongs to another family', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'owner-member-id',
      userId: 'owner-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.pet, 'findFirst').mockResolvedValue(null);

    return request(app.getHttpServer())
      .patch(`/families/${familyId}/pets/other-family-pet-id`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '새 이름' })
      .expect(404);
  });

  it('/families/:familyId/pets/:petId (PATCH) updates only name', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';
    const pet = {
      id: 'pet-id',
      familyId,
      name: '초코',
      birthDate: new Date('2024-01-15T00:00:00.000Z'),
      gender: 'MALE' as const,
      breed: '푸들',
      image: null,
      registrationNumber: '123456789',
    };
    const updatedPet = {
      ...pet,
      name: '새 이름',
    };

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'owner-member-id',
      userId: 'owner-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.pet, 'findFirst').mockResolvedValue(pet);
    const updateSpy = jest
      .spyOn(prismaService.pet, 'update')
      .mockResolvedValue(updatedPet);

    return request(app.getHttpServer())
      .patch(`/families/${familyId}/pets/${pet.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '새 이름' })
      .expect(200)
      .expect(() => {
        expect(updateSpy).toHaveBeenCalledWith({
          where: { id: pet.id },
          data: { name: '새 이름' },
        });
      });
  });

  it('/families/:familyId/pets/:petId (PATCH) updates multiple fields', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';
    const pet = {
      id: 'pet-id',
      familyId,
      name: '초코',
      birthDate: new Date('2024-01-15T00:00:00.000Z'),
      gender: 'MALE' as const,
      breed: '푸들',
      image: null,
      registrationNumber: '123456789',
    };
    const updatedPet = {
      ...pet,
      breed: '말티즈',
      image: 'https://example.com/new.png',
    };

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'owner-member-id',
      userId: 'owner-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.pet, 'findFirst').mockResolvedValue(pet);
    const updateSpy = jest
      .spyOn(prismaService.pet, 'update')
      .mockResolvedValue(updatedPet);

    return request(app.getHttpServer())
      .patch(`/families/${familyId}/pets/${pet.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        breed: '말티즈',
        image: 'https://example.com/new.png',
      })
      .expect(200)
      .expect(() => {
        expect(updateSpy).toHaveBeenCalledWith({
          where: { id: pet.id },
          data: {
            breed: '말티즈',
            image: 'https://example.com/new.png',
          },
        });
      });
  });

  it('/families/:familyId/pets/:petId (PATCH) returns 400 for empty name', async () => {
    const jwtService = app.get(JwtService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });

    return request(app.getHttpServer())
      .patch('/families/existing-family-id/pets/pet-id')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '   ' })
      .expect(400);
  });

  it('/families/:familyId/pets/:petId (PATCH) returns 400 for empty breed', async () => {
    const jwtService = app.get(JwtService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });

    return request(app.getHttpServer())
      .patch('/families/existing-family-id/pets/pet-id')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ breed: '' })
      .expect(400);
  });

  it('/families/:familyId/pets/:petId (PATCH) returns 409 when registrationNumber already exists', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';
    const pet = {
      id: 'pet-id',
      familyId,
      name: '초코',
      birthDate: new Date('2024-01-15T00:00:00.000Z'),
      gender: 'MALE' as const,
      breed: '푸들',
      image: null,
      registrationNumber: '123456789',
    };

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'owner-member-id',
      userId: 'owner-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.pet, 'findFirst').mockResolvedValue(pet);
    jest.spyOn(prismaService.pet, 'findUnique').mockResolvedValue({
      ...pet,
      id: 'other-pet-id',
      registrationNumber: '999999999',
    });

    return request(app.getHttpServer())
      .patch(`/families/${familyId}/pets/${pet.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ registrationNumber: '999999999' })
      .expect(409);
  });

  it('/families/:familyId/pets/:petId (PATCH) allows keeping the current registrationNumber', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';
    const pet = {
      id: 'pet-id',
      familyId,
      name: '초코',
      birthDate: new Date('2024-01-15T00:00:00.000Z'),
      gender: 'MALE' as const,
      breed: '푸들',
      image: null,
      registrationNumber: '123456789',
    };

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'owner-member-id',
      userId: 'owner-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.pet, 'findFirst').mockResolvedValue(pet);
    jest.spyOn(prismaService.pet, 'update').mockResolvedValue(pet);

    return request(app.getHttpServer())
      .patch(`/families/${familyId}/pets/${pet.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ registrationNumber: '123456789' })
      .expect(200)
      .expect((response) => {
        expect(response.body.registrationNumber).toBe('123456789');
      });
  });

  it('/families/:familyId/pets/:petId (PATCH) returns 400 for empty body', async () => {
    const jwtService = app.get(JwtService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });

    return request(app.getHttpServer())
      .patch('/families/existing-family-id/pets/pet-id')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(400);
  });

  it('/families/:familyId/pets/:petId (DELETE) rejects requests without JWT', () => {
    return request(app.getHttpServer())
      .delete('/families/existing-family-id/pets/pet-id')
      .expect(401);
  });

  it('/families/:familyId/pets/:petId (DELETE) deletes pet for OWNER', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';
    const pet = {
      id: 'pet-id',
      familyId,
      name: '초코',
      birthDate: new Date('2024-01-15T00:00:00.000Z'),
      gender: 'MALE' as const,
      breed: '푸들',
      image: null,
      registrationNumber: '123456789',
    };

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'owner-member-id',
      userId: 'owner-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.pet, 'findFirst').mockResolvedValue(pet);
    jest.spyOn(prismaService.pet, 'delete').mockResolvedValue(pet);

    return request(app.getHttpServer())
      .delete(`/families/${familyId}/pets/${pet.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);
  });

  it('/families/:familyId/pets/:petId (DELETE) returns 403 when user is MEMBER', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'member-user-id' });
    const family = {
      id: 'existing-family-id',
      name: '우리 가족',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'member-id',
      userId: 'member-user-id',
      familyId: family.id,
      role: 'MEMBER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(family);

    return request(app.getHttpServer())
      .delete(`/families/${family.id}/pets/pet-id`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('/families/:familyId/pets/:petId (DELETE) returns 403 when user is not a member', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'non-member-user-id' });
    const family = {
      id: 'existing-family-id',
      name: '우리 가족',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    jest
      .spyOn(prismaService.familyMember, 'findUnique')
      .mockResolvedValue(null);
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(family);

    return request(app.getHttpServer())
      .delete(`/families/${family.id}/pets/pet-id`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('/families/:familyId/pets/:petId (DELETE) returns 404 when family does not exist', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });

    jest
      .spyOn(prismaService.familyMember, 'findUnique')
      .mockResolvedValue(null);
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(null);

    return request(app.getHttpServer())
      .delete('/families/missing-family-id/pets/pet-id')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('/families/:familyId/pets/:petId (DELETE) returns 404 when pet does not exist', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'owner-member-id',
      userId: 'owner-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.pet, 'findFirst').mockResolvedValue(null);

    return request(app.getHttpServer())
      .delete(`/families/${familyId}/pets/missing-pet-id`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('/families/:familyId/pets/:petId (DELETE) returns 404 when pet belongs to another family', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'owner-member-id',
      userId: 'owner-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.pet, 'findFirst').mockResolvedValue(null);

    return request(app.getHttpServer())
      .delete(`/families/${familyId}/pets/other-family-pet-id`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('/families/:familyId/pets/:petId (DELETE) deletes the pet from the database', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });
    const familyId = 'existing-family-id';
    const pet = {
      id: 'pet-id',
      familyId,
      name: '초코',
      birthDate: new Date('2024-01-15T00:00:00.000Z'),
      gender: 'MALE' as const,
      breed: '푸들',
      image: null,
      registrationNumber: '123456789',
    };

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue({
      id: 'owner-member-id',
      userId: 'owner-user-id',
      familyId,
      role: 'OWNER',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    jest.spyOn(prismaService.pet, 'findFirst').mockResolvedValue(pet);
    const deleteSpy = jest
      .spyOn(prismaService.pet, 'delete')
      .mockResolvedValue(pet);

    return request(app.getHttpServer())
      .delete(`/families/${familyId}/pets/${pet.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204)
      .expect(() => {
        expect(deleteSpy).toHaveBeenCalledTimes(1);
        expect(deleteSpy).toHaveBeenCalledWith({
          where: { id: pet.id },
        });
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
