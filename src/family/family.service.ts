import { BadRequestException, Injectable } from '@nestjs/common';
import type { Family, FamilyMember } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateFamilyDto } from './dto/create-family.dto';

export type CreateFamilyResult = {
  family: Family;
  member: FamilyMember;
};

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
}
