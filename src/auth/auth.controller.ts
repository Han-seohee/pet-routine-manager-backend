import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { User } from '../../generated/prisma/client';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './dto/jwt-payload.dto';
import { OAuthLoginDto } from './dto/oauth-login.dto';
import {
  CurrentUserResponseDto,
  OAuthCallbackResponseDto,
  OAuthLoginResponseDto,
} from './dto/user-response.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { KakaoAuthGuard } from './guards/kakao-auth.guard';

type GoogleAuthenticatedRequest = Request & { user: User };
type KakaoAuthenticatedRequest = Request & { user: User };
type JwtAuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('oauth/login')
  @ApiOperation({
    summary: 'OAuth 프로필로 사용자 조회 또는 생성',
    description:
      'Google/Kakao 프로필 정보를 받아 기존 사용자를 조회하거나 새로 생성합니다. JWT를 발급하지 않습니다.',
  })
  @ApiBody({ type: OAuthLoginDto })
  @ApiCreatedResponse({ type: OAuthLoginResponseDto })
  async oauthLogin(@Body() body: OAuthLoginDto): Promise<{ user: User }> {
    const user = await this.authService.findOrCreateUser(body);

    return { user };
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: 'Google OAuth 로그인 시작',
    description:
      '브라우저에서 호출해야 합니다. Google 로그인/동의 화면으로 302 리다이렉트한 뒤, 성공 시 `/auth/google/callback`으로 돌아옵니다. Swagger UI Try it out으로는 리다이렉트 이후 흐름을 완료할 수 없습니다.',
  })
  @ApiResponse({
    status: 302,
    description: 'Google OAuth 동의 화면으로 리다이렉트합니다.',
  })
  googleAuth(): void {
    // Passport redirects to Google OAuth.
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: 'Google OAuth 콜백',
    description:
      'Google이 authorization code와 함께 리다이렉트하는 콜백입니다. 직접 호출하는 API가 아니라 OAuth 플로우의 일부입니다. 인증에 성공하면 사용자 정보와 JWT accessToken을 반환합니다.',
  })
  @ApiQuery({
    name: 'code',
    required: true,
    description: 'Google이 전달하는 authorization code',
  })
  @ApiOkResponse({ type: OAuthCallbackResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Google OAuth 인증에 실패한 경우',
  })
  googleAuthCallback(@Req() req: GoogleAuthenticatedRequest): {
    user: User;
    accessToken: string;
  } {
    const accessToken = this.authService.signAccessToken(req.user);

    return { user: req.user, accessToken };
  }

  @Get('kakao')
  @UseGuards(KakaoAuthGuard)
  @ApiOperation({
    summary: 'Kakao OAuth 로그인 시작',
    description:
      '브라우저에서 호출해야 합니다. Kakao 로그인/동의 화면으로 302 리다이렉트한 뒤, 성공 시 `/auth/kakao/callback`으로 돌아옵니다. Swagger UI Try it out으로는 리다이렉트 이후 흐름을 완료할 수 없습니다.',
  })
  @ApiResponse({
    status: 302,
    description: 'Kakao OAuth 동의 화면으로 리다이렉트합니다.',
  })
  kakaoAuth(): void {
    // Passport redirects to Kakao OAuth.
  }

  @Get('kakao/callback')
  @UseGuards(KakaoAuthGuard)
  @ApiOperation({
    summary: 'Kakao OAuth 콜백',
    description:
      'Kakao가 authorization code와 함께 리다이렉트하는 콜백입니다. 직접 호출하는 API가 아니라 OAuth 플로우의 일부입니다. 인증에 성공하면 사용자 정보와 JWT accessToken을 반환합니다.',
  })
  @ApiQuery({
    name: 'code',
    required: true,
    description: 'Kakao가 전달하는 authorization code',
  })
  @ApiOkResponse({ type: OAuthCallbackResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Kakao OAuth 인증에 실패한 경우',
  })
  kakaoAuthCallback(@Req() req: KakaoAuthenticatedRequest): {
    user: User;
    accessToken: string;
  } {
    const accessToken = this.authService.signAccessToken(req.user);

    return { user: req.user, accessToken };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '현재 로그인한 사용자 조회',
    description: 'JWT access token에서 추출한 현재 사용자 ID를 반환합니다.',
  })
  @ApiOkResponse({ type: CurrentUserResponseDto })
  @ApiUnauthorizedResponse({
    description: 'JWT가 없거나 유효하지 않습니다.',
  })
  getProfile(@Req() req: JwtAuthenticatedRequest): AuthenticatedUser {
    return req.user;
  }
}
