import { ApiProperty } from '@nestjs/swagger';
import { FamilyRole } from '../../../generated/prisma/enums';

export class FamilyResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  })
  id: string;

  @ApiProperty({ example: '우리 가족' })
  name: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-01-02T00:00:00.000Z',
  })
  updatedAt: Date;
}

export class FamilyMemberDto {
  @ApiProperty({
    format: 'uuid',
    example: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  })
  id: string;

  @ApiProperty({
    format: 'uuid',
    example: '11111111-1111-1111-1111-111111111111',
  })
  userId: string;

  @ApiProperty({
    format: 'uuid',
    example: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  })
  familyId: string;

  @ApiProperty({
    enum: FamilyRole,
    enumName: 'FamilyRole',
    example: 'OWNER',
  })
  role: FamilyRole;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-01-01T00:00:00.000Z',
  })
  joinedAt: Date;
}

export class CreateFamilyResponseDto {
  @ApiProperty({ type: FamilyResponseDto })
  family: FamilyResponseDto;

  @ApiProperty({
    type: FamilyMemberDto,
    description: '생성한 사용자를 OWNER로 등록한 FamilyMember',
  })
  member: FamilyMemberDto;
}

export class MyFamilyResponseDto {
  @ApiProperty({ type: FamilyResponseDto })
  family: FamilyResponseDto;

  @ApiProperty({
    enum: FamilyRole,
    enumName: 'FamilyRole',
    example: 'OWNER',
    description: '현재 사용자의 해당 가족 역할',
  })
  role: FamilyRole;
}

export class FamilyMemberListItemDto {
  @ApiProperty({
    format: 'uuid',
    example: '11111111-1111-1111-1111-111111111111',
  })
  userId: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '홍길동',
  })
  displayName: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://example.com/avatar.png',
  })
  profileImage: string | null;

  @ApiProperty({
    enum: FamilyRole,
    enumName: 'FamilyRole',
    example: 'MEMBER',
  })
  role: FamilyRole;
}
