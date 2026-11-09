export const REFRESH_COOKIE_NAME = 'tl_rt';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

/** A rotated refresh token is still accepted for this long, so parallel tabs do not log each other out. */
export const REFRESH_REUSE_GRACE_SECONDS = 30;

export const BCRYPT_ROUNDS = 12;

/** 8 to 72 characters (bcrypt limit) with an uppercase letter, a lowercase letter and a number. */
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;
export const PASSWORD_RULE_MESSAGE =
  'Password must be 8 to 72 characters with an uppercase letter, a lowercase letter and a number';

export const AUTH_EVENTS = {
  USER_REGISTERED: 'auth.user-registered',
  USER_LOGGED_IN: 'auth.user-logged-in',
} as const;

export interface UserRegisteredEvent {
  userId: string;
  referredById: string | null;
}

/** Consumed by the cart module to merge a guest cart into the user cart. */
export interface UserLoggedInEvent {
  userId: string;
  guestCartToken?: string;
}

export const MESSAGES = {
  INVALID_CREDENTIALS: 'Incorrect mobile number, email or password',
  INVALID_OTP: 'Invalid or expired code',
  OTP_SENT_GENERIC: 'If an account exists for these details, a code has been sent',
  OTP_SENT: 'Verification code sent',
  INVALID_IDENTIFIER: 'Enter a valid mobile number or email address',
  MOBILE_TAKEN: 'An account with this mobile number already exists',
  EMAIL_TAKEN: 'An account with this email address already exists',
  INVALID_REFERRAL: 'Referral code is not valid',
  ACCOUNT_BLOCKED: 'This account is blocked. Please contact support.',
  VERIFICATION_EXPIRED: 'Verification has expired. Please request a new code.',
  SESSION_EXPIRED: 'Session expired. Please log in again.',
  PASSWORD_RESET: 'Password updated. Please log in with your new password.',
} as const;
