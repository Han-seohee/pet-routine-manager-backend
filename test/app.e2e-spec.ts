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
        },
      };

      return callback(tx);
    }),
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

  afterEach(async () => {
    await app.close();
  });
});
