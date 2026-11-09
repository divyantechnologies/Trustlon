import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OtpChannel, OtpPurpose, Prisma, User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { Identifier, parseIdentifier, phoneRegion } from '../../common/utils/identifier';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AUTH_EVENTS,
  BCRYPT_ROUNDS,
  MESSAGES,
  UserLoggedInEvent,
  UserRegisteredEvent,
} from './auth.constants';
import {
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  SendOtpDto,
  SignupDetailsDto,
  SignupDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { OtpService } from './services/otp.service';
import { IssuedSession, RequestMeta, SessionService } from './services/session.service';

/** Used to keep response time the same whether or not the account exists. */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('timing-equaliser', BCRYPT_ROUNDS);

const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type VerifyOtpResult =
  | { kind: 'session'; session: IssuedSession }
  | { kind: 'verification'; verificationToken: string; expiresInSeconds: number };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly sessions: SessionService,
    private readonly events: EventEmitter2,
  ) {}

  async sendOtp(dto: SendOtpDto, meta: RequestMeta) {
    const identifier = this.requireIdentifier(dto.identifier);

    if (dto.purpose === OtpPurpose.SIGNUP) {
      await this.assertAvailable(identifier);
      const result = await this.otp.issue({
        channel: identifier.type === 'mobile' ? OtpChannel.SMS : OtpChannel.EMAIL,
        target: identifier.value,
        purpose: dto.purpose,
        ip: meta.ip,
      });
      return { message: MESSAGES.OTP_SENT, ...result };
    }

    const user = await this.findActiveByIdentifier(identifier);
    if (!user) {
      return { message: MESSAGES.OTP_SENT_GENERIC, ...this.otp.issueResult() };
    }
    const result = await this.otp.issue({
      channel: identifier.type === 'mobile' ? OtpChannel.SMS : OtpChannel.EMAIL,
      target: identifier.value,
      purpose: dto.purpose,
      ip: meta.ip,
    });
    return { message: MESSAGES.OTP_SENT_GENERIC, ...result };
  }

  async verifyOtp(dto: VerifyOtpDto, meta: RequestMeta): Promise<VerifyOtpResult> {
    const identifier = this.requireIdentifier(dto.identifier);
    await this.otp.verify({ target: identifier.value, purpose: dto.purpose, code: dto.code });

    if (dto.purpose === OtpPurpose.LOGIN) {
      const user = await this.findActiveByIdentifier(identifier);
      if (!user) throw new BadRequestException(MESSAGES.INVALID_OTP);
      return { kind: 'session', session: await this.startSession(user, meta, dto.guestCartToken) };
    }

    let passwordVersion: string | undefined;
    if (dto.purpose === OtpPurpose.RESET_PASSWORD) {
      const user = await this.findActiveByIdentifier(identifier);
      if (!user) throw new BadRequestException(MESSAGES.INVALID_OTP);
      passwordVersion = this.passwordVersion(user);
    }
    const verification = await this.sessions.signVerificationToken(
      identifier.value,
      dto.purpose,
      passwordVersion,
    );
    return { kind: 'verification', ...verification };
  }

  /** Checks details before any code is sent, so conflicts are reported on the first step. */
  async validateSignup(dto: SignupDetailsDto): Promise<{ valid: true }> {
    await this.assertAvailable({ type: 'email', value: dto.email });
    await this.assertAvailable({ type: 'mobile', value: dto.mobile });
    await this.findReferrerId(dto.referralCode);
    return { valid: true };
  }

  async signup(dto: SignupDto, meta: RequestMeta): Promise<IssuedSession> {
    const [emailProof, mobileProof] = await Promise.all([
      this.sessions.readVerificationToken(dto.emailVerificationToken, OtpPurpose.SIGNUP),
      this.sessions.readVerificationToken(dto.mobileVerificationToken, OtpPurpose.SIGNUP),
    ]);
    if (emailProof.target !== dto.email || mobileProof.target !== dto.mobile) {
      throw new UnauthorizedException(MESSAGES.VERIFICATION_EXPIRED);
    }

    await this.assertAvailable({ type: 'email', value: dto.email });
    await this.assertAvailable({ type: 'mobile', value: dto.mobile });
    const referredById = await this.findReferrerId(dto.referralCode);

    const now = new Date();
    const user = await this.createUserWithUniqueReferralCode({
      fullName: dto.fullName,
      email: dto.email,
      mobile: dto.mobile,
      country: dto.country ?? phoneRegion(dto.mobile),
      passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      passwordChangedAt: now,
      preferredLanguage: dto.preferredLanguage,
      emailVerifiedAt: now,
      mobileVerifiedAt: now,
      termsAcceptedAt: now,
      marketingOptIn: dto.marketingOptIn ?? false,
      lastLoginAt: now,
      referredBy: referredById ? { connect: { id: referredById } } : undefined,
    });

    const event: UserRegisteredEvent = { userId: user.id, referredById };
    this.events.emit(AUTH_EVENTS.USER_REGISTERED, event);

    return this.sessions.create(user, meta);
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<IssuedSession> {
    const identifier = parseIdentifier(dto.identifier);
    const user = identifier ? await this.findByIdentifier(identifier) : null;

    const passwordOk = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !user.passwordHash || !passwordOk) {
      throw new UnauthorizedException(MESSAGES.INVALID_CREDENTIALS);
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(MESSAGES.ACCOUNT_BLOCKED);
    }

    return this.startSession(user, meta, dto.guestCartToken);
  }

  refresh(rawToken: string | undefined): Promise<IssuedSession> {
    return this.sessions.rotate(rawToken);
  }

  logout(rawToken: string | undefined): Promise<void> {
    return this.sessions.revokeByToken(rawToken);
  }

  forgotPassword(dto: ForgotPasswordDto, meta: RequestMeta) {
    return this.sendOtp({ identifier: dto.identifier, purpose: OtpPurpose.RESET_PASSWORD }, meta);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const proof = await this.sessions.readVerificationToken(
      dto.verificationToken,
      OtpPurpose.RESET_PASSWORD,
    );
    const identifier = this.requireIdentifier(proof.target);
    const user = await this.findActiveByIdentifier(identifier);
    if (!user) throw new UnauthorizedException(MESSAGES.VERIFICATION_EXPIRED);

    if (proof.pv !== this.passwordVersion(user)) {
      throw new UnauthorizedException(MESSAGES.VERIFICATION_EXPIRED);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS),
        passwordChangedAt: new Date(),
      },
    });
    await this.sessions.revokeAllForUser(user.id, 'password_reset');

    return { message: MESSAGES.PASSWORD_RESET };
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async startSession(
    user: User,
    meta: RequestMeta,
    guestCartToken?: string,
  ): Promise<IssuedSession> {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    const event: UserLoggedInEvent = { userId: user.id, guestCartToken };
    this.events.emit(AUTH_EVENTS.USER_LOGGED_IN, event);
    return this.sessions.create(updated, meta);
  }

  private async assertAvailable(identifier: Identifier): Promise<void> {
    const existing = await this.prisma.user.findFirst({
      where: identifier.type === 'mobile' ? { mobile: identifier.value } : { email: identifier.value },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        message: identifier.type === 'mobile' ? MESSAGES.MOBILE_TAKEN : MESSAGES.EMAIL_TAKEN,
        field: identifier.type === 'mobile' ? 'mobile' : 'email',
      });
    }
  }

  private async findReferrerId(referralCode?: string): Promise<string | null> {
    if (!referralCode) return null;
    const referrer = await this.prisma.user.findUnique({
      where: { referralCode },
      select: { id: true },
    });
    if (!referrer) {
      throw new BadRequestException({
        statusCode: 400,
        message: MESSAGES.INVALID_REFERRAL,
        field: 'referralCode',
      });
    }
    return referrer.id;
  }

  private passwordVersion(user: User): string {
    return createHash('sha256')
      .update(`${user.id}:${user.passwordHash ?? ''}:${user.passwordChangedAt?.getTime() ?? 0}`)
      .digest('hex')
      .slice(0, 32);
  }

  private requireIdentifier(raw: string): Identifier {
    const identifier = parseIdentifier(raw);
    if (!identifier) throw new BadRequestException(MESSAGES.INVALID_IDENTIFIER);
    return identifier;
  }

  private findByIdentifier(identifier: Identifier): Promise<User | null> {
    return this.prisma.user.findFirst({
      where:
        identifier.type === 'mobile'
          ? { mobile: identifier.value, deletedAt: null }
          : { email: identifier.value, deletedAt: null },
    });
  }

  private async findActiveByIdentifier(identifier: Identifier): Promise<User | null> {
    const user = await this.findByIdentifier(identifier);
    return user && user.status === UserStatus.ACTIVE ? user : null;
  }

  private async createUserWithUniqueReferralCode(
    data: Omit<Prisma.UserCreateInput, 'referralCode'>,
  ): Promise<User> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.user.create({
          data: { ...data, referralCode: generateReferralCode() },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const target = String((error.meta?.target as string[] | string | undefined) ?? '');
          if (target.includes('mobile')) {
            throw new ConflictException({ statusCode: 409, message: MESSAGES.MOBILE_TAKEN, field: 'mobile' });
          }
          if (target.includes('email')) {
            throw new ConflictException({ statusCode: 409, message: MESSAGES.EMAIL_TAKEN, field: 'email' });
          }
          if (target.includes('referral')) continue;
        }
        throw error;
      }
    }
    throw new Error('Could not generate a unique referral code');
  }
}

function generateReferralCode(): string {
  const bytes = randomBytes(8);
  let code = 'TL';
  for (const byte of bytes) code += REFERRAL_ALPHABET[byte % REFERRAL_ALPHABET.length];
  return code;
}
