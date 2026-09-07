import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pet } from '../../generated/prisma/client';
import { DEFAULT_PET_CATEGORIES } from '../category/default-pet-categories';
import { FamilyService } from '../family/family.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePetDto } from './dto/create-pet.dto';
import type { UpdatePetDto } from './dto/update-pet.dto';

export type PetResult = Pick<
  Pet,
  | 'id'
  | 'familyId'
  | 'name'
  | 'birthDate'
  | 'gender'
  | 'species'
  | 'breed'
  | 'image'
  | 'registrationNumber'
>;

export type CreatePetResult = PetResult;

const PET_GENDERS = new Set(['MALE', 'FEMALE']);
const PET_SPECIES = new Set(['DOG', 'CAT']);

@Injectable()
export class PetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly familyService: FamilyService,
  ) {}

  async createPet(
    userId: string,
    familyId: string,
    dto: CreatePetDto,
  ): Promise<CreatePetResult> {
    const name = dto.name?.trim();

    if (!name) {
      throw new BadRequestException('name must be a non-empty string');
    }

    const breed = dto.breed?.trim();

    if (!breed) {
      throw new BadRequestException('breed must be a non-empty string');
    }

    if (!PET_GENDERS.has(dto.gender)) {
      throw new BadRequestException('gender must be MALE or FEMALE');
    }

    if (!PET_SPECIES.has(dto.species)) {
      throw new BadRequestException('species must be DOG or CAT');
    }

    const birthDate = this.parseOptionalBirthDate(dto.birthDate);
    const image = this.parseOptionalString(dto.image);
    const registrationNumber = this.parseOptionalString(dto.registrationNumber);

    await this.familyService.assertFamilyOwner(userId, familyId);

    if (registrationNumber) {
      const existingPet = await this.prisma.pet.findUnique({
        where: { registrationNumber },
      });

      if (existingPet) {
        throw new ConflictException();
      }
    }

    const pet = await this.prisma.$transaction(async (tx) => {
      const createdPet = await tx.pet.create({
        data: {
          familyId,
          name,
          birthDate,
          gender: dto.gender,
          species: dto.species,
          breed,
          image,
          registrationNumber,
        },
      });

      await this.createDefaultCategories(tx, createdPet.id, dto.species);

      return createdPet;
    });

    return this.toPetResult(pet);
  }

  async findPets(userId: string, familyId: string): Promise<PetResult[]> {
    await this.familyService.assertFamilyMember(userId, familyId);

    const pets = await this.prisma.pet.findMany({
      where: { familyId },
    });

    return pets.map((pet) => this.toPetResult(pet));
  }

  async findPetById(
    userId: string,
    familyId: string,
    petId: string,
  ): Promise<PetResult> {
    await this.familyService.assertFamilyMember(userId, familyId);

    const pet = await this.prisma.pet.findFirst({
      where: {
        id: petId,
        familyId,
      },
    });

    if (!pet) {
      throw new NotFoundException();
    }

    return this.toPetResult(pet);
  }

  async updatePet(
    userId: string,
    familyId: string,
    petId: string,
    dto: UpdatePetDto,
  ): Promise<PetResult> {
    const data = this.buildPetUpdateData(dto);

    await this.familyService.assertFamilyOwner(userId, familyId);

    const pet = await this.prisma.pet.findFirst({
      where: {
        id: petId,
        familyId,
      },
    });

    if (!pet) {
      throw new NotFoundException();
    }

    if (
      data.registrationNumber &&
      data.registrationNumber !== pet.registrationNumber
    ) {
      const existingPet = await this.prisma.pet.findUnique({
        where: { registrationNumber: data.registrationNumber },
      });

      if (existingPet) {
        throw new ConflictException();
      }
    }

    const updatedPet = await this.prisma.pet.update({
      where: { id: pet.id },
      data,
    });

    return this.toPetResult(updatedPet);
  }

  async deletePet(
    userId: string,
    familyId: string,
    petId: string,
  ): Promise<void> {
    await this.familyService.assertFamilyOwner(userId, familyId);

    const pet = await this.prisma.pet.findFirst({
      where: {
        id: petId,
        familyId,
      },
    });

    if (!pet) {
      throw new NotFoundException();
    }

    await this.prisma.pet.delete({
      where: { id: pet.id },
    });
  }

  private toPetResult(pet: Pet): PetResult {
    return {
      id: pet.id,
      familyId: pet.familyId,
      name: pet.name,
      birthDate: pet.birthDate,
      gender: pet.gender,
      species: pet.species,
      breed: pet.breed,
      image: pet.image,
      registrationNumber: pet.registrationNumber,
    };
  }

  private buildPetUpdateData(dto: UpdatePetDto): {
    name?: string;
    birthDate?: Date | null;
    gender?: Pet['gender'];
    species?: Pet['species'];
    breed?: string;
    image?: string | null;
    registrationNumber?: string | null;
  } {
    if (
      dto.name === undefined &&
      dto.birthDate === undefined &&
      dto.gender === undefined &&
      dto.species === undefined &&
      dto.breed === undefined &&
      dto.image === undefined &&
      dto.registrationNumber === undefined
    ) {
      throw new BadRequestException('at least one field must be provided');
    }

    const data: {
      name?: string;
      birthDate?: Date | null;
      gender?: Pet['gender'];
      species?: Pet['species'];
      breed?: string;
      image?: string | null;
      registrationNumber?: string | null;
    } = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();

      if (!name) {
        throw new BadRequestException('name must be a non-empty string');
      }

      data.name = name;
    }

    if (dto.breed !== undefined) {
      const breed = dto.breed.trim();

      if (!breed) {
        throw new BadRequestException('breed must be a non-empty string');
      }

      data.breed = breed;
    }

    if (dto.gender !== undefined) {
      if (!PET_GENDERS.has(dto.gender)) {
        throw new BadRequestException('gender must be MALE or FEMALE');
      }

      data.gender = dto.gender;
    }

    if (dto.species !== undefined) {
      if (!PET_SPECIES.has(dto.species)) {
        throw new BadRequestException('species must be DOG or CAT');
      }

      data.species = dto.species;
    }

    if (dto.birthDate !== undefined) {
      data.birthDate = this.parseOptionalBirthDate(dto.birthDate);
    }

    if (dto.image !== undefined) {
      data.image = this.parseOptionalString(dto.image);
    }

    if (dto.registrationNumber !== undefined) {
      data.registrationNumber = this.parseOptionalString(
        dto.registrationNumber,
      );
    }

    return data;
  }

  private async createDefaultCategories(
    tx: Pick<PrismaService, 'category' | 'subCategory'>,
    petId: string,
    species: Pet['species'],
  ): Promise<void> {
    const defaults = DEFAULT_PET_CATEGORIES[species];

    for (const category of defaults) {
      const createdCategory = await tx.category.create({
        data: {
          petId,
          name: category.name,
        },
      });

      for (const subCategoryName of category.subCategoryNames) {
        await tx.subCategory.create({
          data: {
            categoryId: createdCategory.id,
            name: subCategoryName,
          },
        });
      }
    }
  }

  private parseOptionalString(value: string | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private parseOptionalBirthDate(value: string | undefined): Date | null {
    if (value == null) {
      return null;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const parsed = new Date(trimmed);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('birthDate must be a valid date');
    }

    return parsed;
  }
}
