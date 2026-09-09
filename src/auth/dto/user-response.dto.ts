import { ApiProperty } from '@nestjs/swagger';
import { AuthProvider } from '../../../generated/prisma/enums';

export class UserResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '11111111-1111-1111-1111-111111111111',
  })
  id: string;

  @ApiProperty({
    enum: AuthProvider,
    enumName: 'AuthProvider',
    example: 'GOOGLE',
  })
  provider: AuthProvider;

  @ApiProperty({ example: 'google-123' })
  providerId: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'user@example.com',
  })
  email: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '홍길동',
  })
  displayName: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://example.com/avatar.png',
  })
  profileImage: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}

export class OAuthLoginResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}

export class CurrentUserResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '11111111-1111-1111-1111-111111111111',
    description: 'JWT payload의 사용자 ID',
  })
  userId: string;
}

export class LogoutResponseDto {
  @ApiProperty({
    example: true,
    description: 'Logout 처리 완료 여부. Cookie가 없어도 true입니다.',
  })
  ok: boolean;
}
