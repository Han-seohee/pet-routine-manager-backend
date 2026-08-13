jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({
    pingDatabase: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let healthController: HealthController;
  let prismaService: { pingDatabase: jest.Mock };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [PrismaService],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
    prismaService = app.get(PrismaService);
  });

  describe('health', () => {
    it('should return status ok', () => {
      expect(healthController.getHealth()).toEqual({ status: 'ok' });
    });
  });

  describe('health/db', () => {
    it('should return database connected status', async () => {
      await expect(healthController.getDatabaseHealth()).resolves.toEqual({
        status: 'ok',
        database: 'connected',
      });
      expect(prismaService.pingDatabase).toHaveBeenCalled();
    });
  });
});
