jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { PetController } from './pet.controller';
import { PetService } from './pet.service';

describe('PetController', () => {
  let petController: PetController;
  let petService: {
    createPet: jest.Mock;
    findPets: jest.Mock;
    findPetById: jest.Mock;
    updatePet: jest.Mock;
    deletePet: jest.Mock;
  };

  const createdPet = {
    id: 'pet-id',
    familyId: 'family-id',
    name: '초코',
    birthDate: new Date('2024-01-15T00:00:00.000Z'),
    gender: 'MALE' as const,
    breed: '푸들',
    image: null,
    registrationNumber: '123456789',
  };

  beforeEach(async () => {
    petService = {
      createPet: jest.fn(),
      findPets: jest.fn(),
      findPetById: jest.fn(),
      updatePet: jest.fn(),
      deletePet: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [PetController],
      providers: [
        {
          provide: PetService,
          useValue: petService,
        },
      ],
    }).compile();

    petController = app.get<PetController>(PetController);
  });

  describe('createPet', () => {
    it('should pass authenticated userId, familyId, and dto to PetService', async () => {
      petService.createPet.mockResolvedValue(createdPet);
      const dto = {
        name: '초코',
        birthDate: '2024-01-15T00:00:00.000Z',
        gender: 'MALE' as const,
        breed: '푸들',
        registrationNumber: '123456789',
      };

      await expect(
        petController.createPet(
          { user: { userId: 'user-id' } } as Parameters<
            PetController['createPet']
          >[0],
          'family-id',
          dto,
        ),
      ).resolves.toEqual(createdPet);

      expect(petService.createPet).toHaveBeenCalledWith(
        'user-id',
        'family-id',
        dto,
      );
    });
  });

  describe('findPets', () => {
    it('should pass authenticated userId and familyId to PetService', async () => {
      petService.findPets.mockResolvedValue([createdPet]);

      await expect(
        petController.findPets(
          { user: { userId: 'user-id' } } as Parameters<
            PetController['findPets']
          >[0],
          'family-id',
        ),
      ).resolves.toEqual([createdPet]);

      expect(petService.findPets).toHaveBeenCalledWith('user-id', 'family-id');
    });
  });

  describe('findPetById', () => {
    it('should pass authenticated userId, familyId, and petId to PetService', async () => {
      petService.findPetById.mockResolvedValue(createdPet);

      await expect(
        petController.findPetById(
          { user: { userId: 'user-id' } } as Parameters<
            PetController['findPetById']
          >[0],
          'family-id',
          'pet-id',
        ),
      ).resolves.toEqual(createdPet);

      expect(petService.findPetById).toHaveBeenCalledWith(
        'user-id',
        'family-id',
        'pet-id',
      );
    });
  });

  describe('updatePet', () => {
    it('should pass authenticated userId, familyId, petId, and dto to PetService', async () => {
      const updatedPet = {
        ...createdPet,
        name: '새 이름',
      };
      petService.updatePet.mockResolvedValue(updatedPet);
      const dto = { name: '새 이름' };

      await expect(
        petController.updatePet(
          { user: { userId: 'user-id' } } as Parameters<
            PetController['updatePet']
          >[0],
          'family-id',
          'pet-id',
          dto,
        ),
      ).resolves.toEqual(updatedPet);

      expect(petService.updatePet).toHaveBeenCalledWith(
        'user-id',
        'family-id',
        'pet-id',
        dto,
      );
    });
  });

  describe('deletePet', () => {
    it('should pass authenticated userId, familyId, and petId to PetService', async () => {
      petService.deletePet.mockResolvedValue(undefined);

      await expect(
        petController.deletePet(
          { user: { userId: 'user-id' } } as Parameters<
            PetController['deletePet']
          >[0],
          'family-id',
          'pet-id',
        ),
      ).resolves.toBeUndefined();

      expect(petService.deletePet).toHaveBeenCalledWith(
        'user-id',
        'family-id',
        'pet-id',
      );
    });
  });
});
