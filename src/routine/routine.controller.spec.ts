jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { RoutineController } from './routine.controller';
import { RoutineService } from './routine.service';

describe('RoutineController', () => {
  let routineController: RoutineController;
  let routineService: {
    createRoutine: jest.Mock;
    findRoutines: jest.Mock;
    findRoutineById: jest.Mock;
    updateRoutine: jest.Mock;
    deleteRoutine: jest.Mock;
  };

  const createdRoutine = {
    id: 'routine-id',
    petId: 'pet-id',
    userId: 'user-id',
    categoryId: 'category-id',
    subCategoryId: 'sub-category-id',
    recordedAt: new Date('2026-09-07T08:00:00.000Z'),
    memo: '아침 사료를 잘 먹음',
  };

  beforeEach(async () => {
    routineService = {
      createRoutine: jest.fn(),
      findRoutines: jest.fn(),
      findRoutineById: jest.fn(),
      updateRoutine: jest.fn(),
      deleteRoutine: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [RoutineController],
      providers: [
        {
          provide: RoutineService,
          useValue: routineService,
        },
      ],
    }).compile();

    routineController = app.get<RoutineController>(RoutineController);
  });

  describe('createRoutine', () => {
    it('should pass authenticated userId, petId, and dto to RoutineService', async () => {
      routineService.createRoutine.mockResolvedValue(createdRoutine);
      const dto = {
        categoryId: 'category-id',
        subCategoryId: 'sub-category-id',
        memo: '아침 사료를 잘 먹음',
      };

      await expect(
        routineController.createRoutine(
          { user: { userId: 'user-id' } } as Parameters<
            RoutineController['createRoutine']
          >[0],
          'pet-id',
          dto,
        ),
      ).resolves.toEqual(createdRoutine);

      expect(routineService.createRoutine).toHaveBeenCalledWith(
        'user-id',
        'pet-id',
        dto,
      );
    });
  });

  describe('findRoutines', () => {
    it('should pass authenticated userId and petId to RoutineService', async () => {
      routineService.findRoutines.mockResolvedValue([createdRoutine]);

      await expect(
        routineController.findRoutines(
          { user: { userId: 'user-id' } } as Parameters<
            RoutineController['findRoutines']
          >[0],
          'pet-id',
        ),
      ).resolves.toEqual([createdRoutine]);

      expect(routineService.findRoutines).toHaveBeenCalledWith(
        'user-id',
        'pet-id',
      );
    });
  });

  describe('findRoutineById', () => {
    it('should pass authenticated userId, petId, and routineId to RoutineService', async () => {
      routineService.findRoutineById.mockResolvedValue(createdRoutine);

      await expect(
        routineController.findRoutineById(
          { user: { userId: 'user-id' } } as Parameters<
            RoutineController['findRoutineById']
          >[0],
          'pet-id',
          'routine-id',
        ),
      ).resolves.toEqual(createdRoutine);

      expect(routineService.findRoutineById).toHaveBeenCalledWith(
        'user-id',
        'pet-id',
        'routine-id',
      );
    });
  });

  describe('updateRoutine', () => {
    it('should pass authenticated userId, petId, routineId, and dto to RoutineService', async () => {
      const updatedRoutine = {
        ...createdRoutine,
        memo: '저녁에도 사료를 먹음',
      };
      routineService.updateRoutine.mockResolvedValue(updatedRoutine);
      const dto = { memo: '저녁에도 사료를 먹음' };

      await expect(
        routineController.updateRoutine(
          { user: { userId: 'user-id' } } as Parameters<
            RoutineController['updateRoutine']
          >[0],
          'pet-id',
          'routine-id',
          dto,
        ),
      ).resolves.toEqual(updatedRoutine);

      expect(routineService.updateRoutine).toHaveBeenCalledWith(
        'user-id',
        'pet-id',
        'routine-id',
        dto,
      );
    });
  });

  describe('deleteRoutine', () => {
    it('should pass authenticated userId, petId, and routineId to RoutineService', async () => {
      routineService.deleteRoutine.mockResolvedValue(undefined);

      await expect(
        routineController.deleteRoutine(
          { user: { userId: 'user-id' } } as Parameters<
            RoutineController['deleteRoutine']
          >[0],
          'pet-id',
          'routine-id',
        ),
      ).resolves.toBeUndefined();

      expect(routineService.deleteRoutine).toHaveBeenCalledWith(
        'user-id',
        'pet-id',
        'routine-id',
      );
    });
  });
});
