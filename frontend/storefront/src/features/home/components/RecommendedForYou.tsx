import { useHome } from '../home-provider';
import { getRecommendations } from '../data/recommendations';
import { ScrollSection } from './ScrollSection';
import { ProductCard } from './ProductCard';
export function RecommendedForYou() {
  const { recent } = useHome();
  return (
    <ScrollSection
      title="Picked with you in mind"
      subtitle="A few more things you might love, inspired by your recent finds."
      href="/browse/recommended"
    >
      {getRecommendations(recent).map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ScrollSection>
  );
}
