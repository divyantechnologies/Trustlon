'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth';
import { accountApi } from '@/features/account/api';
import type { Address } from '@/features/account/types';
import { checkoutApi } from '../api';
import type { CheckoutInput, CheckoutQuote } from '../types';
export function useCheckout() {
  const { status } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [input, setInput] = useState<CheckoutInput>({});
  const [quote, setQuote] = useState<CheckoutQuote>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    accountApi.addresses().then(({ items }) => {
      if (cancelled) return;
      setAddresses(items);
      const first = items.find(a => a.isDefault && a.delivery.serviceable) ?? items.find(a => a.delivery.serviceable);
      if (first) setInput(old => ({ ...old, addressId: old.addressId ?? first.id }));
    }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load addresses.'); });
    return () => { cancelled = true; };
  }, [status]);
  useEffect(() => {
    if (status !== 'authenticated') return;
    const abort = new AbortController();
    setLoading(true); setError('');
    checkoutApi.validate(input, abort.signal).then(data => { if (!abort.signal.aborted) setQuote(data); })
      .catch(e => { if (!abort.signal.aborted) { setQuote(undefined); setError(e instanceof Error ? e.message : 'Could not validate checkout.'); } })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [input, status, attempt]);
  return { status, addresses, setAddresses, input, setInput, quote, loading, error, retry: () => setAttempt(n => n + 1) };
}
