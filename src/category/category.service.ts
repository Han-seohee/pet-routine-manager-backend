import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Category, Pet } from '../../generated/prisma/client';
import { FamilyService } from '../family/family.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

export type CategoryResult = Pick<Category, 'id' | 'petId' | 'name'>;

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly familyService: FamilyService,
  ) {}

  async findCategories(
    userId: string,
    petId: string,
  ): Promise<CategoryResult[]> {
    await this.assertPetFamilyMember(userId, petId);

    const categories = await this.prisma.category.findMany({
      where: { petId },
    });

    return categories.map((category) => this.toCategoryResult(category));
  }

  async createCategory(
    userId: string,
    petId: string,
    dto: CreateCategoryDto,
  ): Promise<CategoryResult> {
    const name = this.parseRequiredName(dto.name);

    await this.assertPetFamilyMember(userId, petId);
    await this.assertCategoryNameAvailable(petId, name);

    const category = await this.prisma.category.create({
      data: {
        petId,
        name,
      },
    });

    return this.toCategoryResult(category);
  }

  async updateCategory(
    userId: string,
    petId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResult> {
    if (dto.name === undefined) {
      throw new BadRequestException('at least one field must be provided');
    }

    const name = this.parseRequiredName(dto.name);

    await this.assertPetFamilyMember(userId, petId);
    const category = await this.findCategoryForPet(categoryId, petId);
    await this.assertCategoryNameAvailable(petId, name, category.id);

    const updatedCategory = await this.prisma.category.update({
      where: { id: category.id },
      data: { name },
    });

    return this.toCategoryResult(updatedCategory);
  }

  async deleteCategory(
    userId: string,
    petId: string,
    categoryId: string,
  ): Promise<void> {
    await this.assertPetFamilyMember(userId, petId);
    const category = await this.findCategoryForPet(categoryId, petId);

    await this.prisma.category.delete({
      where: { id: category.id },
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

  private async assertCategoryNameAvailable(
    petId: string,
    name: string,
    excludeCategoryId?: string,
  ): Promise<void> {
    const existingCategory = await this.prisma.category.findUnique({
      where: {
        petId_name: { petId, name },
      },
    });

    if (existingCategory && existingCategory.id !== excludeCategoryId) {
      throw new ConflictException();
    }
  }

  private toCategoryResult(category: Category): CategoryResult {
    return {
      id: category.id,
      petId: category.petId,
      name: category.name,
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
