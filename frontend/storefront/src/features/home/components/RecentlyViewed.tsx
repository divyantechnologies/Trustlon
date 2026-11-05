import { useHome } from '../home-provider';
import { findProduct } from '../data/products';
import { ScrollSection } from './ScrollSection';
import { ProductCard } from './ProductCard';
export function RecentlyViewed() {
  const { recent } = useHome();
  return (
    <ScrollSection
      title="Worth another look"
      subtitle="Your recently viewed finds, right where you left them. Seeded with sample picks."
      wide
    >
      {recent.map((id) => {
        const product = findProduct(id);
        return product ? <ProductCard key={id} product={product} /> : null;
      })}
    </ScrollSection>
  );
}
