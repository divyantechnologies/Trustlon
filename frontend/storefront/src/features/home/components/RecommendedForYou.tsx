'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth';
import { homeApi } from '../api';
import { useHome } from '../home-provider';
import type { Product } from '../types';
import { ScrollSection } from './ScrollSection';
import { ProductCard } from './ProductCard';
export function RecommendedForYou() {
  const { recent } = useHome();
  const { status } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  // Refresh when the latest viewed product or the signed-in state changes.
  const latest = recent[0]?.id ?? '';
  useEffect(() => {
    if (status === 'loading') return;
    const controller = new AbortController();
    homeApi
      .recommendations(10, controller.signal)
      .then((data) => setItems(data.items))
      .catch(() => undefined);
    return () => controller.abort();
  }, [latest, status]);
  if (items.length === 0) return null;
  return (
    <ScrollSection
      title="Picked with you in mind"
      subtitle="A few more things you might love, inspired by your recent finds."
      href="/browse/recommended"
    >
      {items.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ScrollSection>
  );
}
