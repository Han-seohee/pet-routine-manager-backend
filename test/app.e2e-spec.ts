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
      .mockImplementation((args: { where: { userId_familyId: { userId: string; familyId: string } } }) => {
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
      });
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

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue(null);
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
      .mockImplementation((args: { where: { userId_familyId: { userId: string; familyId: string } } }) => {
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
      });
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

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue(null);
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

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue(null);
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
        breed: '푸들',
      })
      .expect(403);
  });

  it('/families/:familyId/pets (POST) returns 404 when family does not exist', async () => {
    const jwtService = app.get(JwtService);
    const prismaService = app.get(PrismaService);
    const accessToken = jwtService.sign({ sub: 'owner-user-id' });

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue(null);
    jest.spyOn(prismaService.family, 'findUnique').mockResolvedValue(null);

    return request(app.getHttpServer())
      .post('/families/missing-family-id/pets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: '초코',
        gender: 'MALE',
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

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue(null);
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

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue(null);
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

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue(null);
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

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue(null);
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

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue(null);
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

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue(null);
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

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue(null);
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

    jest.spyOn(prismaService.familyMember, 'findUnique').mockResolvedValue(null);
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
