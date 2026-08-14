import type { AuthProvider } from '../../../generated/prisma/client';

export type OAuthLoginDto = {
  provider: AuthProvider;
  providerId: string;
  email?: string | null;
  displayName?: string | null;
  profileImage?: string | null;
};
