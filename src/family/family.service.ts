import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Family, FamilyMember } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateFamilyDto } from './dto/create-family.dto';
import type { UpdateFamilyDto } from './dto/update-family.dto';

export type CreateFamilyResult = {
  family: Family;
  member: FamilyMember;
};

export type MyFamilyResult = {
  family: Pick<Family, 'id' | 'name' | 'createdAt' | 'updatedAt'>;
  role: FamilyMember['role'];
};

export type FamilyDetailResult = Pick<
  Family,
  'id' | 'name' | 'createdAt' | 'updatedAt'
>;

export type FamilyMemberResult = {
  userId: string;
  displayName: string | null;
  profileImage: string | null;
  role: FamilyMember['role'];
};

export type AddFamilyMemberResult = Pick<
  FamilyMember,
  'id' | 'userId' | 'familyId' | 'role' | 'joinedAt'
>;

@Injectable()
export class FamilyService {
  constructor(private readonly prisma: PrismaService) {}

  async createFamily(
    userId: string,
    dto: CreateFamilyDto,
  ): Promise<CreateFamilyResult> {
    const name = dto.name?.trim();

    if (!name) {
      throw new BadRequestException('name must be a non-empty string');
    }

    return this.prisma.$transaction(async (tx) => {
      const family = await tx.family.create({
        data: { name },
      });

      const member = await tx.familyMember.create({
        data: {
          userId,
          familyId: family.id,
          role: 'OWNER',
        },
      });

      return { family, member };
    });
  }

  async findMyFamilies(userId: string): Promise<MyFamilyResult[]> {
    const members = await this.prisma.familyMember.findMany({
      where: { userId },
      include: { family: true },
    });

    return members.map(({ family, role }) => ({
      family: {
        id: family.id,
        name: family.name,
        createdAt: family.createdAt,
        updatedAt: family.updatedAt,
      },
      role,
    }));
  }

  async findFamilyById(
    userId: string,
    familyId: string,
  ): Promise<FamilyDetailResult> {
    const membership = await this.prisma.familyMember.findUnique({
      where: {
        userId_familyId: { userId, familyId },
      },
      include: { family: true },
    });

    if (membership) {
      const { family } = membership;
      return {
        id: family.id,
        name: family.name,
        createdAt: family.createdAt,
        updatedAt: family.updatedAt,
      };
    }

    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
    });

    if (!family) {
      throw new NotFoundException();
    }

    throw new ForbiddenException();
  }

  async findFamilyMembers(
    userId: string,
    familyId: string,
  ): Promise<FamilyMemberResult[]> {
    const membership = await this.prisma.familyMember.findUnique({
      where: {
        userId_familyId: { userId, familyId },
      },
    });

    if (!membership) {
      const family = await this.prisma.family.findUnique({
        where: { id: familyId },
      });

      if (!family) {
        throw new NotFoundException();
      }

      throw new ForbiddenException();
    }

    const members = await this.prisma.familyMember.findMany({
      where: { familyId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            profileImage: true,
          },
        },
      },
    });

    return members.map(({ user, role }) => ({
      userId: user.id,
      displayName: user.displayName,
      profileImage: user.profileImage,
      role,
    }));
  }

  async updateFamily(
    userId: string,
    familyId: string,
    dto: UpdateFamilyDto,
  ): Promise<FamilyDetailResult> {
    const name = dto.name?.trim();

    if (!name) {
      throw new BadRequestException('name must be a non-empty string');
    }

    await this.assertFamilyOwner(userId, familyId);

    const family = await this.prisma.family.update({
      where: { id: familyId },
      data: { name },
    });

    return {
      id: family.id,
      name: family.name,
      createdAt: family.createdAt,
      updatedAt: family.updatedAt,
    };
  }

  async deleteFamily(userId: string, familyId: string): Promise<void> {
    await this.assertFamilyOwner(userId, familyId);

    await this.prisma.family.delete({
      where: { id: familyId },
    });
  }

  async addFamilyMember(
    ownerUserId: string,
    familyId: string,
    userId: string,
  ): Promise<AddFamilyMemberResult> {
    await this.assertFamilyOwner(ownerUserId, familyId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException();
    }

    const existingMembership = await this.prisma.familyMember.findUnique({
      where: {
        userId_familyId: { userId, familyId },
      },
    });

    if (existingMembership) {
      throw new ConflictException();
    }

    const member = await this.prisma.familyMember.create({
      data: {
        userId,
        familyId,
        role: 'MEMBER',
      },
    });

    return {
      id: member.id,
      userId: member.userId,
      familyId: member.familyId,
      role: member.role,
      joinedAt: member.joinedAt,
    };
  }

  async removeFamilyMember(
    ownerUserId: string,
    familyId: string,
    userId: string,
  ): Promise<void> {
    await this.assertFamilyOwner(ownerUserId, familyId);

    if (ownerUserId === userId) {
      throw new BadRequestException();
    }

    const existingMembership = await this.prisma.familyMember.findUnique({
      where: {
        userId_familyId: { userId, familyId },
      },
    });

    if (!existingMembership) {
      throw new NotFoundException();
    }

    await this.prisma.familyMember.delete({
      where: {
        userId_familyId: { userId, familyId },
      },
    });
  }

  private async assertFamilyOwner(
    userId: string,
    familyId: string,
  ): Promise<void> {
    const membership = await this.prisma.familyMember.findUnique({
      where: {
        userId_familyId: { userId, familyId },
      },
    });

    if (membership?.role === 'OWNER') {
      return;
    }

    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
    });

    if (!family) {
      throw new NotFoundException();
    }

    throw new ForbiddenException();
  }
}
