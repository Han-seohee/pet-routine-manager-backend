jest.mock('../src/prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({
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
      };

      return callback(tx);
    }),
    familyMember: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    family: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  })),
}));

process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ?? 'test-google-client-secret';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';
process.env.KAKAO_CLIENT_ID =
  process.env.KAKAO_CLIENT_ID ?? 'test-kakao-client-id';

import { JwtService } from '@nestjs/jwt';

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

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue(null);
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

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue(null);
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

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue(null);
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

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue(null);
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(null);

    return request(app.getHttpServer())
      .get('/families/missing-family-id/members')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  afterEach(async () => {
    await app.close();
  });
});
