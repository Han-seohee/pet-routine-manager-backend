import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    example: '미용',
    description: 'Category 이름. 공백만 있는 값은 허용되지 않습니다.',
  })
  name: string;
}
