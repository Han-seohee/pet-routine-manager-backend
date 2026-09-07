jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { SubCategoryController } from './sub-category.controller';
import { SubCategoryService } from './sub-category.service';

describe('SubCategoryController', () => {
  let subCategoryController: SubCategoryController;
  let subCategoryService: {
    createSubCategory: jest.Mock;
    findSubCategories: jest.Mock;
    updateSubCategory: jest.Mock;
    deleteSubCategory: jest.Mock;
  };

  const createdSubCategory = {
    id: 'sub-category-id',
    categoryId: 'category-id',
    name: '닭가슴살',
  };

  beforeEach(async () => {
    subCategoryService = {
      createSubCategory: jest.fn(),
      findSubCategories: jest.fn(),
      updateSubCategory: jest.fn(),
      deleteSubCategory: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [SubCategoryController],
      providers: [
        {
          provide: SubCategoryService,
          useValue: subCategoryService,
        },
      ],
    }).compile();

    subCategoryController = app.get<SubCategoryController>(
      SubCategoryController,
    );
  });

  describe('createSubCategory', () => {
    it('should pass authenticated userId, petId, categoryId, and dto to SubCategoryService', async () => {
      subCategoryService.createSubCategory.mockResolvedValue(
        createdSubCategory,
      );
      const dto = { name: '닭가슴살' };

      await expect(
        subCategoryController.createSubCategory(
          { user: { userId: 'user-id' } } as Parameters<
            SubCategoryController['createSubCategory']
          >[0],
          'pet-id',
          'category-id',
          dto,
        ),
      ).resolves.toEqual(createdSubCategory);

      expect(subCategoryService.createSubCategory).toHaveBeenCalledWith(
        'user-id',
        'pet-id',
        'category-id',
        dto,
      );
    });
  });

  describe('findSubCategories', () => {
    it('should pass authenticated userId, petId, and categoryId to SubCategoryService', async () => {
      subCategoryService.findSubCategories.mockResolvedValue([
        createdSubCategory,
      ]);

      await expect(
        subCategoryController.findSubCategories(
          { user: { userId: 'user-id' } } as Parameters<
            SubCategoryController['findSubCategories']
          >[0],
          'pet-id',
          'category-id',
        ),
      ).resolves.toEqual([createdSubCategory]);

      expect(subCategoryService.findSubCategories).toHaveBeenCalledWith(
        'user-id',
        'pet-id',
        'category-id',
      );
    });
  });

  describe('updateSubCategory', () => {
    it('should pass authenticated userId, ids, and dto to SubCategoryService', async () => {
      const updatedSubCategory = {
        ...createdSubCategory,
        name: '습식',
      };
      subCategoryService.updateSubCategory.mockResolvedValue(
        updatedSubCategory,
      );
      const dto = { name: '습식' };

      await expect(
        subCategoryController.updateSubCategory(
          { user: { userId: 'user-id' } } as Parameters<
            SubCategoryController['updateSubCategory']
          >[0],
          'pet-id',
          'category-id',
          'sub-category-id',
          dto,
        ),
      ).resolves.toEqual(updatedSubCategory);

      expect(subCategoryService.updateSubCategory).toHaveBeenCalledWith(
        'user-id',
        'pet-id',
        'category-id',
        'sub-category-id',
        dto,
      );
    });
  });

  describe('deleteSubCategory', () => {
    it('should pass authenticated userId and ids to SubCategoryService', async () => {
      subCategoryService.deleteSubCategory.mockResolvedValue(undefined);

      await expect(
        subCategoryController.deleteSubCategory(
          { user: { userId: 'user-id' } } as Parameters<
            SubCategoryController['deleteSubCategory']
          >[0],
          'pet-id',
          'category-id',
          'sub-category-id',
        ),
      ).resolves.toBeUndefined();

      expect(subCategoryService.deleteSubCategory).toHaveBeenCalledWith(
        'user-id',
        'pet-id',
        'category-id',
        'sub-category-id',
      );
    });
  });
});
