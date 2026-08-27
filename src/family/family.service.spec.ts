jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { FamilyService } from './family.service';

describe('FamilyService', () => {
  let familyService: FamilyService;
  let prismaService: {
    $transaction: jest.Mock;
  };
  let transactionClient: {
    family: { create: jest.Mock };
    familyMember: { create: jest.Mock };
  };

  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const updatedAt = new Date('2026-01-02T00:00:00.000Z');
  const joinedAt = new Date('2026-01-01T00:00:00.000Z');

  beforeEach(async () => {
    transactionClient = {
      family: {
        create: jest.fn(),
      },
      familyMember: {
        create: jest.fn(),
      },
    };

    prismaService = {
      $transaction: jest.fn((callback) => callback(transactionClient)),
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    familyService = app.get<FamilyService>(FamilyService);
  });

  describe('createFamily', () => {
    it('should create a family and owner member in a transaction', async () => {
      const family = {
        id: 'family-id',
        name: '우리 가족',
        createdAt,
        updatedAt,
      };
      const member = {
        id: 'member-id',
        userId: 'user-id',
        familyId: family.id,
        role: 'OWNER' as const,
        joinedAt,
      };

      transactionClient.family.create.mockResolvedValue(family);
      transactionClient.familyMember.create.mockResolvedValue(member);

      await expect(
        familyService.createFamily('user-id', { name: '우리 가족' }),
      ).resolves.toEqual({ family, member });

      expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(transactionClient.family.create).toHaveBeenCalledWith({
        data: { name: '우리 가족' },
      });
      expect(transactionClient.familyMember.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-id',
          familyId: family.id,
          role: 'OWNER',
        },
      });
    });

    it('should assign OWNER role to the creating user', async () => {
      const family = {
        id: 'family-id',
        name: 'Test Family',
        createdAt,
        updatedAt,
      };
      const member = {
        id: 'member-id',
        userId: 'creator-id',
        familyId: family.id,
        role: 'OWNER' as const,
        joinedAt,
      };

      transactionClient.family.create.mockResolvedValue(family);
      transactionClient.familyMember.create.mockResolvedValue(member);

      const result = await familyService.createFamily('creator-id', {
        name: 'Test Family',
      });

      expect(result.member.role).toBe('OWNER');
      expect(result.member.userId).toBe('creator-id');
    });

    it('should reject empty family names', async () => {
      await expect(
        familyService.createFamily('user-id', { name: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });
  });
});
