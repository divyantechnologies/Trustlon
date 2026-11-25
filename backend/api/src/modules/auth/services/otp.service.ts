import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { Env } from '../../../config/env';
import { PrismaService } from '../../../prisma/prisma.service';
import { OTP_SENDER, OtpSender } from '../../notifications/otp-sender';
import { MESSAGES } from '../auth.constants';

export interface OtpIssueResult {
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    @Inject(OTP_SENDER) private readonly sender: OtpSender,
  ) {}

  private get ttlSeconds() {
    return this.config.get('OTP_TTL_SECONDS', { infer: true });
  }
  private get resendSeconds() {
    return this.config.get('OTP_RESEND_SECONDS', { infer: true });
  }
  private get maxAttempts() {
    return this.config.get('OTP_MAX_ATTEMPTS', { infer: true });
  }
  private get lockMinutes() {
    return this.config.get('OTP_LOCK_MINUTES', { infer: true });
  }

  /** Response shape returned to the client after a send request, whether or not a code was sent. */
  issueResult(): OtpIssueResult {
    return { expiresInSeconds: this.ttlSeconds, resendAfterSeconds: this.resendSeconds };
  }

  async issue(params: {
    channel: OtpChannel;
    target: string;
    purpose: OtpPurpose;
    ip?: string;
  }): Promise<OtpIssueResult> {
    const now = new Date();
    const latest = await this.prisma.otpChallenge.findFirst({
      where: { target: params.target, purpose: params.purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (latest?.lockedUntil && latest.lockedUntil > now) {
      throw this.tooManyRequests(latest.lockedUntil, now);
    }
    if (latest && !latest.consumedAt) {
      const resendAt = new Date(latest.createdAt.getTime() + this.resendSeconds * 1000);
      if (resendAt > now) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Please wait before requesting a new code',
            retryAfterSeconds: Math.ceil((resendAt.getTime() - now.getTime()) / 1000),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.otpChallenge.create({
      data: {
        channel: params.channel,
        target: params.target,
        purpose: params.purpose,
        codeHash: this.hash(params.target, params.purpose, code),
        expiresAt: new Date(now.getTime() + this.ttlSeconds * 1000),
        ip: params.ip?.slice(0, 45),
      },
    });

    await this.sender.send({
      channel: params.channel,
      target: params.target,
      purpose: params.purpose,
      code,
    });

    return this.issueResult();
  }

  /** Consumes the latest code for the target. Throws on a wrong, expired or locked code. */
  async verify(params: { target: string; purpose: OtpPurpose; code: string }): Promise<void> {
    const now = new Date();
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { target: params.target, purpose: params.purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge || challenge.consumedAt) {
      throw new BadRequestException(MESSAGES.INVALID_OTP);
    }
    if (challenge.lockedUntil && challenge.lockedUntil > now) {
      throw this.tooManyRequests(challenge.lockedUntil, now);
    }
    if (challenge.expiresAt <= now) {
      throw new BadRequestException(MESSAGES.INVALID_OTP);
    }

    const expected = Buffer.from(challenge.codeHash, 'hex');
    const actual = Buffer.from(this.hash(params.target, params.purpose, params.code), 'hex');
    const matches = expected.length === actual.length && timingSafeEqual(expected, actual);

    if (!matches) {
      const updated = await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      if (updated.attempts >= this.maxAttempts) {
        const lockedUntil = new Date(now.getTime() + this.lockMinutes * 60 * 1000);
        await this.prisma.otpChallenge.update({
          where: { id: challenge.id },
          data: { lockedUntil },
        });
        throw this.tooManyRequests(lockedUntil, now);
      }
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: MESSAGES.INVALID_OTP,
        attemptsLeft: this.maxAttempts - updated.attempts,
      });
    }

    const consumed = await this.prisma.otpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null },
      data: { consumedAt: now },
    });
    if (consumed.count === 0) {
      throw new BadRequestException(MESSAGES.INVALID_OTP);
    }
  }

  private hash(target: string, purpose: OtpPurpose, code: string): string {
    return createHmac('sha256', this.config.get('OTP_SECRET', { infer: true }))
      .update(`${target}:${purpose}:${code}`)
      .digest('hex');
  }

  private tooManyRequests(until: Date, now: Date): HttpException {
    return new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: `Too many attempts. Try again in ${this.lockMinutes} minutes.`,
        retryAfterSeconds: Math.ceil((until.getTime() - now.getTime()) / 1000),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
