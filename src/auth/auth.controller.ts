import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Redirect,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import type { Request, Response } from 'express';
import type { User } from '../../generated/prisma/client';
import { AuthService, REFRESH_TOKEN_TTL_MS } from './auth.service';
import {
  AccessTokenResponseDto,
  AuthTokensResponseDto,
  ExchangeAuthorizationCodeDto,
} from './dto/exchange-authorization-code.dto';
import type { AuthenticatedUser } from './dto/jwt-payload.dto';
import { OAuthLoginDto } from './dto/oauth-login.dto';
import {
  CurrentUserResponseDto,
  LogoutResponseDto,
  OAuthLoginResponseDto,
} from './dto/user-response.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { KakaoAuthGuard } from './guards/kakao-auth.guard';

const REFRESH_TOKEN_COOKIE_NAME = 'prm_refresh_token';

type GoogleAuthenticatedRequest = Request & { user: User };
type KakaoAuthenticatedRequest = Request & { user: User };
type JwtAuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

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
  @Redirect()
  @ApiOperation({
    summary: 'Google OAuth 콜백',
    description:
      'Google이 provider authorization code와 함께 리다이렉트하는 콜백입니다. 직접 호출하는 API가 아니라 OAuth 플로우의 일부입니다. 인증에 성공하면 앱 전용 일회용 authorization code를 발급하고 FRONTEND_URL/auth/callback 으로 302 리다이렉트합니다. JWT는 발급하지 않습니다.',
  })
  @ApiQuery({
    name: 'code',
    required: true,
    description: 'Google이 전달하는 provider authorization code',
  })
  @ApiResponse({
    status: 302,
    description:
      'FRONTEND_URL/auth/callback?code=앱 전용 일회용 authorization code 로 리다이렉트합니다.',
  })
  @ApiUnauthorizedResponse({
    description: 'Google OAuth 인증에 실패한 경우',
  })
  async googleAuthCallback(
    @Req() req: GoogleAuthenticatedRequest,
  ): Promise<{ url: string; statusCode: number }> {
    return this.redirectToFrontendWithAuthorizationCode(req.user);
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
  @Redirect()
  @ApiOperation({
    summary: 'Kakao OAuth 콜백',
    description:
      'Kakao가 provider authorization code와 함께 리다이렉트하는 콜백입니다. 직접 호출하는 API가 아니라 OAuth 플로우의 일부입니다. 인증에 성공하면 앱 전용 일회용 authorization code를 발급하고 FRONTEND_URL/auth/callback 으로 302 리다이렉트합니다. JWT는 발급하지 않습니다.',
  })
  @ApiQuery({
    name: 'code',
    required: true,
    description: 'Kakao가 전달하는 provider authorization code',
  })
  @ApiResponse({
    status: 302,
    description:
      'FRONTEND_URL/auth/callback?code=앱 전용 일회용 authorization code 로 리다이렉트합니다.',
  })
  @ApiUnauthorizedResponse({
    description: 'Kakao OAuth 인증에 실패한 경우',
  })
  async kakaoAuthCallback(
    @Req() req: KakaoAuthenticatedRequest,
  ): Promise<{ url: string; statusCode: number }> {
    return this.redirectToFrontendWithAuthorizationCode(req.user);
  }

  @Post('token')
  @ApiOperation({
    summary: '앱 전용 authorization code를 JWT로 교환',
    description:
      'OAuth callback에서 발급한 앱 전용 일회용 authorization code를 검증하고, 성공 시 JWT accessToken을 반환합니다. Refresh Token은 HttpOnly Cookie(prm_refresh_token)로 설정합니다. Google/Kakao provider code는 사용할 수 없습니다.',
  })
  @ApiBody({ type: ExchangeAuthorizationCodeDto })
  @ApiOkResponse({ type: AccessTokenResponseDto })
  @ApiUnauthorizedResponse({
    description: 'authorization code가 없거나, 만료되었거나, 이미 사용된 경우',
  })
  async exchangeAuthorizationCode(
    @Body() body: ExchangeAuthorizationCodeDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenResponseDto> {
    const { accessToken, refreshToken } =
      await this.authService.exchangeAuthorizationCode(body.code);

    this.setRefreshTokenCookie(res, refreshToken);

    return { accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh Token Rotation',
    description:
      'HttpOnly Cookie(prm_refresh_token)의 Refresh Token을 검증하고, 성공 시 새로운 JWT accessToken과 교체된 Refresh Token을 반환합니다. Next.js Route Handler가 두 값을 받아 Cookie를 설정합니다. 기존 Refresh Token은 폐기되고 replacedByTokenId로 새 토큰과 연결됩니다.',
  })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  @ApiUnauthorizedResponse({
    description:
      'Refresh Token Cookie가 없거나, 존재하지 않거나, 만료되었거나, 폐기되었거나, 연결된 사용자가 없는 경우',
  })
  refreshAccessToken(@Req() req: Request): Promise<AuthTokensResponseDto> {
    return this.authService.refreshAccessToken(
      this.readRefreshTokenCookie(req),
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '현재 Device Refresh Token 폐기',
    description:
      'Cookie(prm_refresh_token)의 현재 Refresh Token만 폐기합니다. Cookie가 없거나 이미 폐기된 토큰이어도 성공합니다. 다른 기기의 Refresh Token과 Access Token은 변경하지 않습니다.',
  })
  @ApiOkResponse({ type: LogoutResponseDto })
  logout(@Req() req: Request): Promise<LogoutResponseDto> {
    return this.authService.logout(this.readRefreshTokenCookie(req));
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

  private readRefreshTokenCookie(req: Request): string | undefined {
    const cookieHeader = req.headers.cookie;
    if (typeof cookieHeader !== 'string' || cookieHeader.length === 0) {
      return undefined;
    }

    for (const part of cookieHeader.split(';')) {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }

      const name = part.slice(0, separatorIndex).trim();
      if (name !== REFRESH_TOKEN_COOKIE_NAME) {
        continue;
      }

      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    }

    return undefined;
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: REFRESH_TOKEN_TTL_MS,
    });
  }

  private async redirectToFrontendWithAuthorizationCode(
    user: User,
  ): Promise<{ url: string; statusCode: number }> {
    const code = await this.authService.createAuthorizationCode(user);
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    const callbackUrl = new URL('/auth/callback', frontendUrl);
    callbackUrl.searchParams.set('code', code);

    return {
      url: callbackUrl.toString(),
      statusCode: 302,
    };
  }
}
