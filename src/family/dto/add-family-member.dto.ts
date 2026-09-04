import { ApiProperty } from '@nestjs/swagger';

export class AddFamilyMemberDto {
  @ApiProperty({
    format: 'uuid',
    example: '22222222-2222-2222-2222-222222222222',
    description: '가족에 추가할 사용자 ID',
  })
  userId: string;
}
