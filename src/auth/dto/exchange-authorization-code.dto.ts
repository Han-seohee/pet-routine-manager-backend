import { ApiProperty } from '@nestjs/swagger';

export class ExchangeAuthorizationCodeDto {
  @ApiProperty({
    example: 'n3xT1meAuthorizationCodeExampleValue',
    description:
      'OAuth callback 이후 프론트엔드로 전달된 앱 전용 일회용 authorization code. Google/Kakao provider code가 아닙니다.',
  })
  code: string;
}

export class AccessTokenResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: '이후 API 호출에 사용하는 JWT access token',
  })
  accessToken: string;
}
