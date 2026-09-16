import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRoutineDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-09-16T04:10:00.000Z',
    description:
      '수정할 수행 시각. ISO 8601 datetime. 생략하면 기존 값을 유지합니다.',
  })
  recordedAt?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '저녁에도 사료를 먹음',
    description:
      '수정할 메모. 빈 문자열이면 null로 저장됩니다. 생략하면 기존 값을 유지합니다.',
  })
  memo?: string | null;
}
