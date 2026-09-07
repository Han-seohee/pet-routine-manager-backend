import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '44444444-4444-4444-4444-444444444444',
  })
  id: string;

  @ApiProperty({
    format: 'uuid',
    example: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  })
  petId: string;

  @ApiProperty({ example: '밥' })
  name: string;
}
