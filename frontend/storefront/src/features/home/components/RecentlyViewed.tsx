'use client';
import { useHome } from '../home-provider';
import { ScrollSection } from './ScrollSection';
import { ProductCard } from './ProductCard';
export function RecentlyViewed() {
  const { recent } = useHome();
  if (recent.length === 0) return null;
  return (
    <ScrollSection
      title="Worth another look"
      subtitle="Your recently viewed finds, right where you left them."
      wide
    >
      {recent.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ScrollSection>
  );
}
