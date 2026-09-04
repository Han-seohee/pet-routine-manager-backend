import { ApiProperty } from '@nestjs/swagger';

export class UpdateFamilyDto {
  @ApiProperty({
    example: '새 가족 이름',
    description: '변경할 가족 이름. 공백만 있는 값은 허용되지 않습니다.',
  })
  name: string;
}
