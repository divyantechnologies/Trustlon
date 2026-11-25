'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { setAccessToken, setRefreshHandler } from '@/lib/http';
import { authApi, type Permission, type Profile, type StaffSession } from './api';

type Status = 'loading' | 'guest' | 'authenticated';

interface AuthContextValue {
  status: Status;
  profile: Profile | null;
  /** True when the signed-in role has this permission (Super Admin has all). */
  can: (permission: Permission) => boolean;
  startSession: (session: StaffSession) => Promise<void>;
  reloadProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Staff session for the admin panel: access token in memory, refresh token in an httpOnly cookie. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const started = useRef(false);

  const endSession = useCallback(() => {
    setAccessToken(null);
    setProfile(null);
    setStatus('guest');
  }, []);

  const reloadProfile = useCallback(async () => {
    const me = await authApi.me();
    setProfile(me);
    setStatus('authenticated');
  }, []);

  const startSession = useCallback(
    async (session: StaffSession) => {
      setAccessToken(session.accessToken);
      await reloadProfile();
    },
    [reloadProfile],
  );

  useEffect(() => {
    setRefreshHandler(async () => {
      try {
        const session = await authApi.refresh();
        setAccessToken(session.accessToken);
        return session.accessToken;
      } catch {
        endSession();
        return null;
      }
    });
    if (started.current) return;
    started.current = true;
    authApi
      .refresh()
      .then((session) => startSession(session))
      .catch(() => endSession());
  }, [endSession, startSession]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      endSession();
    }
  }, [endSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      profile,
      can: (permission) =>
        profile?.user.role === 'SUPER_ADMIN' || Boolean(profile?.permissions.includes(permission)),
      startSession,
      reloadProfile,
      logout,
    }),
    [status, profile, startSession, reloadProfile, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
