import { ApiProperty } from '@nestjs/swagger';

export class CreateFamilyDto {
  @ApiProperty({
    example: '우리 가족',
    description: '가족 이름. 공백만 있는 값은 허용되지 않습니다.',
  })
  name: string;
}
