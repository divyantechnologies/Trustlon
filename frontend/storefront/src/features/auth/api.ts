import { apiFetch } from '@/lib/http';

export type OtpPurpose = 'SIGNUP' | 'LOGIN' | 'RESET_PASSWORD';

export interface PublicUser {
  id: string;
  fullName: string;
  mobile: string;
  email: string;
  country: string | null;
  role: string;
  preferredLanguage: 'EN' | 'HI';
  referralCode: string;
  hasPassword: boolean;
  mobileVerified: boolean;
  emailVerified: boolean;
  createdAt: string;
}

export interface SessionResponse {
  accessToken: string;
  expiresInSeconds: number;
  user: PublicUser;
}

export interface OtpSendResponse {
  message: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

export interface VerificationResponse {
  verificationToken: string;
  expiresInSeconds: number;
}

export interface SignupDetails {
  fullName: string;
  email: string;
  mobile: string;
  password: string;
  country?: string;
  referralCode?: string;
  preferredLanguage?: 'EN' | 'HI';
  marketingOptIn: boolean;
  acceptTerms: true;
}

export interface SignupPayload extends SignupDetails {
  emailVerificationToken: string;
  mobileVerificationToken: string;
}

export const authApi = {
  sendOtp: (identifier: string, purpose: OtpPurpose) =>
    apiFetch<OtpSendResponse>('/auth/otp/send', {
      method: 'POST',
      body: { identifier, purpose },
    }),

  verifyForToken: (identifier: string, purpose: Exclude<OtpPurpose, 'LOGIN'>, code: string) =>
    apiFetch<VerificationResponse>('/auth/otp/verify', {
      method: 'POST',
      body: { identifier, purpose, code },
    }),

  verifyLogin: (identifier: string, code: string, guestCartToken?: string) =>
    apiFetch<SessionResponse>('/auth/otp/verify', {
      method: 'POST',
      body: { identifier, purpose: 'LOGIN', code, guestCartToken },
    }),

  validateSignup: (details: SignupDetails) =>
    apiFetch<{ valid: true }>('/auth/signup/validate', { method: 'POST', body: details }),

  signup: (payload: SignupPayload) =>
    apiFetch<SessionResponse>('/auth/signup', { method: 'POST', body: payload }),

  login: (identifier: string, password: string, guestCartToken?: string) =>
    apiFetch<SessionResponse>('/auth/login', {
      method: 'POST',
      body: { identifier, password, guestCartToken },
    }),

  refresh: () => apiFetch<SessionResponse>('/auth/refresh', { method: 'POST' }),

  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),

  forgotPassword: (identifier: string) =>
    apiFetch<OtpSendResponse>('/auth/password/forgot', { method: 'POST', body: { identifier } }),

  resetPassword: (verificationToken: string, newPassword: string) =>
    apiFetch<{ message: string }>('/auth/password/reset', {
      method: 'POST',
      body: { verificationToken, newPassword },
    }),

  me: () => apiFetch<{ user: PublicUser }>('/auth/me', { auth: true }),
};
