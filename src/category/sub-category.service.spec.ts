jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FamilyService } from '../family/family.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubCategoryService } from './sub-category.service';

describe('SubCategoryService', () => {
  let subCategoryService: SubCategoryService;
  let prismaService: {
    familyMember: { findUnique: jest.Mock };
    family: { findUnique: jest.Mock };
    pet: { findUnique: jest.Mock };
    category: { findFirst: jest.Mock };
    subCategory: {
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
  const category = {
    id: 'category-id',
    petId: pet.id,
    name: '밥',
  };
  const createdSubCategory = {
    id: 'sub-category-id',
    categoryId: category.id,
    name: '닭가슴살',
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
        SubCategoryService,
        FamilyService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    subCategoryService = app.get<SubCategoryService>(SubCategoryService);
  });

  describe('findSubCategories', () => {
    it('should return subcategories for the category', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findFirst.mockResolvedValue(category);
      prismaService.subCategory.findMany.mockResolvedValue([
        createdSubCategory,
      ]);

      await expect(
        subCategoryService.findSubCategories(
          'user-id',
          'pet-id',
          'category-id',
        ),
      ).resolves.toEqual([createdSubCategory]);

      expect(prismaService.category.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'category-id',
          petId: 'pet-id',
        },
      });
      expect(prismaService.subCategory.findMany).toHaveBeenCalledWith({
        where: { categoryId: 'category-id' },
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
        subCategoryService.findSubCategories(
          'user-id',
          'pet-id',
          'category-id',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prismaService.subCategory.findMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when category belongs to another pet', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findFirst.mockResolvedValue(null);

      await expect(
        subCategoryService.findSubCategories(
          'user-id',
          'pet-id',
          'other-pet-category-id',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.subCategory.findMany).not.toHaveBeenCalled();
    });
  });

  describe('createSubCategory', () => {
    it('should create a subcategory', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findFirst.mockResolvedValue(category);
      prismaService.subCategory.findUnique.mockResolvedValue(null);
      prismaService.subCategory.create.mockResolvedValue(createdSubCategory);

      await expect(
        subCategoryService.createSubCategory(
          'user-id',
          'pet-id',
          'category-id',
          { name: '닭가슴살' },
        ),
      ).resolves.toEqual(createdSubCategory);

      expect(prismaService.subCategory.findUnique).toHaveBeenCalledWith({
        where: {
          categoryId_name: { categoryId: 'category-id', name: '닭가슴살' },
        },
      });
      expect(prismaService.subCategory.create).toHaveBeenCalledWith({
        data: {
          categoryId: 'category-id',
          name: '닭가슴살',
        },
      });
    });

    it('should throw ConflictException when the name already exists for the category', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findFirst.mockResolvedValue(category);
      prismaService.subCategory.findUnique.mockResolvedValue(
        createdSubCategory,
      );

      await expect(
        subCategoryService.createSubCategory(
          'user-id',
          'pet-id',
          'category-id',
          { name: '닭가슴살' },
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prismaService.subCategory.create).not.toHaveBeenCalled();
    });
  });

  describe('updateSubCategory', () => {
    it('should update the subcategory name', async () => {
      const updatedSubCategory = {
        ...createdSubCategory,
        name: '습식',
      };

      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findFirst.mockResolvedValue(category);
      prismaService.subCategory.findFirst.mockResolvedValue(createdSubCategory);
      prismaService.subCategory.findUnique.mockResolvedValue(null);
      prismaService.subCategory.update.mockResolvedValue(updatedSubCategory);

      await expect(
        subCategoryService.updateSubCategory(
          'user-id',
          'pet-id',
          'category-id',
          'sub-category-id',
          { name: '습식' },
        ),
      ).resolves.toEqual(updatedSubCategory);

      expect(prismaService.subCategory.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'sub-category-id',
          categoryId: 'category-id',
        },
      });
      expect(prismaService.subCategory.update).toHaveBeenCalledWith({
        where: { id: 'sub-category-id' },
        data: { name: '습식' },
      });
    });

    it('should throw NotFoundException when subcategory belongs to another category', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findFirst.mockResolvedValue(category);
      prismaService.subCategory.findFirst.mockResolvedValue(null);

      await expect(
        subCategoryService.updateSubCategory(
          'user-id',
          'pet-id',
          'category-id',
          'other-category-sub-id',
          { name: '습식' },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.subCategory.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteSubCategory', () => {
    it('should delete the subcategory', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findFirst.mockResolvedValue(category);
      prismaService.subCategory.findFirst.mockResolvedValue(createdSubCategory);
      prismaService.subCategory.delete.mockResolvedValue(createdSubCategory);

      await expect(
        subCategoryService.deleteSubCategory(
          'user-id',
          'pet-id',
          'category-id',
          'sub-category-id',
        ),
      ).resolves.toBeUndefined();

      expect(prismaService.subCategory.delete).toHaveBeenCalledWith({
        where: { id: 'sub-category-id' },
      });
    });

    it('should throw NotFoundException when subcategory belongs to another category', async () => {
      prismaService.pet.findUnique.mockResolvedValue(pet);
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.category.findFirst.mockResolvedValue(category);
      prismaService.subCategory.findFirst.mockResolvedValue(null);

      await expect(
        subCategoryService.deleteSubCategory(
          'user-id',
          'pet-id',
          'category-id',
          'other-category-sub-id',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.subCategory.delete).not.toHaveBeenCalled();
    });
  });
});
