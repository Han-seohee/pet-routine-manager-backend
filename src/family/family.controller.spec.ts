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
    updateFamily: jest.Mock;
    deleteFamily: jest.Mock;
    addFamilyMember: jest.Mock;
    removeFamilyMember: jest.Mock;
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
      updateFamily: jest.fn(),
      deleteFamily: jest.fn(),
      addFamilyMember: jest.fn(),
      removeFamilyMember: jest.fn(),
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

  describe('updateFamily', () => {
    const familyDetailResult = {
      id: 'family-id',
      name: '새 가족 이름',
      createdAt,
      updatedAt,
    };

    it('should pass authenticated userId, family id, and dto to FamilyService', async () => {
      familyService.updateFamily.mockResolvedValue(familyDetailResult);

      await expect(
        familyController.updateFamily(
          { user: { userId: 'user-id' } } as Parameters<
            FamilyController['updateFamily']
          >[0],
          'family-id',
          { name: '새 가족 이름' },
        ),
      ).resolves.toEqual(familyDetailResult);

      expect(familyService.updateFamily).toHaveBeenCalledWith(
        'user-id',
        'family-id',
        { name: '새 가족 이름' },
      );
    });
  });

  describe('deleteFamily', () => {
    it('should pass authenticated userId and family id to FamilyService', async () => {
      familyService.deleteFamily.mockResolvedValue(undefined);

      await expect(
        familyController.deleteFamily(
          { user: { userId: 'user-id' } } as Parameters<
            FamilyController['deleteFamily']
          >[0],
          'family-id',
        ),
      ).resolves.toBeUndefined();

      expect(familyService.deleteFamily).toHaveBeenCalledWith(
        'user-id',
        'family-id',
      );
    });
  });

  describe('addFamilyMember', () => {
    const addFamilyMemberResult = {
      id: 'new-member-id',
      userId: 'target-user-id',
      familyId: 'family-id',
      role: 'MEMBER' as const,
      joinedAt,
    };

    it('should pass authenticated userId, family id, and dto.userId to FamilyService', async () => {
      familyService.addFamilyMember.mockResolvedValue(addFamilyMemberResult);

      await expect(
        familyController.addFamilyMember(
          { user: { userId: 'owner-user-id' } } as Parameters<
            FamilyController['addFamilyMember']
          >[0],
          'family-id',
          { userId: 'target-user-id' },
        ),
      ).resolves.toEqual(addFamilyMemberResult);

      expect(familyService.addFamilyMember).toHaveBeenCalledWith(
        'owner-user-id',
        'family-id',
        'target-user-id',
      );
    });
  });

  describe('removeFamilyMember', () => {
    it('should pass authenticated userId, family id, and target userId to FamilyService', async () => {
      familyService.removeFamilyMember.mockResolvedValue(undefined);

      await expect(
        familyController.removeFamilyMember(
          { user: { userId: 'owner-user-id' } } as Parameters<
            FamilyController['removeFamilyMember']
          >[0],
          'family-id',
          'target-user-id',
        ),
      ).resolves.toBeUndefined();

      expect(familyService.removeFamilyMember).toHaveBeenCalledWith(
        'owner-user-id',
        'family-id',
        'target-user-id',
      );
    });
  });
});
