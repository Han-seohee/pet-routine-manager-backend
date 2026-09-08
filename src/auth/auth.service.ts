import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { User } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from './dto/jwt-payload.dto';
import type { OAuthLoginDto } from './dto/oauth-login.dto';

const AUTHORIZATION_CODE_TTL_MS = 60_000;
const AUTHORIZATION_CODE_BYTES = 32;

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

  async createAuthorizationCode(user: User): Promise<string> {
    const code = randomBytes(AUTHORIZATION_CODE_BYTES).toString('base64url');

    await this.prisma.authorizationCode.create({
      data: {
        codeHash: this.hashAuthorizationCode(code),
        userId: user.id,
        expiresAt: new Date(Date.now() + AUTHORIZATION_CODE_TTL_MS),
      },
    });

    return code;
  }

  async exchangeAuthorizationCode(
    code: string,
  ): Promise<{ accessToken: string }> {
    if (typeof code !== 'string' || code.length === 0) {
      throw new UnauthorizedException();
    }

    const codeHash = this.hashAuthorizationCode(code);
    const now = new Date();

    const consumed = await this.prisma.authorizationCode.updateMany({
      where: {
        codeHash,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        usedAt: now,
      },
    });

    if (consumed.count !== 1) {
      throw new UnauthorizedException();
    }

    const record = await this.prisma.authorizationCode.findUnique({
      where: { codeHash },
      include: { user: true },
    });

    if (!record?.user) {
      throw new UnauthorizedException();
    }

    return {
      accessToken: this.signAccessToken(record.user),
    };
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

  private hashAuthorizationCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }
}
