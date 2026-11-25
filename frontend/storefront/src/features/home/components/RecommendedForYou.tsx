'use client';

import { useEffect, useState } from 'react';
import { Alert, Button } from '@/design-system';
import { useAuth } from '@/features/auth';
import { homeApi } from '../api';
import { useHome } from '../home-provider';
import type { Product } from '../types';
import { ScrollSection } from './ScrollSection';
import { ProductCard } from './ProductCard';

type LoadState = 'loading' | 'ready' | 'error';

export function RecommendedForYou() {
  const { recent } = useHome();
  const { status } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [retry, setRetry] = useState(0);
  // Refresh when the latest viewed product or the signed-in state changes.
  const latest = recent[0]?.id ?? '';

  useEffect(() => {
    if (status === 'loading') {
      setLoadState('loading');
      return;
    }

    const controller = new AbortController();
    setLoadState('loading');
    homeApi
      .recommendations(10, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        const safeItems = Array.isArray(response?.items) ? response.items : [];
        setItems(safeItems);
        setLoadState('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadState('error');
      });

    return () => controller.abort();
  }, [latest, status, retry]);

  const safeItems = Array.isArray(items) ? items : [];
  if (loadState === 'loading' && safeItems.length === 0) {
    return (
      <section aria-label="Loading recommendations" aria-busy="true" className="space-y-4">
        <div className="h-7 w-56 animate-pulse rounded bg-slate-100" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-56 animate-pulse rounded-lg bg-slate-100" />)}
        </div>
      </section>
    );
  }

  if (loadState === 'error' && safeItems.length === 0) {
    return (
      <section aria-label="Recommendations" className="max-w-xl">
        <Alert>
          Recommendations couldn’t be loaded.{' '}
          <Button variant="link" onClick={() => setRetry((value) => value + 1)}>Try again</Button>
        </Alert>
      </section>
    );
  }

  if (loadState === 'ready' && safeItems.length === 0) return null;

  return (
    <ScrollSection
      title="Picked with you in mind"
      subtitle="A few more things you might love, inspired by your recent finds."
      href="/browse/recommended"
    >
      {safeItems.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ScrollSection>
  );
}
