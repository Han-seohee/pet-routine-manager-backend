import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Category, Pet, SubCategory } from '../../generated/prisma/client';
import { FamilyService } from '../family/family.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSubCategoryDto } from './dto/create-sub-category.dto';
import type { UpdateSubCategoryDto } from './dto/update-sub-category.dto';

export type SubCategoryResult = Pick<SubCategory, 'id' | 'categoryId' | 'name'>;

@Injectable()
export class SubCategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly familyService: FamilyService,
  ) {}

  async findSubCategories(
    userId: string,
    petId: string,
    categoryId: string,
  ): Promise<SubCategoryResult[]> {
    await this.assertCategoryAccess(userId, petId, categoryId);

    const subCategories = await this.prisma.subCategory.findMany({
      where: { categoryId },
    });

    return subCategories.map((subCategory) =>
      this.toSubCategoryResult(subCategory),
    );
  }

  async createSubCategory(
    userId: string,
    petId: string,
    categoryId: string,
    dto: CreateSubCategoryDto,
  ): Promise<SubCategoryResult> {
    const name = this.parseRequiredName(dto.name);

    await this.assertCategoryAccess(userId, petId, categoryId);
    await this.assertSubCategoryNameAvailable(categoryId, name);

    const subCategory = await this.prisma.subCategory.create({
      data: {
        categoryId,
        name,
      },
    });

    return this.toSubCategoryResult(subCategory);
  }

  async updateSubCategory(
    userId: string,
    petId: string,
    categoryId: string,
    subCategoryId: string,
    dto: UpdateSubCategoryDto,
  ): Promise<SubCategoryResult> {
    if (dto.name === undefined) {
      throw new BadRequestException('at least one field must be provided');
    }

    const name = this.parseRequiredName(dto.name);

    await this.assertCategoryAccess(userId, petId, categoryId);
    const subCategory = await this.findSubCategoryForCategory(
      subCategoryId,
      categoryId,
    );
    await this.assertSubCategoryNameAvailable(categoryId, name, subCategory.id);

    const updatedSubCategory = await this.prisma.subCategory.update({
      where: { id: subCategory.id },
      data: { name },
    });

    return this.toSubCategoryResult(updatedSubCategory);
  }

  async deleteSubCategory(
    userId: string,
    petId: string,
    categoryId: string,
    subCategoryId: string,
  ): Promise<void> {
    await this.assertCategoryAccess(userId, petId, categoryId);
    const subCategory = await this.findSubCategoryForCategory(
      subCategoryId,
      categoryId,
    );

    await this.prisma.subCategory.delete({
      where: { id: subCategory.id },
    });
  }

  private async assertCategoryAccess(
    userId: string,
    petId: string,
    categoryId: string,
  ): Promise<Category> {
    await this.assertPetFamilyMember(userId, petId);
    return this.findCategoryForPet(categoryId, petId);
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

  private async findCategoryForPet(
    categoryId: string,
    petId: string,
  ): Promise<Category> {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        petId,
      },
    });

    if (!category) {
      throw new NotFoundException();
    }

    return category;
  }

  private async findSubCategoryForCategory(
    subCategoryId: string,
    categoryId: string,
  ): Promise<SubCategory> {
    const subCategory = await this.prisma.subCategory.findFirst({
      where: {
        id: subCategoryId,
        categoryId,
      },
    });

    if (!subCategory) {
      throw new NotFoundException();
    }

    return subCategory;
  }

  private async assertSubCategoryNameAvailable(
    categoryId: string,
    name: string,
    excludeSubCategoryId?: string,
  ): Promise<void> {
    const existingSubCategory = await this.prisma.subCategory.findUnique({
      where: {
        categoryId_name: { categoryId, name },
      },
    });

    if (
      existingSubCategory &&
      existingSubCategory.id !== excludeSubCategoryId
    ) {
      throw new ConflictException();
    }
  }

  private toSubCategoryResult(subCategory: SubCategory): SubCategoryResult {
    return {
      id: subCategory.id,
      categoryId: subCategory.categoryId,
      name: subCategory.name,
    };
  }

  private parseRequiredName(value: string | undefined): string {
    const name = value?.trim();

    if (!name) {
      throw new BadRequestException('name must be a non-empty string');
    }

    return name;
  }
}
