jest.mock('../src/prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({
    onModuleInit: jest.fn().mockResolvedValue(undefined),
    onModuleDestroy: jest.fn().mockResolvedValue(undefined),
    pingDatabase: jest.fn().mockResolvedValue(undefined),
  })),
}));

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

  afterEach(async () => {
    await app.close();
  });
});
