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
import { FamilyService } from '../family/family.service';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryService } from './category.service';

describe('CategoryService', () => {
  let categoryService: CategoryService;
  let prismaService: {
    familyMember: { findUnique: jest.Mock };
    family: { findUnique: jest.Mock };
    pet: { findUnique: jest.Mock };
    category: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

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
    joinedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const pet = {
    id: 'pet-id',
    familyId: family.id,
    name: '라봉',
    birthDate: null,
    gender: 'MALE' as const,
    species: 'DOG' as const,
    breed: '푸들',
    image: null,
    registrationNumber: null,
  };
  const createdCategory = {
    id: 'category-id',
    petId: pet.id,
    name: '미용',
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
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        FamilyService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    categoryService = app.get<CategoryService>(CategoryService);
  });

  describe('findCategories', () => {
    it('should return categories for the pet', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findMany.mockResolvedValue([createdCategory]);

      await expect(
        categoryService.findCategories('user-id', 'pet-id'),
      ).resolves.toEqual([createdCategory]);

      expect(prismaService.category.findMany).toHaveBeenCalledWith({
        where: { petId: 'pet-id' },
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
        categoryService.findCategories('user-id', 'pet-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prismaService.category.findMany).not.toHaveBeenCalled();
    });
  });

  describe('createCategory', () => {
    it('should create a category', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findUnique.mockResolvedValue(null);
      prismaService.category.create.mockResolvedValue(createdCategory);

      await expect(
        categoryService.createCategory('user-id', 'pet-id', { name: '미용' }),
      ).resolves.toEqual(createdCategory);

      expect(prismaService.category.findUnique).toHaveBeenCalledWith({
        where: {
          petId_name: { petId: 'pet-id', name: '미용' },
        },
      });
      expect(prismaService.category.create).toHaveBeenCalledWith({
        data: {
          petId: 'pet-id',
          name: '미용',
        },
      });
    });

    it('should throw ConflictException when the name already exists for the pet', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findUnique.mockResolvedValue(createdCategory);

      await expect(
        categoryService.createCategory('user-id', 'pet-id', { name: '미용' }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prismaService.category.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when pet does not exist', async () => {
      prismaService.pet.findUnique.mockResolvedValue(null);

      await expect(
        categoryService.createCategory('user-id', 'missing-pet-id', {
          name: '미용',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.category.create).not.toHaveBeenCalled();
    });

    it('should reject empty names', async () => {
      await expect(
        categoryService.createCategory('user-id', 'pet-id', { name: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaService.pet.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('updateCategory', () => {
    it('should update the category name', async () => {
      const updatedCategory = {
        ...createdCategory,
        name: '그루밍',
      };

      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findFirst.mockResolvedValue(createdCategory);
      prismaService.category.findUnique.mockResolvedValue(null);
      prismaService.category.update.mockResolvedValue(updatedCategory);

      await expect(
        categoryService.updateCategory('user-id', 'pet-id', 'category-id', {
          name: '그루밍',
        }),
      ).resolves.toEqual(updatedCategory);

      expect(prismaService.category.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'category-id',
          petId: 'pet-id',
        },
      });
      expect(prismaService.category.update).toHaveBeenCalledWith({
        where: { id: 'category-id' },
        data: { name: '그루밍' },
      });
    });

    it('should throw NotFoundException when category belongs to another pet', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findFirst.mockResolvedValue(null);

      await expect(
        categoryService.updateCategory(
          'user-id',
          'pet-id',
          'other-pet-category-id',
          { name: '그루밍' },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.category.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteCategory', () => {
    it('should delete the category', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findFirst.mockResolvedValue(createdCategory);
      prismaService.category.delete.mockResolvedValue(createdCategory);

      await expect(
        categoryService.deleteCategory('user-id', 'pet-id', 'category-id'),
      ).resolves.toBeUndefined();

      expect(prismaService.category.delete).toHaveBeenCalledWith({
        where: { id: 'category-id' },
      });
    });

    it('should throw NotFoundException when category belongs to another pet', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findFirst.mockResolvedValue(null);

      await expect(
        categoryService.deleteCategory(
          'user-id',
          'pet-id',
          'other-pet-category-id',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.category.delete).not.toHaveBeenCalled();
    });
  });
});
