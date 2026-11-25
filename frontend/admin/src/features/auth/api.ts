import { apiFetch } from '@/lib/http';

export type Permission = `${string}:${string}`;

export interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  role: string;
  panels: string[];
}

export interface StaffSession {
  accessToken: string;
  expiresInSeconds: number;
  user: StaffUser;
}

export type LoginStep = 'password' | 'enroll' | 'verify';

export interface Challenge {
  step: LoginStep;
  challengeToken: string;
  email: string;
}

export interface Profile {
  user: StaffUser;
  permissions: Permission[];
  twoFactor: { enabled: boolean; recoveryCodesLeft: number };
}

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<Challenge>('/admin/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password },
    }),
  setPassword: (challengeToken: string, newPassword: string) =>
    apiFetch<Challenge>('/admin/auth/password', {
      method: 'POST',
      auth: false,
      body: { challengeToken, newPassword },
    }),
  setup: (challengeToken: string) =>
    apiFetch<{ secret: string; otpauthUri: string }>('/admin/auth/2fa/setup', {
      method: 'POST',
      auth: false,
      body: { challengeToken },
    }),
  enroll: (challengeToken: string, code: string) =>
    apiFetch<StaffSession & { recoveryCodes: string[] }>('/admin/auth/2fa/enroll', {
      method: 'POST',
      auth: false,
      body: { challengeToken, code },
    }),
  verify: (challengeToken: string, value: { code?: string; recoveryCode?: string }) =>
    apiFetch<StaffSession>('/admin/auth/2fa/verify', {
      method: 'POST',
      auth: false,
      body: { challengeToken, ...value },
    }),
  refresh: () => apiFetch<StaffSession>('/admin/auth/refresh', { method: 'POST', auth: false }),
  logout: () => apiFetch<void>('/admin/auth/logout', { method: 'POST', auth: false }),
  me: () => apiFetch<Profile>('/admin/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<void>('/admin/auth/me/password', {
      method: 'PATCH',
      body: { currentPassword, newPassword },
    }),
  newRecoveryCodes: (code: string) =>
    apiFetch<{ recoveryCodes: string[] }>('/admin/auth/me/recovery-codes', {
      method: 'POST',
      body: { code },
    }),
};
