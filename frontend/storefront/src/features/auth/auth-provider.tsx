'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setAccessToken, setRefreshHandler } from '@/lib/http';
import { authApi, type PublicUser, type SessionResponse } from './api';

type AuthStatus = 'loading' | 'authenticated' | 'guest';

interface AuthContextValue {
  status: AuthStatus;
  user: PublicUser | null;
  /** Call with the response of signup, login or OTP login. */
  startSession: (session: SessionResponse) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Key the cart feature uses for the guest cart; sent on login so the API can merge carts. */
export const GUEST_CART_STORAGE_KEY = 'tl_guest_cart';

export function readGuestCartToken(): string | undefined {
  try {
    return window.localStorage.getItem(GUEST_CART_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<PublicUser | null>(null);

  const startSession = useCallback((session: SessionResponse) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const endSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('guest');
  }, []);

  useEffect(() => {
    setRefreshHandler(async () => {
      try {
        const session = await authApi.refresh();
        startSession(session);
        return session.accessToken;
      } catch {
        endSession();
        return null;
      }
    });

    let cancelled = false;
    authApi
      .refresh()
      .then((session) => {
        if (!cancelled) startSession(session);
      })
      .catch(() => {
        if (!cancelled) endSession();
      });
    return () => {
      cancelled = true;
    };
  }, [startSession, endSession]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      endSession();
    }
  }, [endSession]);

  const value = useMemo(
    () => ({ status, user, startSession, logout }),
    [status, user, startSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
