jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { FamilyService } from './family.service';

describe('FamilyService', () => {
  let familyService: FamilyService;
  let prismaService: {
    $transaction: jest.Mock;
    familyMember: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
    family: { findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
    user: { findUnique: jest.Mock };
  };
  let transactionClient: {
    family: { create: jest.Mock };
    familyMember: { create: jest.Mock };
  };

  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const updatedAt = new Date('2026-01-02T00:00:00.000Z');
  const joinedAt = new Date('2026-01-01T00:00:00.000Z');

  beforeEach(async () => {
    transactionClient = {
      family: {
        create: jest.fn(),
      },
      familyMember: {
        create: jest.fn(),
      },
    };

    prismaService = {
      $transaction: jest.fn((callback) => callback(transactionClient)),
      familyMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      family: {
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    familyService = app.get<FamilyService>(FamilyService);
  });

  describe('createFamily', () => {
    it('should create a family and owner member in a transaction', async () => {
      const family = {
        id: 'family-id',
        name: '우리 가족',
        createdAt,
        updatedAt,
      };
      const member = {
        id: 'member-id',
        userId: 'user-id',
        familyId: family.id,
        role: 'OWNER' as const,
        joinedAt,
      };

      transactionClient.family.create.mockResolvedValue(family);
      transactionClient.familyMember.create.mockResolvedValue(member);

      await expect(
        familyService.createFamily('user-id', { name: '우리 가족' }),
      ).resolves.toEqual({ family, member });

      expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(transactionClient.family.create).toHaveBeenCalledWith({
        data: { name: '우리 가족' },
      });
      expect(transactionClient.familyMember.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-id',
          familyId: family.id,
          role: 'OWNER',
        },
      });
    });

    it('should assign OWNER role to the creating user', async () => {
      const family = {
        id: 'family-id',
        name: 'Test Family',
        createdAt,
        updatedAt,
      };
      const member = {
        id: 'member-id',
        userId: 'creator-id',
        familyId: family.id,
        role: 'OWNER' as const,
        joinedAt,
      };

      transactionClient.family.create.mockResolvedValue(family);
      transactionClient.familyMember.create.mockResolvedValue(member);

      const result = await familyService.createFamily('creator-id', {
        name: 'Test Family',
      });

      expect(result.member.role).toBe('OWNER');
      expect(result.member.userId).toBe('creator-id');
    });

    it('should reject empty family names', async () => {
      await expect(
        familyService.createFamily('user-id', { name: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('findMyFamilies', () => {
    it('should return families with roles for the given userId', async () => {
      const family = {
        id: 'family-id',
        name: '우리 가족',
        createdAt,
        updatedAt,
      };

      prismaService.familyMember.findMany.mockResolvedValue([
        {
          id: 'member-id',
          userId: 'user-id',
          familyId: family.id,
          role: 'OWNER',
          joinedAt,
          family,
        },
      ]);

      await expect(familyService.findMyFamilies('user-id')).resolves.toEqual([
        {
          family: {
            id: family.id,
            name: family.name,
            createdAt: family.createdAt,
            updatedAt: family.updatedAt,
          },
          role: 'OWNER',
        },
      ]);

      expect(prismaService.familyMember.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
        include: { family: true },
      });
    });

    it('should include family data from the FamilyMember relation', async () => {
      const family = {
        id: 'family-id-2',
        name: 'Second Family',
        createdAt,
        updatedAt,
      };

      prismaService.familyMember.findMany.mockResolvedValue([
        {
          id: 'member-id-2',
          userId: 'user-id',
          familyId: family.id,
          role: 'MEMBER',
          joinedAt,
          family,
        },
      ]);

      const result = await familyService.findMyFamilies('user-id');

      expect(result[0].family).toEqual({
        id: family.id,
        name: family.name,
        createdAt: family.createdAt,
        updatedAt: family.updatedAt,
      });
      expect(result[0].role).toBe('MEMBER');
    });

    it('should return an empty array when the user has no families', async () => {
      prismaService.familyMember.findMany.mockResolvedValue([]);

      await expect(familyService.findMyFamilies('user-id')).resolves.toEqual(
        [],
      );
    });
  });

  describe('findFamilyById', () => {
    const family = {
      id: 'family-id',
      name: '우리 가족',
      createdAt,
      updatedAt,
    };

    it('should return family when user is a member', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue({
        id: 'member-id',
        userId: 'user-id',
        familyId: family.id,
        role: 'OWNER',
        joinedAt,
        family,
      });

      await expect(
        familyService.findFamilyById('user-id', 'family-id'),
      ).resolves.toEqual(family);

      expect(prismaService.familyMember.findUnique).toHaveBeenCalledWith({
        where: {
          userId_familyId: { userId: 'user-id', familyId: 'family-id' },
        },
        include: { family: true },
      });
      expect(prismaService.family.findUnique).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(null);
      prismaService.family.findUnique.mockResolvedValue(family);

      await expect(
        familyService.findFamilyById('other-user-id', 'family-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prismaService.family.findUnique).toHaveBeenCalledWith({
        where: { id: 'family-id' },
      });
    });

    it('should throw NotFoundException when family does not exist', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(null);
      prismaService.family.findUnique.mockResolvedValue(null);

      await expect(
        familyService.findFamilyById('user-id', 'missing-family-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should query with both userId and familyId', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue({
        id: 'member-id',
        userId: 'user-id',
        familyId: family.id,
        role: 'MEMBER',
        joinedAt,
        family,
      });

      const result = await familyService.findFamilyById('user-id', family.id);

      expect(result).toEqual(family);
      expect(prismaService.familyMember.findUnique).toHaveBeenCalledWith({
        where: {
          userId_familyId: { userId: 'user-id', familyId: family.id },
        },
        include: { family: true },
      });
    });
  });

  describe('findFamilyMembers', () => {
    const family = {
      id: 'family-id',
      name: '우리 가족',
      createdAt,
      updatedAt,
    };

    it('should return members with user info and role for a family member', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue({
        id: 'member-id',
        userId: 'user-id',
        familyId: family.id,
        role: 'OWNER',
        joinedAt,
      });
      prismaService.familyMember.findMany.mockResolvedValue([
        {
          id: 'member-id',
          userId: 'user-id',
          familyId: family.id,
          role: 'OWNER',
          joinedAt,
          user: {
            id: 'user-id',
            displayName: 'Test User',
            profileImage: 'https://example.com/avatar.png',
          },
        },
        {
          id: 'member-id-2',
          userId: 'other-user-id',
          familyId: family.id,
          role: 'MEMBER',
          joinedAt,
          user: {
            id: 'other-user-id',
            displayName: 'Other User',
            profileImage: null,
          },
        },
      ]);

      await expect(
        familyService.findFamilyMembers('user-id', 'family-id'),
      ).resolves.toEqual([
        {
          userId: 'user-id',
          displayName: 'Test User',
          profileImage: 'https://example.com/avatar.png',
          role: 'OWNER',
        },
        {
          userId: 'other-user-id',
          displayName: 'Other User',
          profileImage: null,
          role: 'MEMBER',
        },
      ]);

      expect(prismaService.familyMember.findUnique).toHaveBeenCalledWith({
        where: {
          userId_familyId: { userId: 'user-id', familyId: 'family-id' },
        },
      });
      expect(prismaService.familyMember.findMany).toHaveBeenCalledWith({
        where: { familyId: 'family-id' },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              profileImage: true,
            },
          },
        },
      });
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(null);
      prismaService.family.findUnique.mockResolvedValue(family);

      await expect(
        familyService.findFamilyMembers('other-user-id', 'family-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prismaService.familyMember.findMany).not.toHaveBeenCalled();
    });

    it('should return an empty array when family has no members', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue({
        id: 'member-id',
        userId: 'user-id',
        familyId: family.id,
        role: 'OWNER',
        joinedAt,
      });
      prismaService.familyMember.findMany.mockResolvedValue([]);

      await expect(
        familyService.findFamilyMembers('user-id', 'family-id'),
      ).resolves.toEqual([]);
    });

    it('should select only required user fields', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue({
        id: 'member-id',
        userId: 'user-id',
        familyId: family.id,
        role: 'MEMBER',
        joinedAt,
      });
      prismaService.familyMember.findMany.mockResolvedValue([
        {
          id: 'member-id',
          userId: 'user-id',
          familyId: family.id,
          role: 'MEMBER',
          joinedAt,
          user: {
            id: 'user-id',
            displayName: 'Test User',
            profileImage: null,
          },
        },
      ]);

      const result = await familyService.findFamilyMembers(
        'user-id',
        family.id,
      );

      expect(result[0]).toEqual({
        userId: 'user-id',
        displayName: 'Test User',
        profileImage: null,
        role: 'MEMBER',
      });
      expect(Object.keys(result[0])).toEqual([
        'userId',
        'displayName',
        'profileImage',
        'role',
      ]);
    });
  });

  describe('updateFamily', () => {
    const family = {
      id: 'family-id',
      name: '우리 가족',
      createdAt,
      updatedAt,
    };

    it('should update family when user is OWNER', async () => {
      const updatedFamily = {
        ...family,
        name: '새 가족 이름',
        updatedAt: new Date('2026-01-03T00:00:00.000Z'),
      };

      prismaService.familyMember.findUnique.mockResolvedValue({
        id: 'member-id',
        userId: 'user-id',
        familyId: family.id,
        role: 'OWNER',
        joinedAt,
      });
      prismaService.family.update.mockResolvedValue(updatedFamily);

      await expect(
        familyService.updateFamily('user-id', 'family-id', {
          name: '새 가족 이름',
        }),
      ).resolves.toEqual(updatedFamily);

      expect(prismaService.family.update).toHaveBeenCalledWith({
        where: { id: 'family-id' },
        data: { name: '새 가족 이름' },
      });
    });

    it('should throw ForbiddenException when user is MEMBER', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue({
        id: 'member-id',
        userId: 'user-id',
        familyId: family.id,
        role: 'MEMBER',
        joinedAt,
      });
      prismaService.family.findUnique.mockResolvedValue(family);

      await expect(
        familyService.updateFamily('user-id', 'family-id', {
          name: 'New Name',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prismaService.family.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when family does not exist', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(null);
      prismaService.family.findUnique.mockResolvedValue(null);

      await expect(
        familyService.updateFamily('user-id', 'missing-family-id', {
          name: 'New Name',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.family.update).not.toHaveBeenCalled();
    });

    it('should reject empty family names', async () => {
      await expect(
        familyService.updateFamily('user-id', 'family-id', { name: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaService.familyMember.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('deleteFamily', () => {
    const family = {
      id: 'family-id',
      name: '우리 가족',
      createdAt,
      updatedAt,
    };

    it('should delete family when user is OWNER', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue({
        id: 'member-id',
        userId: 'user-id',
        familyId: family.id,
        role: 'OWNER',
        joinedAt,
      });
      prismaService.family.delete.mockResolvedValue(family);

      await expect(
        familyService.deleteFamily('user-id', 'family-id'),
      ).resolves.toBeUndefined();

      expect(prismaService.family.delete).toHaveBeenCalledWith({
        where: { id: 'family-id' },
      });
    });

    it('should throw ForbiddenException when user is MEMBER', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue({
        id: 'member-id',
        userId: 'user-id',
        familyId: family.id,
        role: 'MEMBER',
        joinedAt,
      });
      prismaService.family.findUnique.mockResolvedValue(family);

      await expect(
        familyService.deleteFamily('user-id', 'family-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prismaService.family.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when family does not exist', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(null);
      prismaService.family.findUnique.mockResolvedValue(null);

      await expect(
        familyService.deleteFamily('user-id', 'missing-family-id'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.family.delete).not.toHaveBeenCalled();
    });
  });

  describe('addFamilyMember', () => {
    const family = {
      id: 'family-id',
      name: '우리 가족',
      createdAt,
      updatedAt,
    };

    const targetUser = {
      id: 'target-user-id',
      provider: 'GOOGLE' as const,
      providerId: 'google-target',
      email: 'target@example.com',
      displayName: 'Target User',
      profileImage: null,
      createdAt,
      updatedAt,
    };

    it('should add a user as MEMBER when requester is OWNER', async () => {
      const createdMember = {
        id: 'new-member-id',
        userId: targetUser.id,
        familyId: family.id,
        role: 'MEMBER' as const,
        joinedAt,
      };

      prismaService.familyMember.findUnique
        .mockResolvedValueOnce({
          id: 'owner-member-id',
          userId: 'owner-user-id',
          familyId: family.id,
          role: 'OWNER',
          joinedAt,
        })
        .mockResolvedValueOnce(null);
      prismaService.user.findUnique.mockResolvedValue(targetUser);
      prismaService.familyMember.create.mockResolvedValue(createdMember);

      await expect(
        familyService.addFamilyMember(
          'owner-user-id',
          family.id,
          targetUser.id,
        ),
      ).resolves.toEqual(createdMember);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: targetUser.id },
      });
      expect(prismaService.familyMember.create).toHaveBeenCalledWith({
        data: {
          userId: targetUser.id,
          familyId: family.id,
          role: 'MEMBER',
        },
      });
    });

    it('should throw ForbiddenException when requester is MEMBER', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue({
        id: 'member-id',
        userId: 'member-user-id',
        familyId: family.id,
        role: 'MEMBER',
        joinedAt,
      });
      prismaService.family.findUnique.mockResolvedValue(family);

      await expect(
        familyService.addFamilyMember(
          'member-user-id',
          family.id,
          targetUser.id,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
      expect(prismaService.familyMember.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when family does not exist', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(null);
      prismaService.family.findUnique.mockResolvedValue(null);

      await expect(
        familyService.addFamilyMember(
          'owner-user-id',
          'missing-family-id',
          targetUser.id,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
      expect(prismaService.familyMember.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when target user does not exist', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue({
        id: 'owner-member-id',
        userId: 'owner-user-id',
        familyId: family.id,
        role: 'OWNER',
        joinedAt,
      });
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        familyService.addFamilyMember(
          'owner-user-id',
          family.id,
          'missing-user-id',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.familyMember.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when user is already a member', async () => {
      prismaService.familyMember.findUnique
        .mockResolvedValueOnce({
          id: 'owner-member-id',
          userId: 'owner-user-id',
          familyId: family.id,
          role: 'OWNER',
          joinedAt,
        })
        .mockResolvedValueOnce({
          id: 'existing-member-id',
          userId: targetUser.id,
          familyId: family.id,
          role: 'MEMBER',
          joinedAt,
        });
      prismaService.user.findUnique.mockResolvedValue(targetUser);

      await expect(
        familyService.addFamilyMember(
          'owner-user-id',
          family.id,
          targetUser.id,
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prismaService.familyMember.create).not.toHaveBeenCalled();
    });

    it('should create FamilyMember with MEMBER role', async () => {
      prismaService.familyMember.findUnique
        .mockResolvedValueOnce({
          id: 'owner-member-id',
          userId: 'owner-user-id',
          familyId: family.id,
          role: 'OWNER',
          joinedAt,
        })
        .mockResolvedValueOnce(null);
      prismaService.user.findUnique.mockResolvedValue(targetUser);
      prismaService.familyMember.create.mockResolvedValue({
        id: 'new-member-id',
        userId: targetUser.id,
        familyId: family.id,
        role: 'MEMBER',
        joinedAt,
      });

      const result = await familyService.addFamilyMember(
        'owner-user-id',
        family.id,
        targetUser.id,
      );

      expect(result.role).toBe('MEMBER');
    });

    it('should create FamilyMember with the correct userId and familyId', async () => {
      prismaService.familyMember.findUnique
        .mockResolvedValueOnce({
          id: 'owner-member-id',
          userId: 'owner-user-id',
          familyId: family.id,
          role: 'OWNER',
          joinedAt,
        })
        .mockResolvedValueOnce(null);
      prismaService.user.findUnique.mockResolvedValue(targetUser);
      prismaService.familyMember.create.mockResolvedValue({
        id: 'new-member-id',
        userId: targetUser.id,
        familyId: family.id,
        role: 'MEMBER',
        joinedAt,
      });

      await familyService.addFamilyMember(
        'owner-user-id',
        family.id,
        targetUser.id,
      );

      expect(prismaService.familyMember.create).toHaveBeenCalledWith({
        data: {
          userId: targetUser.id,
          familyId: family.id,
          role: 'MEMBER',
        },
      });
    });
  });

  describe('removeFamilyMember', () => {
    const family = {
      id: 'family-id',
      name: '우리 가족',
      createdAt,
      updatedAt,
    };

    const targetMember = {
      id: 'member-id',
      userId: 'target-user-id',
      familyId: family.id,
      role: 'MEMBER' as const,
      joinedAt,
    };

    it('should remove a MEMBER when requester is OWNER', async () => {
      prismaService.familyMember.findUnique
        .mockResolvedValueOnce({
          id: 'owner-member-id',
          userId: 'owner-user-id',
          familyId: family.id,
          role: 'OWNER',
          joinedAt,
        })
        .mockResolvedValueOnce(targetMember);
      prismaService.familyMember.delete.mockResolvedValue(targetMember);

      await expect(
        familyService.removeFamilyMember(
          'owner-user-id',
          family.id,
          targetMember.userId,
        ),
      ).resolves.toBeUndefined();

      expect(prismaService.familyMember.delete).toHaveBeenCalledWith({
        where: {
          userId_familyId: {
            userId: targetMember.userId,
            familyId: family.id,
          },
        },
      });
    });

    it('should throw ForbiddenException when requester is MEMBER', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue({
        id: 'member-id',
        userId: 'member-user-id',
        familyId: family.id,
        role: 'MEMBER',
        joinedAt,
      });
      prismaService.family.findUnique.mockResolvedValue(family);

      await expect(
        familyService.removeFamilyMember(
          'member-user-id',
          family.id,
          targetMember.userId,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prismaService.familyMember.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when FamilyMember does not exist', async () => {
      prismaService.familyMember.findUnique
        .mockResolvedValueOnce({
          id: 'owner-member-id',
          userId: 'owner-user-id',
          familyId: family.id,
          role: 'OWNER',
          joinedAt,
        })
        .mockResolvedValueOnce(null);

      await expect(
        familyService.removeFamilyMember(
          'owner-user-id',
          family.id,
          'missing-user-id',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.familyMember.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when OWNER tries to remove themselves', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue({
        id: 'owner-member-id',
        userId: 'owner-user-id',
        familyId: family.id,
        role: 'OWNER',
        joinedAt,
      });

      await expect(
        familyService.removeFamilyMember(
          'owner-user-id',
          family.id,
          'owner-user-id',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaService.familyMember.delete).not.toHaveBeenCalled();
    });

    it('should delete only FamilyMember and not the User record', async () => {
      prismaService.familyMember.findUnique
        .mockResolvedValueOnce({
          id: 'owner-member-id',
          userId: 'owner-user-id',
          familyId: family.id,
          role: 'OWNER',
          joinedAt,
        })
        .mockResolvedValueOnce(targetMember);
      prismaService.familyMember.delete.mockResolvedValue(targetMember);

      await familyService.removeFamilyMember(
        'owner-user-id',
        family.id,
        targetMember.userId,
      );

      expect(prismaService.familyMember.delete).toHaveBeenCalledTimes(1);
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });
  });
});
