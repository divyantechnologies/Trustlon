'use client';
import { useEffect, useState } from 'react';
import type { LocalResult } from './api';
import type { Radius } from './query';

/** Mounted with a location/radius key so pages cannot mix across searches. */
export function useLocalPage<T>(
  load: (
    pincode: string,
    radius: Radius,
    page: number,
    signal: AbortSignal,
  ) => Promise<LocalResult<T>>,
  pincode: string,
  radius: Radius,
) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [serviceable, setServiceable] = useState(true);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    load(pincode, radius, page, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setItems((old) => (page === 1 ? result.items : [...old, ...result.items]));
        setTotalPages(result.totalPages);
        setServiceable(result.serviceable);
        setState('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error');
      });
    return () => controller.abort();
  }, [load, pincode, radius, page, attempt]);
  return {
    items,
    serviceable,
    state,
    hasMore: page < totalPages,
    retry: () => setAttempt((n) => n + 1),
    more: () => {
      if (state !== 'ready' || page >= totalPages) return;
      setState('loading');
      setPage((n) => n + 1);
    },
  };
}
