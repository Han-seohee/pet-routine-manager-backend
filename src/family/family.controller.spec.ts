jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { FamilyController } from './family.controller';
import { FamilyService } from './family.service';

describe('FamilyController', () => {
  let familyController: FamilyController;
  let familyService: {
    createFamily: jest.Mock;
    findMyFamilies: jest.Mock;
    findFamilyById: jest.Mock;
    findFamilyMembers: jest.Mock;
  };

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
      findMyFamilies: jest.fn(),
      findFamilyById: jest.fn(),
      findFamilyMembers: jest.fn(),
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

  describe('findMyFamilies', () => {
    const myFamiliesResult = [
      {
        family: {
          id: 'family-id',
          name: '우리 가족',
          createdAt,
          updatedAt,
        },
        role: 'OWNER' as const,
      },
    ];

    it('should pass authenticated userId to FamilyService and return the result', async () => {
      familyService.findMyFamilies.mockResolvedValue(myFamiliesResult);

      await expect(
        familyController.findMyFamilies({
          user: { userId: 'user-id' },
        } as Parameters<FamilyController['findMyFamilies']>[0]),
      ).resolves.toEqual(myFamiliesResult);

      expect(familyService.findMyFamilies).toHaveBeenCalledWith('user-id');
    });
  });

  describe('findFamilyById', () => {
    const familyDetailResult = {
      id: 'family-id',
      name: '우리 가족',
      createdAt,
      updatedAt,
    };

    it('should pass authenticated userId and family id to FamilyService', async () => {
      familyService.findFamilyById.mockResolvedValue(familyDetailResult);

      await expect(
        familyController.findFamilyById(
          { user: { userId: 'user-id' } } as Parameters<
            FamilyController['findFamilyById']
          >[0],
          'family-id',
        ),
      ).resolves.toEqual(familyDetailResult);

      expect(familyService.findFamilyById).toHaveBeenCalledWith(
        'user-id',
        'family-id',
      );
    });
  });

  describe('findFamilyMembers', () => {
    const familyMembersResult = [
      {
        userId: 'user-id',
        displayName: 'Test User',
        profileImage: 'https://example.com/avatar.png',
        role: 'OWNER' as const,
      },
    ];

    it('should pass authenticated userId and family id to FamilyService', async () => {
      familyService.findFamilyMembers.mockResolvedValue(familyMembersResult);

      await expect(
        familyController.findFamilyMembers(
          { user: { userId: 'user-id' } } as Parameters<
            FamilyController['findFamilyMembers']
          >[0],
          'family-id',
        ),
      ).resolves.toEqual(familyMembersResult);

      expect(familyService.findFamilyMembers).toHaveBeenCalledWith(
        'user-id',
        'family-id',
      );
    });
  });
});
