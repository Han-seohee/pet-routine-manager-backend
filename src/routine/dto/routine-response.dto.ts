import { ApiProperty } from '@nestjs/swagger';

export class RoutineResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '33333333-3333-3333-3333-333333333333',
  })
  id: string;

  @ApiProperty({
    format: 'uuid',
    example: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  })
  petId: string;

  @ApiProperty({
    format: 'uuid',
    example: '11111111-1111-1111-1111-111111111111',
  })
  userId: string;

  @ApiProperty({
    format: 'uuid',
    example: '44444444-4444-4444-4444-444444444444',
  })
  categoryId: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    example: '55555555-5555-5555-5555-555555555555',
    description: 'SubCategory ID. Category만으로 기록한 경우 null',
  })
  subCategoryId: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-09-07T08:00:00.000Z',
    description: '기록이 생성된 시간. 서버에서 자동 생성됩니다.',
  })
  recordedAt: Date;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '아침 사료를 잘 먹음',
    description: '선택 메모',
  })
  memo: string | null;
}
