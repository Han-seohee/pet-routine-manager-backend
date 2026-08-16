jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let jwtStrategy: JwtStrategy;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') {
                return 'test-jwt-secret';
              }

              throw new Error(`Missing config: ${key}`);
            }),
          },
        },
      ],
    }).compile();

    jwtStrategy = app.get<JwtStrategy>(JwtStrategy);
  });

  describe('validate', () => {
    it('should return authenticated user from JWT payload', () => {
      expect(jwtStrategy.validate({ sub: 'user-id' })).toEqual({
        userId: 'user-id',
      });
    });
  });
});
