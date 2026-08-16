import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from './dto/jwt-payload.dto';
import type { OAuthLoginDto } from './dto/oauth-login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  signAccessToken(user: User): string {
    const payload: JwtPayload = { sub: user.id };

    return this.jwtService.sign(payload);
  }

  async findOrCreateUser(profile: OAuthLoginDto): Promise<User> {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        provider_providerId: {
          provider: profile.provider,
          providerId: profile.providerId,
        },
      },
    });

    if (existingUser) {
      return existingUser;
    }

    return this.prisma.user.create({
      data: {
        provider: profile.provider,
        providerId: profile.providerId,
        email: profile.email ?? null,
        displayName: profile.displayName ?? null,
        profileImage: profile.profileImage ?? null,
      },
    });
  }
}
