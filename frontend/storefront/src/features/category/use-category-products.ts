'use client';
import { useEffect, useState } from 'react';
import type { Page, Product, ProductQuery } from '../home/types';
import { loadProducts, uniqueProducts } from './cache';

interface Result {
  key: string;
  pages: Array<Page<Product>>;
  status: 'loading' | 'ready' | 'error';
}

export function useCategoryProducts(query: ProductQuery, requestedPage: number) {
  const key = JSON.stringify(query);
  const [result, setResult] = useState<Result>({ key, pages: [], status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setResult((previous) => ({
      key,
      pages: previous.key === key ? previous.pages.slice(0, requestedPage) : [],
      status: 'loading',
    }));
    const collected: Array<Page<Product>> = [];
    async function load() {
      // Fetch page 1 first to discover the real total before honoring deep links.
      let lastPage = requestedPage;
      for (let page = 1; page <= lastPage; page++) {
        const data = await loadProducts(query, page);
        if (cancelled) return;
        lastPage = Math.min(requestedPage, data.totalPages);
        collected.push(data);
        setResult((previous) => ({
          key,
          pages:
            previous.key === key && previous.pages.length > collected.length
              ? [...collected, ...previous.pages.slice(collected.length, lastPage)]
              : [...collected],
          status: page >= lastPage ? 'ready' : 'loading',
        }));
      }
    }
    void load().catch(() => {
      if (!cancelled)
        setResult((previous) => ({
          key,
          pages:
            previous.key === key && previous.pages.length > collected.length
              ? previous.pages.slice(0, requestedPage)
              : collected,
          status: 'error',
        }));
    });
    return () => {
      cancelled = true;
    };
  }, [key, query, requestedPage, attempt]);

  const current = result.key === key ? result : { key, pages: [], status: 'loading' as const };
  return {
    products: uniqueProducts(current.pages),
    status: current.status,
    total: current.pages.at(-1)?.total,
    totalPages: current.pages.at(-1)?.totalPages,
    loadedPage: current.pages.length,
    retry: () => setAttempt((value) => value + 1),
  };
}
