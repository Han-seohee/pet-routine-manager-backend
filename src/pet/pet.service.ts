import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pet } from '../../generated/prisma/client';
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
  | 'breed'
  | 'image'
  | 'registrationNumber'
>;

export type CreatePetResult = PetResult;

const PET_GENDERS = new Set(['MALE', 'FEMALE']);

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

    const pet = await this.prisma.pet.create({
      data: {
        familyId,
        name,
        birthDate,
        gender: dto.gender,
        breed,
        image,
        registrationNumber,
      },
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
      breed: pet.breed,
      image: pet.image,
      registrationNumber: pet.registrationNumber,
    };
  }

  private buildPetUpdateData(dto: UpdatePetDto): {
    name?: string;
    birthDate?: Date | null;
    gender?: Pet['gender'];
    breed?: string;
    image?: string | null;
    registrationNumber?: string | null;
  } {
    if (
      dto.name === undefined &&
      dto.birthDate === undefined &&
      dto.gender === undefined &&
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
