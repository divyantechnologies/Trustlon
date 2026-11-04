import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose, User, UserStatus } from '@prisma/client';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import {
  ACCESS_TOKEN_AUDIENCE,
  AccessTokenPayload,
  VERIFICATION_TOKEN_AUDIENCE,
} from '../../../common/auth/auth-user';
import { Env } from '../../../config/env';
import { PrismaService } from '../../../prisma/prisma.service';
import { MESSAGES, REFRESH_REUSE_GRACE_SECONDS } from '../auth.constants';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export interface IssuedSession {
  accessToken: string;
  accessTokenExpiresIn: number;
  /** Undefined when the existing refresh cookie stays valid (parallel refresh within the grace window). */
  refreshToken?: string;
  refreshTokenExpiresAt?: Date;
  user: User;
}

interface VerificationPayload {
  target: string;
  purpose: OtpPurpose;
  /** Password version: binds a reset token to the password it replaces, so it works only once. */
  pv?: string;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get accessTtl() {
    return this.config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true });
  }

  async create(user: User, meta: RequestMeta): Promise<IssuedSession> {
    const secret = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * 86_400_000,
    );
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: sha256(secret),
        expiresAt,
        ip: meta.ip?.slice(0, 45),
        userAgent: meta.userAgent?.slice(0, 512),
      },
    });

    return {
      accessToken: await this.signAccessToken(user, session.id),
      accessTokenExpiresIn: this.accessTtl,
      refreshToken: `${session.id}.${secret}`,
      refreshTokenExpiresAt: expiresAt,
      user,
    };
  }

  /** Validates a refresh token and rotates it. Reuse of an old token revokes the session. */
  async rotate(rawToken: string | undefined): Promise<IssuedSession> {
    const parsed = parseRefreshToken(rawToken);
    if (!parsed) throw new UnauthorizedException(MESSAGES.SESSION_EXPIRED);

    const now = new Date();
    const session = await this.prisma.session.findUnique({
      where: { id: parsed.sessionId },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt <= now) {
      throw new UnauthorizedException(MESSAGES.SESSION_EXPIRED);
    }
    if (session.user.status !== UserStatus.ACTIVE || session.user.deletedAt) {
      await this.revoke(session.id, 'user_inactive');
      throw new UnauthorizedException(MESSAGES.SESSION_EXPIRED);
    }

    const presentedHash = sha256(parsed.secret);
    if (!safeEqualHex(presentedHash, session.tokenHash)) {
      const withinGrace =
        session.previousTokenHash &&
        session.rotatedAt &&
        safeEqualHex(presentedHash, session.previousTokenHash) &&
        now.getTime() - session.rotatedAt.getTime() <= REFRESH_REUSE_GRACE_SECONDS * 1000;

      if (withinGrace) {
        return {
          accessToken: await this.signAccessToken(session.user, session.id),
          accessTokenExpiresIn: this.accessTtl,
          user: session.user,
        };
      }

      await this.revoke(session.id, 'reuse_detected');
      throw new UnauthorizedException(MESSAGES.SESSION_EXPIRED);
    }

    const secret = randomBytes(32).toString('base64url');
    const rotated = await this.prisma.session.updateMany({
      where: { id: session.id, tokenHash: session.tokenHash, revokedAt: null },
      data: {
        previousTokenHash: session.tokenHash,
        tokenHash: sha256(secret),
        rotatedAt: now,
        lastUsedAt: now,
      },
    });
    if (rotated.count === 0) {
      return {
        accessToken: await this.signAccessToken(session.user, session.id),
        accessTokenExpiresIn: this.accessTtl,
        user: session.user,
      };
    }

    return {
      accessToken: await this.signAccessToken(session.user, session.id),
      accessTokenExpiresIn: this.accessTtl,
      refreshToken: `${session.id}.${secret}`,
      refreshTokenExpiresAt: session.expiresAt,
      user: session.user,
    };
  }

  async revokeByToken(rawToken: string | undefined): Promise<void> {
    const parsed = parseRefreshToken(rawToken);
    if (!parsed) return;
    await this.revoke(parsed.sessionId, 'logout');
  }

  async revoke(sessionId: string, reason: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async revokeAllForUser(userId: string, reason: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  /** Short-lived proof that the caller owns a mobile number or email (after OTP verification). */
  async signVerificationToken(
    target: string,
    purpose: OtpPurpose,
    passwordVersion?: string,
  ): Promise<{ verificationToken: string; expiresInSeconds: number }> {
    const expiresInSeconds = this.config.get('VERIFICATION_TOKEN_TTL_SECONDS', { infer: true });
    const payload: VerificationPayload = { target, purpose, pv: passwordVersion };
    const verificationToken = await this.jwt.signAsync(
      { ...payload },
      { audience: VERIFICATION_TOKEN_AUDIENCE, expiresIn: expiresInSeconds },
    );
    return { verificationToken, expiresInSeconds };
  }

  async readVerificationToken(token: string, purpose: OtpPurpose): Promise<VerificationPayload> {
    try {
      const payload = await this.jwt.verifyAsync<VerificationPayload>(token, {
        audience: VERIFICATION_TOKEN_AUDIENCE,
      });
      if (payload.purpose !== purpose) throw new Error('purpose mismatch');
      return payload;
    } catch {
      throw new UnauthorizedException(MESSAGES.VERIFICATION_EXPIRED);
    }
  }

  private signAccessToken(user: User, sessionId: string): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role, sid: sessionId };
    return this.jwt.signAsync(payload, {
      audience: ACCESS_TOKEN_AUDIENCE,
      expiresIn: this.accessTtl,
    });
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseRefreshToken(raw: string | undefined): { sessionId: string; secret: string } | null {
  if (!raw) return null;
  const [sessionId, secret, ...rest] = raw.split('.');
  if (rest.length > 0 || !sessionId || !secret || !UUID.test(sessionId)) return null;
  return { sessionId, secret };
}
