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

const ROUTINE_INCLUDE = {
  user: {
    select: {
      displayName: true,
    },
  },
  category: {
    select: {
      name: true,
    },
  },
  subCategory: {
    select: {
      name: true,
    },
  },
} as const;

type RoutineWithRelations = Routine & {
  user: { displayName: string | null };
  category: { name: string };
  subCategory: { name: string } | null;
};

export type RoutineResult = Pick<
  Routine,
  | 'id'
  | 'petId'
  | 'userId'
  | 'categoryId'
  | 'subCategoryId'
  | 'recordedAt'
  | 'memo'
> & {
  user: { displayName: string | null };
  category: { name: string };
  subCategory: { name: string } | null;
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

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

    const recordedAt = this.parseRequiredRecordedAt(dto.recordedAt);
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
        recordedAt,
        memo,
      },
      include: ROUTINE_INCLUDE,
    });

    return this.toRoutineResult(routine);
  }

  async findRoutines(
    userId: string,
    petId: string,
    date?: string,
  ): Promise<RoutineResult[]> {
    const recordedAtFilter = this.parseOptionalKstDateFilter(date);

    await this.assertPetFamilyMember(userId, petId);

    const routines = await this.prisma.routine.findMany({
      where: {
        petId,
        ...(recordedAtFilter ? { recordedAt: recordedAtFilter } : {}),
      },
      orderBy: { recordedAt: 'desc' },
      include: ROUTINE_INCLUDE,
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
    if (dto.recordedAt === undefined && dto.memo === undefined) {
      throw new BadRequestException('at least one field must be provided');
    }

    const data: { recordedAt?: Date; memo?: string | null } = {};

    if (dto.recordedAt !== undefined) {
      data.recordedAt = this.parseRequiredRecordedAt(dto.recordedAt);
    }

    if (dto.memo !== undefined) {
      data.memo = this.parseOptionalMemo(dto.memo);
    }

    await this.assertPetFamilyMember(userId, petId);
    const routine = await this.findRoutineForPet(routineId, petId);

    const updatedRoutine = await this.prisma.routine.update({
      where: { id: routine.id },
      data,
      include: ROUTINE_INCLUDE,
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
  ): Promise<RoutineWithRelations> {
    const routine = await this.prisma.routine.findFirst({
      where: {
        id: routineId,
        petId,
      },
      include: ROUTINE_INCLUDE,
    });

    if (!routine) {
      throw new NotFoundException();
    }

    return routine;
  }

  private toRoutineResult(routine: RoutineWithRelations): RoutineResult {
    return {
      id: routine.id,
      petId: routine.petId,
      userId: routine.userId,
      categoryId: routine.categoryId,
      subCategoryId: routine.subCategoryId,
      recordedAt: routine.recordedAt,
      memo: routine.memo,
      user: {
        displayName: routine.user.displayName,
      },
      category: {
        name: routine.category.name,
      },
      subCategory: routine.subCategory
        ? { name: routine.subCategory.name }
        : null,
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

  private parseRequiredRecordedAt(value: string | null | undefined): Date {
    if (value == null) {
      throw new BadRequestException('recordedAt must be a valid date');
    }

    const trimmed = value.trim();

    if (!trimmed) {
      throw new BadRequestException('recordedAt must be a valid date');
    }

    const parsed = new Date(trimmed);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('recordedAt must be a valid date');
    }

    return parsed;
  }

  private parseOptionalKstDateFilter(
    value: string | undefined,
  ): { gte: Date; lt: Date } | undefined {
    if (value == null) {
      return undefined;
    }

    const trimmed = value.trim();
    const match = DATE_ONLY_PATTERN.exec(trimmed);

    if (!match) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const utcMidnight = new Date(Date.UTC(year, month - 1, day));

    if (
      utcMidnight.getUTCFullYear() !== year ||
      utcMidnight.getUTCMonth() !== month - 1 ||
      utcMidnight.getUTCDate() !== day
    ) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }

    return {
      gte: new Date(utcMidnight.getTime() - KST_OFFSET_MS),
      lt: new Date(Date.UTC(year, month - 1, day + 1) - KST_OFFSET_MS),
    };
  }
}
