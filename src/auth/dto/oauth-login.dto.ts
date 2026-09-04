import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthProvider } from '../../../generated/prisma/enums';

export class OAuthLoginDto {
  @ApiProperty({
    enum: AuthProvider,
    enumName: 'AuthProvider',
    example: 'GOOGLE',
    description: 'OAuth 제공자',
  })
  provider: AuthProvider;

  @ApiProperty({
    example: 'google-123',
    description: 'OAuth 제공자의 사용자 식별자',
  })
  providerId: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'user@example.com',
    description: '이메일. 없거나 제공되지 않으면 null',
  })
  email?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '홍길동',
    description: '표시 이름. 없거나 제공되지 않으면 null',
  })
  displayName?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'https://example.com/avatar.png',
    description: '프로필 이미지 URL. 없거나 제공되지 않으면 null',
  })
  profileImage?: string | null;
}
