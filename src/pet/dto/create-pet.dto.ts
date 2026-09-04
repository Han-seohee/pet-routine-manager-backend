import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PetGender } from '../../../generated/prisma/enums';

export class CreatePetDto {
  @ApiProperty({
    example: '초코',
    description: '반려동물 이름. 공백만 있는 값은 허용되지 않습니다.',
  })
  name: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2024-01-15T00:00:00.000Z',
    description:
      '생년월일. 생략하거나 빈 문자열이면 null로 저장됩니다. 값이 있으면 유효한 날짜여야 합니다.',
  })
  birthDate?: string;

  @ApiProperty({
    enum: PetGender,
    enumName: 'PetGender',
    example: 'MALE',
    description: '성별. MALE 또는 FEMALE',
  })
  gender: PetGender;

  @ApiProperty({
    example: '푸들',
    description: '품종. 공백만 있는 값은 허용되지 않습니다.',
  })
  breed: string;

  @ApiPropertyOptional({
    type: String,
    example: 'https://example.com/pet.png',
    description:
      '반려동물 이미지 URL. 생략하거나 빈 문자열이면 null로 저장됩니다.',
  })
  image?: string;

  @ApiPropertyOptional({
    type: String,
    example: '123456789',
    description:
      '동물등록번호. 생략하거나 빈 문자열이면 null로 저장됩니다. 값이 있으면 전체 Pet에서 유일해야 합니다.',
  })
  registrationNumber?: string;
}
