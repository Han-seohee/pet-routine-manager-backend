jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

describe('CategoryController', () => {
  let categoryController: CategoryController;
  let categoryService: {
    createCategory: jest.Mock;
    findCategories: jest.Mock;
    updateCategory: jest.Mock;
    deleteCategory: jest.Mock;
  };

  const createdCategory = {
    id: 'category-id',
    petId: 'pet-id',
    name: '미용',
  };

  beforeEach(async () => {
    categoryService = {
      createCategory: jest.fn(),
      findCategories: jest.fn(),
      updateCategory: jest.fn(),
      deleteCategory: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [
        {
          provide: CategoryService,
          useValue: categoryService,
        },
      ],
    }).compile();

    categoryController = app.get<CategoryController>(CategoryController);
  });

  describe('createCategory', () => {
    it('should pass authenticated userId, petId, and dto to CategoryService', async () => {
      categoryService.createCategory.mockResolvedValue(createdCategory);
      const dto = { name: '미용' };

      await expect(
        categoryController.createCategory(
          { user: { userId: 'user-id' } } as Parameters<
            CategoryController['createCategory']
          >[0],
          'pet-id',
          dto,
        ),
      ).resolves.toEqual(createdCategory);

      expect(categoryService.createCategory).toHaveBeenCalledWith(
        'user-id',
        'pet-id',
        dto,
      );
    });
  });

  describe('findCategories', () => {
    it('should pass authenticated userId and petId to CategoryService', async () => {
      categoryService.findCategories.mockResolvedValue([createdCategory]);

      await expect(
        categoryController.findCategories(
          { user: { userId: 'user-id' } } as Parameters<
            CategoryController['findCategories']
          >[0],
          'pet-id',
        ),
      ).resolves.toEqual([createdCategory]);

      expect(categoryService.findCategories).toHaveBeenCalledWith(
        'user-id',
        'pet-id',
      );
    });
  });

  describe('updateCategory', () => {
    it('should pass authenticated userId, petId, categoryId, and dto to CategoryService', async () => {
      const updatedCategory = {
        ...createdCategory,
        name: '그루밍',
      };
      categoryService.updateCategory.mockResolvedValue(updatedCategory);
      const dto = { name: '그루밍' };

      await expect(
        categoryController.updateCategory(
          { user: { userId: 'user-id' } } as Parameters<
            CategoryController['updateCategory']
          >[0],
          'pet-id',
          'category-id',
          dto,
        ),
      ).resolves.toEqual(updatedCategory);

      expect(categoryService.updateCategory).toHaveBeenCalledWith(
        'user-id',
        'pet-id',
        'category-id',
        dto,
      );
    });
  });

  describe('deleteCategory', () => {
    it('should pass authenticated userId, petId, and categoryId to CategoryService', async () => {
      categoryService.deleteCategory.mockResolvedValue(undefined);

      await expect(
        categoryController.deleteCategory(
          { user: { userId: 'user-id' } } as Parameters<
            CategoryController['deleteCategory']
          >[0],
          'pet-id',
          'category-id',
        ),
      ).resolves.toBeUndefined();

      expect(categoryService.deleteCategory).toHaveBeenCalledWith(
        'user-id',
        'pet-id',
        'category-id',
      );
    });
  });
});
