import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { RefreshToken, User } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from './dto/jwt-payload.dto';
import type { OAuthLoginDto } from './dto/oauth-login.dto';

const AUTHORIZATION_CODE_TTL_MS = 60_000;
const AUTHORIZATION_CODE_BYTES = 32;
const REFRESH_TOKEN_BYTES = 32;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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
  ): Promise<{ accessToken: string; refreshToken: string }> {
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

    const refreshToken = await this.createRefreshToken(record.user);

    return {
      accessToken: this.signAccessToken(record.user),
      refreshToken,
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

  async refreshAccessToken(
    refreshToken: string | undefined,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
      throw new UnauthorizedException();
    }

    const tokenHash = this.hashRefreshToken(refreshToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record) {
      throw new UnauthorizedException();
    }

    if (record.revokedAt !== null) {
      if (record.replacedByTokenId !== null) {
        await this.prisma.$transaction(async (tx) => {
          await this.revokeRefreshTokenChain(tx, record);
        });
      }

      throw new UnauthorizedException();
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException();
    }

    if (!record.user) {
      throw new UnauthorizedException();
    }

    const user = record.user;
    const nextRefreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString(
      'base64url',
    );
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const nextRefreshTokenRecord = await tx.refreshToken.create({
        data: {
          tokenHash: this.hashRefreshToken(nextRefreshToken),
          userId: user.id,
          expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
          revokedAt: null,
        },
      });

      const revoked = await tx.refreshToken.updateMany({
        where: {
          id: record.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          revokedAt: now,
          replacedByTokenId: nextRefreshTokenRecord.id,
        },
      });

      if (revoked.count !== 1) {
        throw new UnauthorizedException();
      }
    });

    return {
      accessToken: this.signAccessToken(user),
      refreshToken: nextRefreshToken,
    };
  }

  async logout(refreshToken: string | undefined): Promise<{ ok: true }> {
    if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
      return { ok: true };
    }

    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: this.hashRefreshToken(refreshToken),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { ok: true };
  }

  private async createRefreshToken(user: User): Promise<string> {
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashRefreshToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        revokedAt: null,
      },
    });

    return refreshToken;
  }

  private async revokeRefreshTokenChain(
    tx: { refreshToken: PrismaService['refreshToken'] },
    reusedToken: Pick<RefreshToken, 'id' | 'userId' | 'replacedByTokenId'>,
  ): Promise<void> {
    const chainIds = await this.collectRefreshTokenChainIds(tx, reusedToken);

    await tx.refreshToken.updateMany({
      where: {
        id: { in: chainIds },
        userId: reusedToken.userId,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  private async collectRefreshTokenChainIds(
    tx: { refreshToken: PrismaService['refreshToken'] },
    reusedToken: Pick<RefreshToken, 'id' | 'userId' | 'replacedByTokenId'>,
  ): Promise<string[]> {
    let root: Pick<RefreshToken, 'id' | 'userId' | 'replacedByTokenId'> =
      reusedToken;
    const seenBackward = new Set<string>([reusedToken.id]);

    for (;;) {
      const predecessor = await tx.refreshToken.findUnique({
        where: { replacedByTokenId: root.id },
      });

      if (!predecessor) {
        break;
      }

      if (predecessor.userId !== reusedToken.userId) {
        throw new UnauthorizedException();
      }

      if (seenBackward.has(predecessor.id)) {
        break;
      }

      seenBackward.add(predecessor.id);
      root = predecessor;
    }

    const chainIds: string[] = [];
    const seenForward = new Set<string>();
    let current: Pick<
      RefreshToken,
      'id' | 'userId' | 'replacedByTokenId'
    > | null = root;

    while (current) {
      if (current.userId !== reusedToken.userId) {
        throw new UnauthorizedException();
      }

      if (seenForward.has(current.id)) {
        break;
      }

      seenForward.add(current.id);
      chainIds.push(current.id);

      if (!current.replacedByTokenId) {
        break;
      }

      current = await tx.refreshToken.findUnique({
        where: { id: current.replacedByTokenId },
      });
    }

    return chainIds;
  }

  private hashAuthorizationCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
