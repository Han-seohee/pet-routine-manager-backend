import { ApiProperty } from '@nestjs/swagger';

export class RoutineUserSummaryDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: '나',
    description: '작성자의 화면 표시 이름',
  })
  displayName: string | null;
}

export class RoutineCategorySummaryDto {
  @ApiProperty({ example: '밥' })
  name: string;
}

export class RoutineSubCategorySummaryDto {
  @ApiProperty({ example: '사료' })
  name: string;
}

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
    description: 'SubCategory ID. Category만으로 기록했거나 삭제된 경우 null',
  })
  subCategoryId: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-09-16T04:10:00.000Z',
    description: '실제로 펫을 케어한 수행 시각',
  })
  recordedAt: Date;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '아침 사료를 잘 먹음',
    description: '선택 메모',
  })
  memo: string | null;

  @ApiProperty({ type: RoutineUserSummaryDto })
  user: RoutineUserSummaryDto;

  @ApiProperty({ type: RoutineCategorySummaryDto })
  category: RoutineCategorySummaryDto;

  @ApiProperty({
    type: RoutineSubCategorySummaryDto,
    nullable: true,
    description:
      'SubCategory 정보. Category만으로 기록했거나 SubCategory가 삭제된 경우 null',
  })
  subCategory: RoutineSubCategorySummaryDto | null;
}
