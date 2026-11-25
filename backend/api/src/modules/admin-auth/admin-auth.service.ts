import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../../common/admin/audit.service';
import { ROLE_PANELS, STAFF_ROLES } from '../../common/admin/permissions';
import { PermissionsService } from '../../common/admin/permissions.service';
import { sha256Hex } from '../../common/security/crypto';
import { Encryption } from '../../common/security/security.module';
import {
  newRecoveryCodes,
  newTotpSecret,
  normaliseRecoveryCode,
  otpauthUri,
  verifyTotp,
} from '../../common/security/totp';
import { PrismaService } from '../../prisma/prisma.service';
import { BCRYPT_ROUNDS } from '../auth/auth.constants';
import { RequestMeta, SessionService } from '../auth/services/session.service';

const CHALLENGE_AUDIENCE = 'trustlon:staff-challenge';
const CHALLENGE_TTL_SECONDS = 600;
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 10);
const INVALID = 'Incorrect email or password';

export type LoginStep = 'password' | 'enroll' | 'verify';

interface Challenge {
  sub: string;
  step: LoginStep;
}

export function toStaffUser(user: User) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    panels: ROLE_PANELS[user.role],
  };
}

/**
 * Admin panel sign-in (spec 5, 5.10): password, then a code from an authenticator app.
 * First sign-in: change the temporary password (if set), then set up the app.
 */
@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly sessions: SessionService,
    private readonly encryption: Encryption,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.passwordHash || !ok || user.deletedAt)
      throw new UnauthorizedException(INVALID);
    if (user.status !== UserStatus.ACTIVE)
      throw new ForbiddenException('This account is blocked. Ask a Super Admin.');
    if (!(await this.canUseAdmin(user.role))) {
      throw new ForbiddenException('This account does not have access to the admin panel');
    }
    await this.audit.log(
      { id: user.id, role: user.role, ip: meta.ip },
      {
        action: 'auth.password_ok',
        entity: 'staff',
        entityId: user.id,
        summary: user.email,
      },
    );
    return this.challenge(user);
  }

  /** First sign-in with a temporary password: choose a new one. */
  async setPassword(token: string, newPassword: string) {
    const user = await this.readChallenge(token, 'password');
    if (await bcrypt.compare(newPassword, user.passwordHash ?? DUMMY_HASH)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Choose a password different from the temporary one',
        field: 'newPassword',
      });
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      },
    });
    await this.sessions.revokeAllForUser(user.id, 'password_changed');
    return this.challenge(updated);
  }

  /** Creates (or replaces) the authenticator secret during set-up. */
  async setup(token: string) {
    const user = await this.readChallenge(token, 'enroll');
    const secret = newTotpSecret();
    await this.prisma.staffMfa.upsert({
      where: { userId: user.id },
      create: { userId: user.id, secret: this.encryption.encrypt(secret) },
      update: {
        secret: this.encryption.encrypt(secret),
        confirmedAt: null,
        lastUsedStep: 0,
        recoveryCodes: [],
      },
    });
    return { secret, otpauthUri: otpauthUri(secret, user.email) };
  }

  /** Confirms the app with a first code, issues recovery codes and signs in. */
  async enroll(token: string, code: string, meta: RequestMeta) {
    const user = await this.readChallenge(token, 'enroll');
    const mfa = await this.prisma.staffMfa.findUnique({ where: { userId: user.id } });
    if (!mfa || mfa.confirmedAt) throw new BadRequestException('Start the set-up again');
    const step = verifyTotp(this.encryption.decrypt(mfa.secret), code, 0);
    if (step === null)
      throw new BadRequestException({
        statusCode: 400,
        message: 'That code is not right. Check the time on your phone and try the newest code.',
        field: 'code',
      });
    const codes = newRecoveryCodes();
    await this.prisma.staffMfa.update({
      where: { userId: user.id },
      data: {
        confirmedAt: new Date(),
        lastUsedStep: step,
        recoveryCodes: codes.map((c) => sha256Hex(c)),
      },
    });
    await this.audit.log(
      { id: user.id, role: user.role, ip: meta.ip },
      { action: 'auth.2fa_enrolled', entity: 'staff', entityId: user.id, summary: user.email },
    );
    return { ...(await this.signIn(user, meta)), recoveryCodes: codes };
  }

  /** Checks the authenticator code (or a one-time recovery code) and signs in. */
  async verify(
    token: string,
    code: string | undefined,
    recoveryCode: string | undefined,
    meta: RequestMeta,
  ) {
    const user = await this.readChallenge(token, 'verify');
    const mfa = await this.prisma.staffMfa.findUnique({ where: { userId: user.id } });
    if (!mfa?.confirmedAt) throw new BadRequestException('Set up your authenticator app first');
    if (code) {
      const step = verifyTotp(this.encryption.decrypt(mfa.secret), code, mfa.lastUsedStep);
      if (step === null) {
        await this.failed(user, meta);
        throw new BadRequestException({
          statusCode: 400,
          message: 'That code is not right or was already used',
          field: 'code',
        });
      }
      // Conditional, so the same code can't sign in twice at the same moment.
      const saved = await this.prisma.staffMfa.updateMany({
        where: { userId: user.id, lastUsedStep: { lt: step } },
        data: { lastUsedStep: step },
      });
      if (saved.count === 0)
        throw new BadRequestException({
          statusCode: 400,
          message: 'That code was already used',
          field: 'code',
        });
    } else if (recoveryCode) {
      const hash = sha256Hex(normaliseRecoveryCode(recoveryCode));
      if (!mfa.recoveryCodes.includes(hash)) {
        await this.failed(user, meta);
        throw new BadRequestException({
          statusCode: 400,
          message: 'That recovery code is not valid',
          field: 'recoveryCode',
        });
      }
      await this.prisma.staffMfa.update({
        where: { userId: user.id },
        data: { recoveryCodes: mfa.recoveryCodes.filter((h) => h !== hash) },
      });
      await this.audit.log(
        { id: user.id, role: user.role, ip: meta.ip },
        {
          action: 'auth.recovery_code_used',
          entity: 'staff',
          entityId: user.id,
          summary: `${mfa.recoveryCodes.length - 1} codes left`,
        },
      );
    } else {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Enter the 6-digit code',
        field: 'code',
      });
    }
    return this.signIn(user, meta);
  }

  refresh(rawToken: string | undefined) {
    return this.sessions.rotate(rawToken, 'admin');
  }

  logout(rawToken: string | undefined) {
    return this.sessions.revokeByToken(rawToken);
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const mfa = await this.prisma.staffMfa.findUnique({ where: { userId } });
    return {
      user: toStaffUser(user),
      permissions: await this.permissions.forRole(user.role),
      twoFactor: {
        enabled: Boolean(mfa?.confirmedAt),
        recoveryCodesLeft: mfa?.recoveryCodes.length ?? 0,
      },
    };
  }

  async changePassword(userId: string, sessionId: string, current: string, next: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await bcrypt.compare(current, user.passwordHash))) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Your current password is not right',
        field: 'currentPassword',
      });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(next, BCRYPT_ROUNDS),
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      },
    });
    // Sign out everywhere else.
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, id: { not: sessionId } },
      data: { revokedAt: new Date(), revokedReason: 'password_changed' },
    });
    await this.audit.log(
      { id: userId, role: user.role },
      { action: 'auth.password_changed', entity: 'staff', entityId: userId },
    );
  }

  async newRecoveryCodes(userId: string, code: string) {
    const mfa = await this.prisma.staffMfa.findUnique({ where: { userId } });
    if (!mfa?.confirmedAt) throw new BadRequestException('Two-factor authentication is not set up');
    const step = verifyTotp(this.encryption.decrypt(mfa.secret), code, mfa.lastUsedStep);
    if (step === null)
      throw new BadRequestException({
        statusCode: 400,
        message: 'That code is not right',
        field: 'code',
      });
    const codes = newRecoveryCodes();
    await this.prisma.staffMfa.update({
      where: { userId },
      data: { lastUsedStep: step, recoveryCodes: codes.map((c) => sha256Hex(c)) },
    });
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { role: true },
    });
    await this.audit.log(
      { id: userId, role: user.role },
      { action: 'auth.recovery_codes_reset', entity: 'staff', entityId: userId },
    );
    return { recoveryCodes: codes };
  }

  private async canUseAdmin(role: UserRole): Promise<boolean> {
    if (!STAFF_ROLES.includes(role)) return false;
    return (await this.permissions.forRole(role)).length > 0;
  }

  private async challenge(user: User) {
    const mfa = await this.prisma.staffMfa.findUnique({
      where: { userId: user.id },
      select: { confirmedAt: true },
    });
    const step: LoginStep = user.mustChangePassword
      ? 'password'
      : mfa?.confirmedAt
        ? 'verify'
        : 'enroll';
    const challengeToken = await this.jwt.signAsync({ sub: user.id, step } satisfies Challenge, {
      audience: CHALLENGE_AUDIENCE,
      expiresIn: CHALLENGE_TTL_SECONDS,
    });
    return { step, challengeToken, email: user.email };
  }

  private async readChallenge(token: string, step: LoginStep): Promise<User> {
    let payload: Challenge;
    try {
      payload = await this.jwt.verifyAsync<Challenge>(token, { audience: CHALLENGE_AUDIENCE });
    } catch {
      throw new UnauthorizedException('Your sign-in took too long. Please start again.');
    }
    if (payload.step !== step) throw new UnauthorizedException('Please start signing in again');
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      user.deletedAt ||
      !(await this.canUseAdmin(user.role))
    ) {
      throw new UnauthorizedException('Please start signing in again');
    }
    return user;
  }

  private async signIn(user: User, meta: RequestMeta) {
    const session = await this.sessions.create(user, meta, { mfa: true });
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log(
      { id: user.id, role: user.role, ip: meta.ip },
      { action: 'auth.login', entity: 'staff', entityId: user.id, summary: user.email },
    );
    return session;
  }

  private async failed(user: User, meta: RequestMeta) {
    await this.audit.log(
      { id: user.id, role: user.role, ip: meta.ip },
      { action: 'auth.2fa_failed', entity: 'staff', entityId: user.id, summary: user.email },
    );
  }
}
