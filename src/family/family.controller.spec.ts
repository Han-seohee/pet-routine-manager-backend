jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { FamilyController } from './family.controller';
import { FamilyService } from './family.service';

describe('FamilyController', () => {
  let familyController: FamilyController;
  let familyService: { createFamily: jest.Mock };

  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const updatedAt = new Date('2026-01-02T00:00:00.000Z');
  const joinedAt = new Date('2026-01-01T00:00:00.000Z');

  const createFamilyResult = {
    family: {
      id: 'family-id',
      name: '우리 가족',
      createdAt,
      updatedAt,
    },
    member: {
      id: 'member-id',
      userId: 'user-id',
      familyId: 'family-id',
      role: 'OWNER' as const,
      joinedAt,
    },
  };

  beforeEach(async () => {
    familyService = {
      createFamily: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [FamilyController],
      providers: [
        {
          provide: FamilyService,
          useValue: familyService,
        },
      ],
    }).compile();

    familyController = app.get<FamilyController>(FamilyController);
  });

  describe('createFamily', () => {
    it('should pass authenticated userId and dto to FamilyService', async () => {
      familyService.createFamily.mockResolvedValue(createFamilyResult);

      await expect(
        familyController.createFamily(
          { user: { userId: 'user-id' } } as Parameters<
            FamilyController['createFamily']
          >[0],
          { name: '우리 가족' },
        ),
      ).resolves.toEqual(createFamilyResult);

      expect(familyService.createFamily).toHaveBeenCalledWith('user-id', {
        name: '우리 가족',
      });
    });
  });
});
