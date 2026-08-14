import { Body, Controller, Post } from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { AuthService } from './auth.service';
import type { OAuthLoginDto } from './dto/oauth-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('oauth/login')
  async oauthLogin(
    @Body() body: OAuthLoginDto,
  ): Promise<{ user: User }> {
    const user = await this.authService.findOrCreateUser(body);

    return { user };
  }
}
