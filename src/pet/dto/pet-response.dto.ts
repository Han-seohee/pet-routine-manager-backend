import { ApiProperty } from '@nestjs/swagger';
import { PetGender } from '../../../generated/prisma/enums';

export class PetResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  })
  id: string;

  @ApiProperty({
    format: 'uuid',
    example: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  })
  familyId: string;

  @ApiProperty({ example: '초코' })
  name: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2024-01-15T00:00:00.000Z',
    description: '생년월일. 등록 시 생략하면 null',
  })
  birthDate: Date | null;

  @ApiProperty({
    enum: PetGender,
    enumName: 'PetGender',
    example: 'MALE',
  })
  gender: PetGender;

  @ApiProperty({ example: '푸들' })
  breed: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://example.com/pet.png',
    description: '반려동물 이미지 URL. 등록 시 생략하면 null',
  })
  image: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '123456789',
    description: '동물등록번호. 등록 시 생략하면 null',
  })
  registrationNumber: string | null;
}
