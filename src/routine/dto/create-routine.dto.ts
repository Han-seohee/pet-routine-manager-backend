import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoutineDto {
  @ApiProperty({
    format: 'uuid',
    example: '11111111-1111-1111-1111-111111111111',
    description: '해당 Pet에 속한 Category ID',
  })
  categoryId: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    example: '22222222-2222-2222-2222-222222222222',
    description:
      '해당 Category에 속한 SubCategory ID. Category만으로 기록할 경우 생략하거나 null',
  })
  subCategoryId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '아침 사료를 잘 먹음',
    description: '선택 메모. 생략하거나 빈 문자열이면 null로 저장됩니다.',
  })
  memo?: string | null;
}
