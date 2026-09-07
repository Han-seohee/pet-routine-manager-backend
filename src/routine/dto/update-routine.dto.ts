import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRoutineDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '저녁에도 사료를 먹음',
    description:
      '수정할 메모. 빈 문자열이면 null로 저장됩니다. memo 외 필드는 수정할 수 없습니다.',
  })
  memo?: string | null;
}
