'use client';
import { Button } from '@/design-system';
import { EmptyState } from '@/features/account/components/ui';
import { ProductCard } from '@/features/home/components/ProductCard';
import { SectionError, SectionSkeleton } from '@/features/home/components/SectionStates';
import { localApi } from '../api';
import { largerRadius, type Radius } from '../query';
import { useLocalPage } from '../use-local-page';
import { DeliveryBadge } from './DeliveryBadge';

export function ProductGrid({
  pincode,
  radius,
  onRadiusChange,
}: {
  pincode: string;
  radius: Radius;
  onRadiusChange: (radius: Radius) => void;
}) {
  const data = useLocalPage(localApi.products, pincode, radius);
  const larger = largerRadius(radius);
  return (
    <section
      aria-labelledby="local-products-title"
      aria-busy={data.state === 'loading'}
      className="space-y-5"
    >
      <h2 id="local-products-title" className="text-xl font-semibold">
        Products delivered today
      </h2>
      {data.state === 'loading' && !data.items.length ? (
        <SectionSkeleton
          cards={4}
          title={false}
          gridClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        />
      ) : data.state === 'ready' && !data.items.length ? (
        <EmptyState
          title={
            data.serviceable
              ? 'No same-day products available right now.'
              : 'Same-day delivery is not available at this pincode yet.'
          }
          description="Try a larger radius or another pincode. Sellers may have passed their daily cutoff."
          action={
            data.serviceable &&
            larger && (
              <Button variant="secondary" onClick={() => onRadiusChange(larger)}>
                Search within {larger} km
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {data.items.map((product) => (
            <div key={product.id} className="flex flex-col gap-2">
              <div>
                <DeliveryBadge promise="same_day" compact />
              </div>
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      )}
      {data.state === 'error' && (
        <SectionError message="We could not load same-day products." onRetry={data.retry} />
      )}
      {data.hasMore && data.state !== 'error' && (
        <div className="mx-auto max-w-xs">
          <Button variant="secondary" loading={data.state === 'loading'} onClick={data.more}>
            Show more products
          </Button>
        </div>
      )}
    </section>
  );
}
