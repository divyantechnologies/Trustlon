'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth';
import { cartApi } from '../api';
import type { CartView } from '../types';
export function useCart() {
  const { status } = useAuth();
  const [cart, setCart] = useState<CartView>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (status === 'loading') return;
    const abort = new AbortController();
    setLoading(true); setCart(undefined); setError('');
    cartApi.get(abort.signal).then(data => { if (!abort.signal.aborted) setCart(data); })
      .catch(e => { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'Please try again.'); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [status, attempt]);
  const mutate = useCallback(async (request: () => Promise<CartView>) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { const data = await request(); setCart(data); return data; }
    catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); throw e; }
    finally { locked.current = false; setBusy(false); }
  }, []);
  return { cart, loading, error, busy, mutate, retry: () => setAttempt(n => n + 1) };
}
