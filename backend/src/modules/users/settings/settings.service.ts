import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  OtpChannel,
  OtpPurpose,
  Prisma,
  RefundStatus,
  ReturnStatus,
  SubOrderStatus,
  User,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  MOBILE_RULE_MESSAGE,
  normalizeEmail,
  normalizeMobile,
  phoneRegion,
} from '../../../utils/identifier';
import { PrismaService } from '../../../database/prisma.service';
import { BCRYPT_ROUNDS, MESSAGES } from '../../auth/auth.constants';
import { SiteSettingsService } from '../../site/site-settings.service';
import { OtpService } from '../../auth/services/otp.service';
import { RequestMeta } from '../../auth/services/session.service';
import {
  ChangePasswordDto,
  ContactOtpDto,
  ContactVerifyDto,
  DeleteAccountDto,
  UpdateProfileDto,
} from './dto';
import {
  defaultChoices,
  LOCKED_EVENTS,
  mergeChoices,
  NotificationChoices,
  wantsMarketing,
} from './notification-preferences';
import { describeUserAgent } from './user-agent';

/** Emitted after a customer deletes their account; search, CRM and analytics drop the user. */
export const ACCOUNT_DELETED = 'account.deleted';

/** Default years orders, invoices and payments are kept after deletion; live value in /admin. */
export const RECORD_RETENTION_YEARS = 8;

const MIN_AGE = 13;
const MAX_AGE = 120;

const OPEN_SUB_ORDER: SubOrderStatus[] = [
  SubOrderStatus.PLACED,
  SubOrderStatus.CONFIRMED,
  SubOrderStatus.PACKED,
  SubOrderStatus.SHIPPED,
  SubOrderStatus.OUT_FOR_DELIVERY,
  SubOrderStatus.RETURN_REQUESTED,
];
const OPEN_RETURN: ReturnStatus[] = [
  ReturnStatus.REQUESTED,
  ReturnStatus.APPROVED,
  ReturnStatus.PICKED_UP,
  ReturnStatus.RECEIVED,
];

export interface SettingsProfile {
  fullName: string;
  email: string;
  mobile: string;
  emailVerified: boolean;
  mobileVerified: boolean;
  dateOfBirth: string | null;
  gender: User['gender'];
  preferredLanguage: User['preferredLanguage'];
  hasPassword: boolean;
  passwordChangedAt: Date | null;
  memberSince: Date;
}

export interface DeletionCheck {
  blockers: string[];
  walletBalancePaise: number;
  coins: number;
  retentionYears: number;
}

const fieldError = (message: string, field: string) =>
  new BadRequestException({ statusCode: 400, message, field });

function toProfile(user: User): SettingsProfile {
  return {
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    emailVerified: Boolean(user.emailVerifiedAt),
    mobileVerified: Boolean(user.mobileVerifiedAt),
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : null,
    gender: user.gender,
    preferredLanguage: user.preferredLanguage,
    hasPassword: Boolean(user.passwordHash),
    passwordChangedAt: user.passwordChangedAt,
    memberSince: user.createdAt,
  };
}

/** Parses YYYY-MM-DD as a calendar date and checks the age range. */
function parseDateOfBirth(value: string, today = new Date()): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw fieldError('Enter a valid date of birth', 'dateOfBirth');
  }
  let age = today.getUTCFullYear() - date.getUTCFullYear();
  const birthdayPassed =
    today.getUTCMonth() > date.getUTCMonth() ||
    (today.getUTCMonth() === date.getUTCMonth() && today.getUTCDate() >= date.getUTCDate());
  if (!birthdayPassed) age--;
  if (age < MIN_AGE) throw fieldError(`You must be at least ${MIN_AGE} years old`, 'dateOfBirth');
  if (age > MAX_AGE) throw fieldError('Enter a valid date of birth', 'dateOfBirth');
  return date;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly events: EventEmitter2,
    private readonly site: SiteSettingsService,
  ) {}

  /** Everything the settings page shows, in one call. */
  async overview(userId: string) {
    const user = await this.user(userId);
    const [notifications, deletion] = await Promise.all([
      this.notificationChoices(user),
      this.deletionCheck(user),
    ]);
    return {
      profile: toProfile(user),
      notifications: { channels: notifications, locked: LOCKED_EVENTS },
      deletion,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<SettingsProfile> {
    await this.user(userId);
    const data: Prisma.UserUpdateInput = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.preferredLanguage !== undefined) data.preferredLanguage = dto.preferredLanguage;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.dateOfBirth !== undefined) {
      data.dateOfBirth = dto.dateOfBirth === null ? null : parseDateOfBirth(dto.dateOfBirth);
    }
    const user = await this.prisma.user.update({ where: { id: userId }, data });
    return toProfile(user);
  }

  /** Step 1 of changing the email or mobile: send a code to the new address. */
  async sendContactCode(userId: string, dto: ContactOtpDto, meta: RequestMeta) {
    const user = await this.user(userId);
    const value = this.normaliseContact(dto.type, dto.value);
    if (value === (dto.type === 'email' ? user.email : user.mobile)) {
      throw fieldError(
        dto.type === 'email'
          ? 'This is already your email address'
          : 'This is already your mobile number',
        'value',
      );
    }
    await this.assertPassword(user, dto.currentPassword);
    await this.assertAvailable(dto.type, value, userId);
    const result = await this.otp.issue({
      channel: dto.type === 'email' ? OtpChannel.EMAIL : OtpChannel.SMS,
      target: value,
      purpose: OtpPurpose.CHANGE_CONTACT,
      ip: meta.ip,
    });
    return { message: MESSAGES.OTP_SENT, target: value, ...result };
  }

  /** Step 2: check the code and save the new, verified address. */
  async verifyContact(userId: string, dto: ContactVerifyDto): Promise<SettingsProfile> {
    await this.user(userId);
    const value = this.normaliseContact(dto.type, dto.value);
    await this.otp.verify({ target: value, purpose: OtpPurpose.CHANGE_CONTACT, code: dto.code });
    await this.assertAvailable(dto.type, value, userId);
    const now = new Date();
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data:
          dto.type === 'email'
            ? { email: value, emailVerifiedAt: now }
            : { mobile: value, mobileVerifiedAt: now, country: phoneRegion(value) },
      });
      return toProfile(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw this.takenError(dto.type);
      }
      throw error;
    }
  }

  /** Changes the password and signs out every other device. */
  async changePassword(user: { id: string; sessionId: string }, dto: ChangePasswordDto) {
    const row = await this.user(user.id);
    await this.assertPassword(row, dto.currentPassword);
    if (row.passwordHash && (await bcrypt.compare(dto.newPassword, row.passwordHash))) {
      throw fieldError('Choose a password you have not used for this account', 'newPassword');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS),
        passwordChangedAt: new Date(),
      },
    });
    const signedOut = await this.revokeOthers(user.id, user.sessionId, 'password_changed');
    return { message: 'Password updated', signedOutSessions: signedOut };
  }

  async sessions(userId: string, currentSessionId: string) {
    const rows = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, userAgent: true, ip: true, createdAt: true, lastUsedAt: true },
    });
    const items = rows.map((row) => ({
      id: row.id,
      ...describeUserAgent(row.userAgent),
      ip: row.ip,
      signedInAt: row.createdAt,
      lastActiveAt: row.lastUsedAt,
      current: row.id === currentSessionId,
    }));
    return { items: [...items.filter((s) => s.current), ...items.filter((s) => !s.current)] };
  }

  async revokeSession(userId: string, currentSessionId: string, sessionId: string) {
    if (sessionId === currentSessionId) {
      throw new BadRequestException('To end this session, use Sign out');
    }
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'revoked_by_user' },
    });
    if (result.count === 0) throw new NotFoundException('Session not found');
  }

  async revokeOtherSessions(userId: string, currentSessionId: string) {
    return { revoked: await this.revokeOthers(userId, currentSessionId, 'revoked_by_user') };
  }

  async updateNotifications(userId: string, channels: Record<string, Record<string, boolean>>) {
    const user = await this.user(userId);
    const current = await this.notificationChoices(user);
    const merged = mergeChoices(current, channels);
    const marketingOptIn = wantsMarketing(merged);
    await this.prisma.$transaction([
      this.prisma.notificationPreference.upsert({
        where: { userId },
        create: { userId, channels: merged as Prisma.InputJsonObject },
        update: { channels: merged as Prisma.InputJsonObject },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { marketingOptIn } }),
    ]);
    return { channels: merged, locked: LOCKED_EVENTS };
  }

  /** A copy of the customer's personal data (DPDP right to access), as one JSON document. */
  async exportData(userId: string) {
    const user = await this.user(userId);
    const [
      notifications,
      addresses,
      orders,
      returns,
      reviews,
      wallet,
      walletEntries,
      wishlist,
      priceAlerts,
      business,
      tickets,
      affiliateLinks,
      affiliateEarnings,
      sessions,
    ] = await Promise.all([
      this.notificationChoices(user),
      this.prisma.address.findMany({ where: { userId } }),
      this.prisma.order.findMany({
        where: { userId },
        orderBy: { placedAt: 'desc' },
        include: { subOrders: { include: { items: true } } },
      }),
      this.prisma.returnRequest.findMany({ where: { userId }, include: { items: true } }),
      this.prisma.review.findMany({ where: { userId } }),
      this.prisma.wallet.findUnique({ where: { userId } }),
      this.prisma.walletEntry.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.wishlistItem.findMany({
        where: { userId },
        select: { createdAt: true, product: { select: { name: true, slug: true } } },
      }),
      this.prisma.priceAlert.findMany({ where: { userId } }),
      this.prisma.businessProfile.findUnique({ where: { userId } }),
      this.prisma.supportTicket.findMany({
        where: { userId },
        include: {
          messages: { select: { authorType: true, authorName: true, body: true, createdAt: true } },
        },
      }),
      this.prisma.affiliateLink.findMany({ where: { userId } }),
      this.prisma.affiliateEarning.findMany({ where: { userId } }),
      this.sessions(userId, ''),
    ]);
    const profile = toProfile(user);
    return {
      exportedAt: new Date(),
      notice:
        'This file contains the personal data Trustlon holds about you. Keep it somewhere safe.',
      profile: {
        ...profile,
        country: user.country,
        referralCode: user.referralCode,
        marketingOptIn: user.marketingOptIn,
        termsAcceptedAt: user.termsAcceptedAt,
        lastLoginAt: user.lastLoginAt,
      },
      notificationPreferences: notifications,
      addresses,
      orders,
      returns,
      reviews,
      wallet: { balance: wallet, entries: walletEntries },
      wishlist,
      priceAlerts,
      businessProfile: business,
      supportTickets: tickets,
      affiliate: { links: affiliateLinks, earnings: affiliateEarnings },
      activeSessions: sessions.items.map(({ id, browser, os, ip, signedInAt, lastActiveAt }) => ({
        id,
        browser,
        os,
        ip,
        signedInAt,
        lastActiveAt,
      })),
    };
  }

  /**
   * Deletes the account (DPDP right to erasure). Personal details are anonymised and saved
   * addresses, wishlist, cart, alerts and sessions are removed. Orders, invoices and payments
   * stay for the legal retention period, linked only to the anonymised account.
   */
  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.user(userId);
    await this.assertPassword(user, dto.currentPassword);
    const check = await this.deletionCheck(user);
    if (check.blockers.length > 0) {
      throw new ConflictException({
        statusCode: 409,
        message: check.blockers[0],
        blockers: check.blockers,
      });
    }

    const now = new Date();
    const retainUntil = new Date(now);
    retainUntil.setUTCFullYear(
      retainUntil.getUTCFullYear() + (await this.site.get('business-rules')).recordRetentionYears,
    );
    const compactId = userId.replace(/-/g, '');

    await this.prisma.$transaction([
      this.prisma.address.deleteMany({ where: { userId } }),
      this.prisma.wishlistItem.deleteMany({ where: { userId } }),
      this.prisma.recentlyViewed.deleteMany({ where: { userId } }),
      this.prisma.priceAlert.deleteMany({ where: { userId } }),
      this.prisma.cart.deleteMany({ where: { userId } }),
      this.prisma.notificationPreference.deleteMany({ where: { userId } }),
      this.prisma.affiliateLink.deleteMany({ where: { userId } }),
      this.prisma.otpChallenge.deleteMany({ where: { target: { in: [user.email, user.mobile] } } }),
      this.prisma.session.deleteMany({ where: { userId } }),
      this.prisma.accountDeletion.create({
        data: { userId, reason: dto.reason || null, retainUntil },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          fullName: 'Deleted user',
          email: `deleted-${compactId}@deleted.invalid`,
          mobile: `del${compactId.slice(0, 13)}`,
          country: null,
          passwordHash: null,
          dateOfBirth: null,
          gender: null,
          marketingOptIn: false,
          emailVerifiedAt: null,
          mobileVerifiedAt: null,
          deletedAt: now,
        },
      }),
    ]);
    this.events.emit(ACCOUNT_DELETED, { userId });
    return { message: 'Your account has been deleted', retainUntil };
  }

  private async deletionCheck(user: User): Promise<DeletionCheck> {
    const [openOrders, openReturns, pendingRefunds, wallet] = await Promise.all([
      this.prisma.subOrder.count({
        where: { order: { userId: user.id }, status: { in: OPEN_SUB_ORDER } },
      }),
      this.prisma.returnRequest.count({ where: { userId: user.id, status: { in: OPEN_RETURN } } }),
      this.prisma.subOrder.count({
        where: { order: { userId: user.id }, refundStatus: RefundStatus.PENDING },
      }),
      this.prisma.wallet.findUnique({ where: { userId: user.id } }),
    ]);
    const blockers: string[] = [];
    if (user.role !== UserRole.CUSTOMER) {
      blockers.push('Seller and team accounts are closed by Trustlon support, not from here.');
    }
    if (openOrders > 0) {
      blockers.push(
        `You have ${openOrders} order${openOrders > 1 ? 's' : ''} on the way. Wait for delivery or cancel first.`,
      );
    }
    if (openReturns > 0) {
      blockers.push(
        `You have ${openReturns} return${openReturns > 1 ? 's' : ''} in progress. Wait until the refund is done.`,
      );
    }
    if (pendingRefunds > 0) {
      blockers.push('A refund is still being processed. Try again once it reaches you.');
    }
    return {
      blockers,
      walletBalancePaise: wallet?.balancePaise ?? 0,
      coins: wallet?.coins ?? 0,
      retentionYears: (await this.site.get('business-rules')).recordRetentionYears,
    };
  }

  private async notificationChoices(user: User): Promise<NotificationChoices> {
    const saved = await this.prisma.notificationPreference.findUnique({
      where: { userId: user.id },
    });
    return mergeChoices(defaultChoices(user.marketingOptIn), saved?.channels);
  }

  private async revokeOthers(userId: string, currentSessionId: string, reason: string) {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, id: { not: currentSessionId } },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.count;
  }

  private async user(userId: string): Promise<User> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('Account not found');
    return user;
  }

  private async assertPassword(user: User, password: string | undefined) {
    if (!user.passwordHash) return;
    if (!password) throw fieldError('Enter your current password', 'currentPassword');
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw fieldError('Current password is incorrect', 'currentPassword');
    }
  }

  private normaliseContact(type: 'email' | 'mobile', raw: string): string {
    const value = type === 'email' ? normalizeEmail(raw) : normalizeMobile(raw);
    if (!value) {
      throw fieldError(
        type === 'email' ? 'Enter a valid email address' : MOBILE_RULE_MESSAGE,
        'value',
      );
    }
    return value;
  }

  private async assertAvailable(type: 'email' | 'mobile', value: string, userId: string) {
    const existing = await this.prisma.user.findFirst({
      where: type === 'email' ? { email: value } : { mobile: value },
      select: { id: true },
    });
    if (existing && existing.id !== userId) throw this.takenError(type);
  }

  private takenError(type: 'email' | 'mobile') {
    return new ConflictException({
      statusCode: 409,
      message: type === 'email' ? MESSAGES.EMAIL_TAKEN : MESSAGES.MOBILE_TAKEN,
      field: 'value',
    });
  }
}
