import { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  role: UserRole;
  sessionId: string;
}

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  sid: string;
}

export const ACCESS_TOKEN_AUDIENCE = 'trustlon:access';
export const VERIFICATION_TOKEN_AUDIENCE = 'trustlon:otp-verification';
