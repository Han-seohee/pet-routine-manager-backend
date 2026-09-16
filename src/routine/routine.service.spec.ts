jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FamilyService } from '../family/family.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoutineService } from './routine.service';

describe('RoutineService', () => {
  let routineService: RoutineService;
  let prismaService: {
    familyMember: { findUnique: jest.Mock };
    family: { findUnique: jest.Mock };
    pet: { findUnique: jest.Mock };
    category: { findFirst: jest.Mock };
    subCategory: { findFirst: jest.Mock };
    routine: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const joinedAt = new Date('2026-01-01T00:00:00.000Z');
  const family = {
    id: 'family-id',
    name: '우리 가족',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };
  const ownerMembership = {
    id: 'member-id',
    userId: 'user-id',
    familyId: family.id,
    role: 'OWNER' as const,
    joinedAt,
  };
  const memberMembership = {
    ...ownerMembership,
    role: 'MEMBER' as const,
  };
  const pet = {
    id: 'pet-id',
    familyId: family.id,
    name: '라봉',
    birthDate: null,
    gender: 'MALE' as const,
    breed: '푸들',
    image: null,
    registrationNumber: null,
  };
  const category = {
    id: 'category-id',
    petId: pet.id,
    name: '밥',
  };
  const walkCategory = {
    id: 'walk-category-id',
    petId: pet.id,
    name: '산책',
  };
  const subCategory = {
    id: 'sub-category-id',
    categoryId: category.id,
    name: '사료',
  };
  const recordedAt = new Date('2026-09-16T04:10:00.000Z');
  const recordedAtIso = '2026-09-16T04:10:00.000Z';
  const routineInclude = {
    user: { select: { displayName: true } },
    category: { select: { name: true } },
    subCategory: { select: { name: true } },
  };
  const createdRoutine = {
    id: 'routine-id',
    petId: pet.id,
    userId: 'user-id',
    categoryId: category.id,
    subCategoryId: subCategory.id,
    recordedAt,
    memo: '아침 사료를 잘 먹음',
    user: { displayName: '나' },
    category: { name: '밥' },
    subCategory: { name: '사료' },
  };

  beforeEach(async () => {
    prismaService = {
      familyMember: {
        findUnique: jest.fn(),
      },
      family: {
        findUnique: jest.fn(),
      },
      pet: {
        findUnique: jest.fn(),
      },
      category: {
        findFirst: jest.fn(),
      },
      subCategory: {
        findFirst: jest.fn(),
      },
      routine: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        RoutineService,
        FamilyService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    routineService = app.get<RoutineService>(RoutineService);
  });

  describe('createRoutine', () => {
    it('should create a routine with category only and the provided recordedAt', async () => {
      const walkRoutine = {
        ...createdRoutine,
        categoryId: walkCategory.id,
        subCategoryId: null,
        memo: null,
        category: { name: '산책' },
        subCategory: null,
      };

      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findFirst.mockResolvedValue(walkCategory);
      prismaService.routine.create.mockResolvedValue(walkRoutine);

      await expect(
        routineService.createRoutine('user-id', 'pet-id', {
          categoryId: 'walk-category-id',
          recordedAt: recordedAtIso,
        }),
      ).resolves.toEqual(walkRoutine);

      expect(prismaService.category.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'walk-category-id',
          petId: 'pet-id',
        },
      });
      expect(prismaService.subCategory.findFirst).not.toHaveBeenCalled();
      expect(prismaService.routine.create).toHaveBeenCalledWith({
        data: {
          petId: 'pet-id',
          userId: 'user-id',
          categoryId: 'walk-category-id',
          subCategoryId: null,
          recordedAt,
          memo: null,
        },
        include: routineInclude,
      });
    });

    it('should create a routine with category and subCategory', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findFirst.mockResolvedValue(category);
      prismaService.subCategory.findFirst.mockResolvedValue(subCategory);
      prismaService.routine.create.mockResolvedValue(createdRoutine);

      await expect(
        routineService.createRoutine('user-id', 'pet-id', {
          categoryId: 'category-id',
          subCategoryId: 'sub-category-id',
          recordedAt: recordedAtIso,
          memo: '아침 사료를 잘 먹음',
        }),
      ).resolves.toEqual(createdRoutine);

      expect(prismaService.subCategory.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'sub-category-id',
          categoryId: 'category-id',
        },
      });
      expect(prismaService.routine.create).toHaveBeenCalledWith({
        data: {
          petId: 'pet-id',
          userId: 'user-id',
          categoryId: 'category-id',
          subCategoryId: 'sub-category-id',
          recordedAt,
          memo: '아침 사료를 잘 먹음',
        },
        include: routineInclude,
      });
    });

    it('should create a routine with recordedAt when user is MEMBER', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(memberMembership);
      prismaService.category.findFirst.mockResolvedValue(walkCategory);
      prismaService.routine.create.mockResolvedValue({
        ...createdRoutine,
        categoryId: walkCategory.id,
        subCategoryId: null,
        memo: null,
        category: { name: '산책' },
        subCategory: null,
      });

      await expect(
        routineService.createRoutine('user-id', 'pet-id', {
          categoryId: 'walk-category-id',
          recordedAt: recordedAtIso,
        }),
      ).resolves.toMatchObject({
        petId: 'pet-id',
        userId: 'user-id',
        recordedAt,
      });

      expect(prismaService.routine.create).toHaveBeenCalledWith({
        data: {
          petId: 'pet-id',
          userId: 'user-id',
          categoryId: 'walk-category-id',
          subCategoryId: null,
          recordedAt,
          memo: null,
        },
        include: routineInclude,
      });
    });

    it('should throw ForbiddenException when pet belongs to another family', async () => {
      prismaService.pet.findUnique.mockResolvedValue({
        ...pet,
        familyId: 'other-family-id',
      });
      prismaService.familyMember.findUnique.mockResolvedValue(null);
      prismaService.family.findUnique.mockResolvedValue({
        ...family,
        id: 'other-family-id',
      });

      await expect(
        routineService.createRoutine('user-id', 'pet-id', {
          categoryId: 'category-id',
          recordedAt: recordedAtIso,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prismaService.familyMember.findUnique).toHaveBeenCalledWith({
        where: {
          userId_familyId: {
            userId: 'user-id',
            familyId: 'other-family-id',
          },
        },
      });
      expect(prismaService.routine.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when category belongs to another pet', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findFirst.mockResolvedValue(null);

      await expect(
        routineService.createRoutine('user-id', 'pet-id', {
          categoryId: 'other-pet-category-id',
          recordedAt: recordedAtIso,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.category.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'other-pet-category-id',
          petId: 'pet-id',
        },
      });
      expect(prismaService.routine.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when subCategory belongs to another category', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findFirst.mockResolvedValue(category);
      prismaService.subCategory.findFirst.mockResolvedValue(null);

      await expect(
        routineService.createRoutine('user-id', 'pet-id', {
          categoryId: 'category-id',
          subCategoryId: 'other-category-sub-id',
          recordedAt: recordedAtIso,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.subCategory.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'other-category-sub-id',
          categoryId: 'category-id',
        },
      });
      expect(prismaService.routine.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when pet does not exist', async () => {
      prismaService.pet.findUnique.mockResolvedValue(null);

      await expect(
        routineService.createRoutine('user-id', 'missing-pet-id', {
          categoryId: 'category-id',
          recordedAt: recordedAtIso,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.familyMember.findUnique).not.toHaveBeenCalled();
      expect(prismaService.routine.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when category does not exist', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findFirst.mockResolvedValue(null);

      await expect(
        routineService.createRoutine('user-id', 'pet-id', {
          categoryId: 'missing-category-id',
          recordedAt: recordedAtIso,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.routine.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when subCategory does not exist', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findFirst.mockResolvedValue(category);
      prismaService.subCategory.findFirst.mockResolvedValue(null);

      await expect(
        routineService.createRoutine('user-id', 'pet-id', {
          categoryId: 'category-id',
          subCategoryId: 'missing-sub-category-id',
          recordedAt: recordedAtIso,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.routine.create).not.toHaveBeenCalled();
    });

    it('should reject empty categoryId', async () => {
      await expect(
        routineService.createRoutine('user-id', 'pet-id', {
          categoryId: '   ',
          recordedAt: recordedAtIso,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaService.pet.findUnique).not.toHaveBeenCalled();
    });

    it('should reject missing recordedAt', async () => {
      await expect(
        routineService.createRoutine('user-id', 'pet-id', {
          categoryId: 'walk-category-id',
        } as never),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaService.pet.findUnique).not.toHaveBeenCalled();
      expect(prismaService.routine.create).not.toHaveBeenCalled();
    });

    it('should reject invalid recordedAt', async () => {
      await expect(
        routineService.createRoutine('user-id', 'pet-id', {
          categoryId: 'walk-category-id',
          recordedAt: 'not-a-date',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaService.pet.findUnique).not.toHaveBeenCalled();
      expect(prismaService.routine.create).not.toHaveBeenCalled();
    });

    it('should persist client-provided recordedAt and JWT userId instead of body userId', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findFirst.mockResolvedValue(walkCategory);
      prismaService.routine.create.mockResolvedValue({
        ...createdRoutine,
        categoryId: walkCategory.id,
        subCategoryId: null,
        memo: null,
        category: { name: '산책' },
        subCategory: null,
      });

      await routineService.createRoutine('user-id', 'pet-id', {
        categoryId: 'walk-category-id',
        recordedAt: recordedAtIso,
      });

      expect(prismaService.routine.create).toHaveBeenCalledWith({
        data: {
          petId: 'pet-id',
          userId: 'user-id',
          categoryId: 'walk-category-id',
          subCategoryId: null,
          recordedAt,
          memo: null,
        },
        include: routineInclude,
      });
    });
  });

  describe('findRoutines', () => {
    it('should return all routines ordered by recordedAt desc when date is omitted', async () => {
      const olderRoutine = {
        ...createdRoutine,
        id: 'older-routine-id',
        recordedAt: new Date('2026-09-15T08:00:00.000Z'),
      };

      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.routine.findMany.mockResolvedValue([
        createdRoutine,
        olderRoutine,
      ]);

      await expect(
        routineService.findRoutines('user-id', 'pet-id'),
      ).resolves.toEqual([createdRoutine, olderRoutine]);

      expect(prismaService.routine.findMany).toHaveBeenCalledWith({
        where: { petId: 'pet-id' },
        orderBy: { recordedAt: 'desc' },
        include: routineInclude,
      });
    });

    it('should return routines for the KST date ordered by recordedAt desc', async () => {
      const morningRoutine = {
        ...createdRoutine,
        id: 'morning-routine-id',
        recordedAt: new Date('2026-09-16T00:10:00.000Z'),
      };

      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.routine.findMany.mockResolvedValue([
        morningRoutine,
        createdRoutine,
      ]);

      await expect(
        routineService.findRoutines('user-id', 'pet-id', '2026-09-16'),
      ).resolves.toEqual([morningRoutine, createdRoutine]);

      expect(prismaService.routine.findMany).toHaveBeenCalledWith({
        where: {
          petId: 'pet-id',
          recordedAt: {
            gte: new Date('2026-09-15T15:00:00.000Z'),
            lt: new Date('2026-09-16T15:00:00.000Z'),
          },
        },
        orderBy: { recordedAt: 'desc' },
        include: routineInclude,
      });
    });

    it('should split dates at KST midnight, not UTC midnight', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.routine.findMany.mockResolvedValue([]);

      await routineService.findRoutines('user-id', 'pet-id', '2026-09-16');

      expect(prismaService.routine.findMany).toHaveBeenCalledWith({
        where: {
          petId: 'pet-id',
          recordedAt: {
            gte: new Date('2026-09-15T15:00:00.000Z'),
            lt: new Date('2026-09-16T15:00:00.000Z'),
          },
        },
        orderBy: { recordedAt: 'desc' },
        include: routineInclude,
      });
    });

    it('should reject invalid date query values', async () => {
      await expect(
        routineService.findRoutines('user-id', 'pet-id', '2026/09/16'),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        routineService.findRoutines('user-id', 'pet-id', '2026-13-40'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaService.pet.findUnique).not.toHaveBeenCalled();
      expect(prismaService.routine.findMany).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(null);
      prismaService.family.findUnique.mockResolvedValue(family);

      await expect(
        routineService.findRoutines('other-user-id', 'pet-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prismaService.routine.findMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when pet does not exist', async () => {
      prismaService.pet.findUnique.mockResolvedValue(null);

      await expect(
        routineService.findRoutines('user-id', 'missing-pet-id'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.routine.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findRoutineById', () => {
    it('should return the routine when it belongs to the pet', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.routine.findFirst.mockResolvedValue(createdRoutine);

      await expect(
        routineService.findRoutineById('user-id', 'pet-id', 'routine-id'),
      ).resolves.toEqual(createdRoutine);

      expect(prismaService.routine.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'routine-id',
          petId: 'pet-id',
        },
        include: routineInclude,
      });
    });

    it('should return null subCategory when the related subCategory is missing', async () => {
      const routineWithoutSubCategory = {
        ...createdRoutine,
        subCategoryId: null,
        subCategory: null,
      };

      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.routine.findFirst.mockResolvedValue(
        routineWithoutSubCategory,
      );

      await expect(
        routineService.findRoutineById('user-id', 'pet-id', 'routine-id'),
      ).resolves.toEqual(routineWithoutSubCategory);
    });

    it('should throw NotFoundException when routine belongs to another pet', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.routine.findFirst.mockResolvedValue(null);

      await expect(
        routineService.findRoutineById(
          'user-id',
          'pet-id',
          'other-pet-routine-id',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.routine.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'other-pet-routine-id',
          petId: 'pet-id',
        },
        include: routineInclude,
      });
    });

    it('should throw NotFoundException when routine does not exist', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.routine.findFirst.mockResolvedValue(null);

      await expect(
        routineService.findRoutineById(
          'user-id',
          'pet-id',
          'missing-routine-id',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateRoutine', () => {
    it('should update memo only', async () => {
      const updatedRoutine = {
        ...createdRoutine,
        memo: '저녁에도 사료를 먹음',
      };

      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.routine.findFirst.mockResolvedValue(createdRoutine);
      prismaService.routine.update.mockResolvedValue(updatedRoutine);

      await expect(
        routineService.updateRoutine('user-id', 'pet-id', 'routine-id', {
          memo: '저녁에도 사료를 먹음',
        }),
      ).resolves.toEqual(updatedRoutine);

      expect(prismaService.routine.update).toHaveBeenCalledWith({
        where: { id: 'routine-id' },
        data: { memo: '저녁에도 사료를 먹음' },
        include: routineInclude,
      });
    });

    it('should update recordedAt only', async () => {
      const nextRecordedAt = new Date('2026-09-16T08:00:00.000Z');
      const updatedRoutine = {
        ...createdRoutine,
        recordedAt: nextRecordedAt,
      };

      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.routine.findFirst.mockResolvedValue(createdRoutine);
      prismaService.routine.update.mockResolvedValue(updatedRoutine);

      await expect(
        routineService.updateRoutine('user-id', 'pet-id', 'routine-id', {
          recordedAt: '2026-09-16T08:00:00.000Z',
        }),
      ).resolves.toEqual(updatedRoutine);

      expect(prismaService.routine.update).toHaveBeenCalledWith({
        where: { id: 'routine-id' },
        data: { recordedAt: nextRecordedAt },
        include: routineInclude,
      });
    });

    it('should update recordedAt and memo together', async () => {
      const nextRecordedAt = new Date('2026-09-16T08:00:00.000Z');
      const updatedRoutine = {
        ...createdRoutine,
        recordedAt: nextRecordedAt,
        memo: '저녁 사료를 잘 먹음',
      };

      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.routine.findFirst.mockResolvedValue(createdRoutine);
      prismaService.routine.update.mockResolvedValue(updatedRoutine);

      await expect(
        routineService.updateRoutine('user-id', 'pet-id', 'routine-id', {
          recordedAt: '2026-09-16T08:00:00.000Z',
          memo: '저녁 사료를 잘 먹음',
        }),
      ).resolves.toEqual(updatedRoutine);

      expect(prismaService.routine.update).toHaveBeenCalledWith({
        where: { id: 'routine-id' },
        data: {
          recordedAt: nextRecordedAt,
          memo: '저녁 사료를 잘 먹음',
        },
        include: routineInclude,
      });
    });

    it('should update a routine when user is MEMBER', async () => {
      const updatedRoutine = {
        ...createdRoutine,
        memo: 'MEMBER가 수정함',
      };

      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(memberMembership);
      prismaService.routine.findFirst.mockResolvedValue(createdRoutine);
      prismaService.routine.update.mockResolvedValue(updatedRoutine);

      await expect(
        routineService.updateRoutine('user-id', 'pet-id', 'routine-id', {
          memo: 'MEMBER가 수정함',
        }),
      ).resolves.toEqual(updatedRoutine);

      expect(prismaService.routine.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when a non-member updates a routine', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(null);
      prismaService.family.findUnique.mockResolvedValue(family);

      await expect(
        routineService.updateRoutine('other-user-id', 'pet-id', 'routine-id', {
          memo: '변경',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prismaService.routine.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when updating a routine that belongs to another pet', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.routine.findFirst.mockResolvedValue(null);

      await expect(
        routineService.updateRoutine(
          'user-id',
          'pet-id',
          'other-pet-routine-id',
          { memo: '변경' },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.routine.update).not.toHaveBeenCalled();
    });

    it('should reject empty update body', async () => {
      await expect(
        routineService.updateRoutine('user-id', 'pet-id', 'routine-id', {}),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaService.pet.findUnique).not.toHaveBeenCalled();
    });

    it('should reject invalid recordedAt', async () => {
      await expect(
        routineService.updateRoutine('user-id', 'pet-id', 'routine-id', {
          recordedAt: 'not-a-date',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaService.pet.findUnique).not.toHaveBeenCalled();
      expect(prismaService.routine.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteRoutine', () => {
    it('should delete the routine', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.routine.findFirst.mockResolvedValue(createdRoutine);
      prismaService.routine.delete.mockResolvedValue(createdRoutine);

      await expect(
        routineService.deleteRoutine('user-id', 'pet-id', 'routine-id'),
      ).resolves.toBeUndefined();

      expect(prismaService.routine.delete).toHaveBeenCalledWith({
        where: { id: 'routine-id' },
      });
    });

    it('should throw NotFoundException when deleting a routine that belongs to another pet', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.routine.findFirst.mockResolvedValue(null);

      await expect(
        routineService.deleteRoutine(
          'user-id',
          'pet-id',
          'other-pet-routine-id',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.routine.delete).not.toHaveBeenCalled();
    });
  });
});
