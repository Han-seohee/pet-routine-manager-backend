import { ApiProperty } from '@nestjs/swagger';

export class CreateSubCategoryDto {
  @ApiProperty({
    example: '닭가슴살',
    description: 'SubCategory 이름. 공백만 있는 값은 허용되지 않습니다.',
  })
  name: string;
}
