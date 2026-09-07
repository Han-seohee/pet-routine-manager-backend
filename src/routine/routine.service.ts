import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pet, Routine } from '../../generated/prisma/client';
import { FamilyService } from '../family/family.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateRoutineDto } from './dto/create-routine.dto';
import type { UpdateRoutineDto } from './dto/update-routine.dto';

export type RoutineResult = Pick<
  Routine,
  | 'id'
  | 'petId'
  | 'userId'
  | 'categoryId'
  | 'subCategoryId'
  | 'recordedAt'
  | 'memo'
>;

@Injectable()
export class RoutineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly familyService: FamilyService,
  ) {}

  async createRoutine(
    userId: string,
    petId: string,
    dto: CreateRoutineDto,
  ): Promise<RoutineResult> {
    const categoryId = dto.categoryId?.trim();

    if (!categoryId) {
      throw new BadRequestException('categoryId must be a non-empty string');
    }

    const subCategoryId = this.parseOptionalId(dto.subCategoryId);
    const memo = this.parseOptionalMemo(dto.memo);

    await this.assertPetFamilyMember(userId, petId);
    await this.assertCategoryBelongsToPet(categoryId, petId);

    if (subCategoryId) {
      await this.assertSubCategoryBelongsToCategory(subCategoryId, categoryId);
    }

    const routine = await this.prisma.routine.create({
      data: {
        petId,
        userId,
        categoryId,
        subCategoryId,
        memo,
      },
    });

    return this.toRoutineResult(routine);
  }

  async findRoutines(userId: string, petId: string): Promise<RoutineResult[]> {
    await this.assertPetFamilyMember(userId, petId);

    const routines = await this.prisma.routine.findMany({
      where: { petId },
      orderBy: { recordedAt: 'desc' },
    });

    return routines.map((routine) => this.toRoutineResult(routine));
  }

  async findRoutineById(
    userId: string,
    petId: string,
    routineId: string,
  ): Promise<RoutineResult> {
    await this.assertPetFamilyMember(userId, petId);

    const routine = await this.findRoutineForPet(routineId, petId);

    return this.toRoutineResult(routine);
  }

  async updateRoutine(
    userId: string,
    petId: string,
    routineId: string,
    dto: UpdateRoutineDto,
  ): Promise<RoutineResult> {
    if (dto.memo === undefined) {
      throw new BadRequestException('at least one field must be provided');
    }

    const memo = this.parseOptionalMemo(dto.memo);

    await this.assertPetFamilyMember(userId, petId);
    const routine = await this.findRoutineForPet(routineId, petId);

    const updatedRoutine = await this.prisma.routine.update({
      where: { id: routine.id },
      data: { memo },
    });

    return this.toRoutineResult(updatedRoutine);
  }

  async deleteRoutine(
    userId: string,
    petId: string,
    routineId: string,
  ): Promise<void> {
    await this.assertPetFamilyMember(userId, petId);
    const routine = await this.findRoutineForPet(routineId, petId);

    await this.prisma.routine.delete({
      where: { id: routine.id },
    });
  }

  private async assertPetFamilyMember(
    userId: string,
    petId: string,
  ): Promise<Pet> {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
    });

    if (!pet) {
      throw new NotFoundException();
    }

    await this.familyService.assertFamilyMember(userId, pet.familyId);

    return pet;
  }

  private async assertCategoryBelongsToPet(
    categoryId: string,
    petId: string,
  ): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        petId,
      },
    });

    if (!category) {
      throw new NotFoundException();
    }
  }

  private async assertSubCategoryBelongsToCategory(
    subCategoryId: string,
    categoryId: string,
  ): Promise<void> {
    const subCategory = await this.prisma.subCategory.findFirst({
      where: {
        id: subCategoryId,
        categoryId,
      },
    });

    if (!subCategory) {
      throw new NotFoundException();
    }
  }

  private async findRoutineForPet(
    routineId: string,
    petId: string,
  ): Promise<Routine> {
    const routine = await this.prisma.routine.findFirst({
      where: {
        id: routineId,
        petId,
      },
    });

    if (!routine) {
      throw new NotFoundException();
    }

    return routine;
  }

  private toRoutineResult(routine: Routine): RoutineResult {
    return {
      id: routine.id,
      petId: routine.petId,
      userId: routine.userId,
      categoryId: routine.categoryId,
      subCategoryId: routine.subCategoryId,
      recordedAt: routine.recordedAt,
      memo: routine.memo,
    };
  }

  private parseOptionalId(value: string | null | undefined): string | null {
    if (value == null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private parseOptionalMemo(value: string | null | undefined): string | null {
    if (value == null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
}
