import { ApiProperty } from '@nestjs/swagger';

export class SubCategoryResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '55555555-5555-5555-5555-555555555555',
  })
  id: string;

  @ApiProperty({
    format: 'uuid',
    example: '44444444-4444-4444-4444-444444444444',
  })
  categoryId: string;

  @ApiProperty({ example: '사료' })
  name: string;
}
