import { User } from '@prisma/client';

export interface PublicUser {
  id: string;
  fullName: string;
  mobile: string;
  email: string;
  country: string | null;
  role: User['role'];
  preferredLanguage: User['preferredLanguage'];
  referralCode: string;
  hasPassword: boolean;
  mobileVerified: boolean;
  emailVerified: boolean;
  createdAt: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    mobile: user.mobile,
    email: user.email,
    country: user.country,
    role: user.role,
    preferredLanguage: user.preferredLanguage,
    referralCode: user.referralCode,
    hasPassword: Boolean(user.passwordHash),
    mobileVerified: Boolean(user.mobileVerifiedAt),
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt,
  };
}
