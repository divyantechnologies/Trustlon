'use client';
import { useEffect, useState } from 'react';
import { homeApi } from '../home/api';
import type { Page, Product, ProductQuery } from '../home/types';

type Result = { key: string; status: 'loading' | 'ready' | 'error'; data?: Page<Product> };

export function useSearchResults(query: ProductQuery) {
  const key = JSON.stringify(query);
  const [result, setResult] = useState<Result>({ key, status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult({ key, status: 'loading' });
    void homeApi
      .search(JSON.parse(key) as ProductQuery, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, status: 'ready', data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, status: 'error' });
      });
    return () => controller.abort();
  }, [key, attempt]);
  return {
    ...(result.key === key ? result : { key, status: 'loading' as const }),
    retry: () => setAttempt((value) => value + 1),
  };
}
