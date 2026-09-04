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
import { PetService } from './pet.service';

describe('PetService', () => {
  let petService: PetService;
  let prismaService: {
    familyMember: { findUnique: jest.Mock };
    family: { findUnique: jest.Mock };
    pet: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
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
  const createPetDto = {
    name: '초코',
    birthDate: '2024-01-15T00:00:00.000Z',
    gender: 'MALE' as const,
    breed: '푸들',
    image: 'https://example.com/choco.png',
    registrationNumber: '123456789',
  };
  const createdPet = {
    id: 'pet-id',
    familyId: family.id,
    name: '초코',
    birthDate: new Date('2024-01-15T00:00:00.000Z'),
    gender: 'MALE' as const,
    breed: '푸들',
    image: 'https://example.com/choco.png',
    registrationNumber: '123456789',
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
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        PetService,
        FamilyService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    petService = app.get<PetService>(PetService);
  });

  describe('createPet', () => {
    it('should create a pet when user is OWNER', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.pet.findUnique.mockResolvedValue(null);
      prismaService.pet.create.mockResolvedValue(createdPet);

      await expect(
        petService.createPet('user-id', 'family-id', createPetDto),
      ).resolves.toEqual(createdPet);

      expect(prismaService.familyMember.findUnique).toHaveBeenCalledWith({
        where: {
          userId_familyId: { userId: 'user-id', familyId: 'family-id' },
        },
      });
      expect(prismaService.pet.create).toHaveBeenCalledWith({
        data: {
          familyId: 'family-id',
          name: '초코',
          birthDate: new Date('2024-01-15T00:00:00.000Z'),
          gender: 'MALE',
          breed: '푸들',
          image: 'https://example.com/choco.png',
          registrationNumber: '123456789',
        },
      });
    });

    it('should create a pet without optional fields', async () => {
      const petWithoutOptionals = {
        ...createdPet,
        birthDate: null,
        image: null,
        registrationNumber: null,
      };

      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.pet.create.mockResolvedValue(petWithoutOptionals);

      await expect(
        petService.createPet('user-id', 'family-id', {
          name: '초코',
          gender: 'FEMALE',
          breed: '푸들',
        }),
      ).resolves.toEqual(petWithoutOptionals);

      expect(prismaService.pet.findUnique).not.toHaveBeenCalled();
      expect(prismaService.pet.create).toHaveBeenCalledWith({
        data: {
          familyId: 'family-id',
          name: '초코',
          birthDate: null,
          gender: 'FEMALE',
          breed: '푸들',
          image: null,
          registrationNumber: null,
        },
      });
    });

    it('should throw ForbiddenException when user is MEMBER', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue({
        ...ownerMembership,
        role: 'MEMBER',
      });
      prismaService.family.findUnique.mockResolvedValue(family);

      await expect(
        petService.createPet('user-id', 'family-id', createPetDto),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prismaService.pet.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when family does not exist', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(null);
      prismaService.family.findUnique.mockResolvedValue(null);

      await expect(
        petService.createPet('user-id', 'missing-family-id', createPetDto),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.pet.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when registrationNumber already exists', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.pet.findUnique.mockResolvedValue(createdPet);

      await expect(
        petService.createPet('user-id', 'family-id', createPetDto),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prismaService.pet.findUnique).toHaveBeenCalledWith({
        where: { registrationNumber: '123456789' },
      });
      expect(prismaService.pet.create).not.toHaveBeenCalled();
    });

    it('should reject empty pet names', async () => {
      await expect(
        petService.createPet('user-id', 'family-id', {
          ...createPetDto,
          name: '   ',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaService.familyMember.findUnique).not.toHaveBeenCalled();
    });

    it('should reject empty breeds', async () => {
      await expect(
        petService.createPet('user-id', 'family-id', {
          ...createPetDto,
          breed: '   ',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaService.familyMember.findUnique).not.toHaveBeenCalled();
    });

    it('should reject invalid gender', async () => {
      await expect(
        petService.createPet('user-id', 'family-id', {
          ...createPetDto,
          gender: 'UNKNOWN' as 'MALE',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaService.familyMember.findUnique).not.toHaveBeenCalled();
    });

    it('should reject invalid birthDate', async () => {
      await expect(
        petService.createPet('user-id', 'family-id', {
          ...createPetDto,
          birthDate: 'not-a-date',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaService.familyMember.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('findPets', () => {
    it('should return pets for the family when user is OWNER', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.pet.findMany.mockResolvedValue([createdPet]);

      await expect(
        petService.findPets('user-id', 'family-id'),
      ).resolves.toEqual([createdPet]);

      expect(prismaService.familyMember.findUnique).toHaveBeenCalledWith({
        where: {
          userId_familyId: { userId: 'user-id', familyId: 'family-id' },
        },
      });
      expect(prismaService.pet.findMany).toHaveBeenCalledWith({
        where: { familyId: 'family-id' },
      });
    });

    it('should return pets for the family when user is MEMBER', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue({
        ...ownerMembership,
        role: 'MEMBER',
      });
      prismaService.pet.findMany.mockResolvedValue([createdPet]);

      await expect(
        petService.findPets('user-id', 'family-id'),
      ).resolves.toEqual([createdPet]);

      expect(prismaService.pet.findMany).toHaveBeenCalledWith({
        where: { familyId: 'family-id' },
      });
    });

    it('should return an empty array when the family has no pets', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.pet.findMany.mockResolvedValue([]);

      await expect(
        petService.findPets('user-id', 'family-id'),
      ).resolves.toEqual([]);
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(null);
      prismaService.family.findUnique.mockResolvedValue(family);

      await expect(
        petService.findPets('other-user-id', 'family-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prismaService.pet.findMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when family does not exist', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(null);
      prismaService.family.findUnique.mockResolvedValue(null);

      await expect(
        petService.findPets('user-id', 'missing-family-id'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.pet.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findPetById', () => {
    it('should return the pet when user is OWNER', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.pet.findFirst.mockResolvedValue(createdPet);

      await expect(
        petService.findPetById('user-id', 'family-id', 'pet-id'),
      ).resolves.toEqual(createdPet);

      expect(prismaService.familyMember.findUnique).toHaveBeenCalledWith({
        where: {
          userId_familyId: { userId: 'user-id', familyId: 'family-id' },
        },
      });
      expect(prismaService.pet.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'pet-id',
          familyId: 'family-id',
        },
      });
    });

    it('should return the pet when user is MEMBER', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue({
        ...ownerMembership,
        role: 'MEMBER',
      });
      prismaService.pet.findFirst.mockResolvedValue(createdPet);

      await expect(
        petService.findPetById('user-id', 'family-id', 'pet-id'),
      ).resolves.toEqual(createdPet);

      expect(prismaService.pet.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'pet-id',
          familyId: 'family-id',
        },
      });
    });

    it('should include familyId and registrationNumber in the result', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.pet.findFirst.mockResolvedValue(createdPet);

      const result = await petService.findPetById(
        'user-id',
        'family-id',
        'pet-id',
      );

      expect(result).toEqual({
        id: 'pet-id',
        familyId: 'family-id',
        name: '초코',
        birthDate: createdPet.birthDate,
        gender: 'MALE',
        breed: '푸들',
        image: 'https://example.com/choco.png',
        registrationNumber: '123456789',
      });
      expect(Object.keys(result)).toEqual([
        'id',
        'familyId',
        'name',
        'birthDate',
        'gender',
        'breed',
        'image',
        'registrationNumber',
      ]);
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(null);
      prismaService.family.findUnique.mockResolvedValue(family);

      await expect(
        petService.findPetById('other-user-id', 'family-id', 'pet-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prismaService.pet.findFirst).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when family does not exist', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(null);
      prismaService.family.findUnique.mockResolvedValue(null);

      await expect(
        petService.findPetById('user-id', 'missing-family-id', 'pet-id'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.pet.findFirst).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when pet does not exist', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.pet.findFirst.mockResolvedValue(null);

      await expect(
        petService.findPetById('user-id', 'family-id', 'missing-pet-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should throw NotFoundException when pet belongs to another family', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.pet.findFirst.mockResolvedValue(null);

      await expect(
        petService.findPetById('user-id', 'family-id', 'other-family-pet-id'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.pet.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'other-family-pet-id',
          familyId: 'family-id',
        },
      });
    });
  });

  describe('updatePet', () => {
    it('should update a pet when user is OWNER', async () => {
      const updatedPet = {
        ...createdPet,
        name: '새 이름',
      };

      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.pet.findFirst.mockResolvedValue(createdPet);
      prismaService.pet.update.mockResolvedValue(updatedPet);

      await expect(
        petService.updatePet('user-id', 'family-id', 'pet-id', {
          name: '새 이름',
        }),
      ).resolves.toEqual(updatedPet);

      expect(prismaService.familyMember.findUnique).toHaveBeenCalledWith({
        where: {
          userId_familyId: { userId: 'user-id', familyId: 'family-id' },
        },
      });
      expect(prismaService.pet.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'pet-id',
          familyId: 'family-id',
        },
      });
      expect(prismaService.pet.update).toHaveBeenCalledWith({
        where: { id: 'pet-id' },
        data: { name: '새 이름' },
      });
    });

    it('should throw ForbiddenException when user is MEMBER', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue({
        ...ownerMembership,
        role: 'MEMBER',
      });
      prismaService.family.findUnique.mockResolvedValue(family);

      await expect(
        petService.updatePet('user-id', 'family-id', 'pet-id', {
          name: '새 이름',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prismaService.pet.update).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(null);
      prismaService.family.findUnique.mockResolvedValue(family);

      await expect(
        petService.updatePet('other-user-id', 'family-id', 'pet-id', {
          name: '새 이름',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prismaService.pet.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when family does not exist', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(null);
      prismaService.family.findUnique.mockResolvedValue(null);

      await expect(
        petService.updatePet('user-id', 'missing-family-id', 'pet-id', {
          name: '새 이름',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.pet.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when pet belongs to another family', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.pet.findFirst.mockResolvedValue(null);

      await expect(
        petService.updatePet('user-id', 'family-id', 'other-family-pet-id', {
          name: '새 이름',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.pet.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'other-family-pet-id',
          familyId: 'family-id',
        },
      });
      expect(prismaService.pet.update).not.toHaveBeenCalled();
    });

    it('should update only name when name is provided', async () => {
      const updatedPet = {
        ...createdPet,
        name: '새 이름',
      };

      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.pet.findFirst.mockResolvedValue(createdPet);
      prismaService.pet.update.mockResolvedValue(updatedPet);

      await expect(
        petService.updatePet('user-id', 'family-id', 'pet-id', {
          name: '새 이름',
        }),
      ).resolves.toEqual(updatedPet);

      expect(prismaService.pet.update).toHaveBeenCalledWith({
        where: { id: 'pet-id' },
        data: { name: '새 이름' },
      });
    });

    it('should update multiple provided fields', async () => {
      const updatedPet = {
        ...createdPet,
        breed: '말티즈',
        image: 'https://example.com/new.png',
      };

      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.pet.findFirst.mockResolvedValue(createdPet);
      prismaService.pet.update.mockResolvedValue(updatedPet);

      await expect(
        petService.updatePet('user-id', 'family-id', 'pet-id', {
          breed: '말티즈',
          image: 'https://example.com/new.png',
        }),
      ).resolves.toEqual(updatedPet);

      expect(prismaService.pet.update).toHaveBeenCalledWith({
        where: { id: 'pet-id' },
        data: {
          breed: '말티즈',
          image: 'https://example.com/new.png',
        },
      });
    });

    it('should reject empty pet names', async () => {
      await expect(
        petService.updatePet('user-id', 'family-id', 'pet-id', {
          name: '   ',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaService.familyMember.findUnique).not.toHaveBeenCalled();
    });

    it('should reject empty breeds', async () => {
      await expect(
        petService.updatePet('user-id', 'family-id', 'pet-id', {
          breed: '',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaService.familyMember.findUnique).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when registrationNumber already exists on another pet', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.pet.findFirst.mockResolvedValue(createdPet);
      prismaService.pet.findUnique.mockResolvedValue({
        ...createdPet,
        id: 'other-pet-id',
        registrationNumber: '999999999',
      });

      await expect(
        petService.updatePet('user-id', 'family-id', 'pet-id', {
          registrationNumber: '999999999',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prismaService.pet.update).not.toHaveBeenCalled();
    });

    it('should allow keeping the current registrationNumber', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.pet.findFirst.mockResolvedValue(createdPet);
      prismaService.pet.update.mockResolvedValue(createdPet);

      await expect(
        petService.updatePet('user-id', 'family-id', 'pet-id', {
          registrationNumber: '123456789',
        }),
      ).resolves.toEqual(createdPet);

      expect(prismaService.pet.findUnique).not.toHaveBeenCalled();
      expect(prismaService.pet.update).toHaveBeenCalledWith({
        where: { id: 'pet-id' },
        data: { registrationNumber: '123456789' },
      });
    });

    it('should reject an empty patch body', async () => {
      await expect(
        petService.updatePet('user-id', 'family-id', 'pet-id', {}),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaService.familyMember.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('deletePet', () => {
    it('should delete a pet when user is OWNER', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.pet.findFirst.mockResolvedValue(createdPet);
      prismaService.pet.delete.mockResolvedValue(createdPet);

      await expect(
        petService.deletePet('user-id', 'family-id', 'pet-id'),
      ).resolves.toBeUndefined();

      expect(prismaService.familyMember.findUnique).toHaveBeenCalledWith({
        where: {
          userId_familyId: { userId: 'user-id', familyId: 'family-id' },
        },
      });
      expect(prismaService.pet.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'pet-id',
          familyId: 'family-id',
        },
      });
    });

    it('should throw ForbiddenException when user is MEMBER', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue({
        ...ownerMembership,
        role: 'MEMBER',
      });
      prismaService.family.findUnique.mockResolvedValue(family);

      await expect(
        petService.deletePet('user-id', 'family-id', 'pet-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prismaService.pet.delete).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(null);
      prismaService.family.findUnique.mockResolvedValue(family);

      await expect(
        petService.deletePet('other-user-id', 'family-id', 'pet-id'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prismaService.pet.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when family does not exist', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(null);
      prismaService.family.findUnique.mockResolvedValue(null);

      await expect(
        petService.deletePet('user-id', 'missing-family-id', 'pet-id'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.pet.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when pet does not exist', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.pet.findFirst.mockResolvedValue(null);

      await expect(
        petService.deletePet('user-id', 'family-id', 'missing-pet-id'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.pet.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when pet belongs to another family', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.pet.findFirst.mockResolvedValue(null);

      await expect(
        petService.deletePet('user-id', 'family-id', 'other-family-pet-id'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaService.pet.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'other-family-pet-id',
          familyId: 'family-id',
        },
      });
      expect(prismaService.pet.delete).not.toHaveBeenCalled();
    });

    it('should delete the pet from the database', async () => {
      prismaService.familyMember.findUnique.mockResolvedValue(ownerMembership);
      prismaService.pet.findFirst.mockResolvedValue(createdPet);
      prismaService.pet.delete.mockResolvedValue(createdPet);

      await petService.deletePet('user-id', 'family-id', 'pet-id');

      expect(prismaService.pet.delete).toHaveBeenCalledTimes(1);
      expect(prismaService.pet.delete).toHaveBeenCalledWith({
        where: { id: createdPet.id },
      });
    });
  });
});
