import { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  role: UserRole;
  sessionId: string;
  /** True only for admin panel sessions that passed two-factor authentication. */
  mfa: boolean;
}

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  sid: string;
  /** Present and true for admin panel sessions that passed two-factor authentication. */
  mfa?: boolean;
}

export const ACCESS_TOKEN_AUDIENCE = 'trustlon:access';
export const VERIFICATION_TOKEN_AUDIENCE = 'trustlon:otp-verification';
