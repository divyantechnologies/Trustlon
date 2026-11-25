'use client';
import Link from 'next/link';
import { Button, cn, focusRing } from '@/design-system';
import { EmptyState, Panel } from '@/features/account/components/ui';
import { ProductImage } from '@/features/home/components/ProductImage';
import { SectionError, SectionSkeleton } from '@/features/home/components/SectionStates';
import { formatPrice } from '@/features/home/format';
import { localApi } from '../api';
import { largerRadius, type Radius } from '../query';
import { useLocalPage } from '../use-local-page';
import { DeliveryBadge } from './DeliveryBadge';

export function LocalSellerList({
  pincode,
  radius,
  onRadiusChange,
}: {
  pincode: string;
  radius: Radius;
  onRadiusChange: (radius: Radius) => void;
}) {
  const data = useLocalPage(localApi.sellers, pincode, radius);
  const larger = largerRadius(radius);
  return (
    <section
      aria-labelledby="local-sellers-title"
      aria-busy={data.state === 'loading'}
      className="space-y-5"
    >
      <h2 id="local-sellers-title" className="text-xl font-semibold">
        Sellers in your neighbourhood
      </h2>
      {data.state === 'loading' && !data.items.length ? (
        <SectionSkeleton cards={3} title={false} gridClassName="md:grid-cols-2 xl:grid-cols-3" />
      ) : data.state !== 'error' && !data.serviceable ? (
        <EmptyState
          title="Local delivery is not available at this pincode yet."
          description="Change your pincode to find nearby sellers."
        />
      ) : data.state === 'ready' && !data.items.length ? (
        <EmptyState
          title={`No local sellers found within ${radius} km.`}
          description={
            larger ? 'Try a larger radius.' : 'Try another pincode or check again later.'
          }
          action={
            larger && (
              <Button variant="secondary" onClick={() => onRadiusChange(larger)}>
                Search within {larger} km
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((seller) => (
            <Panel key={seller.id} as="article">
              <div className="flex items-center gap-3">
                <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy-50 font-semibold">
                  {seller.initials}
                  {seller.logo && (
                    <img
                      src={seller.logo}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                </span>
                <div>
                  <h3 className="font-semibold">{seller.storeName}</h3>
                  <p className="text-sm text-slate-500">{seller.distanceKm.toFixed(1)} km away</p>
                </div>
              </div>
              <div className="my-4">
                <DeliveryBadge promise={seller.deliveryPromise} />
              </div>
              {seller.rating !== null && (
                <p className="mb-3 text-sm" aria-label={`Seller rating ${seller.rating} out of 5`}>
                  {seller.rating.toFixed(1)} / 5
                </p>
              )}
              <ul className="grid grid-cols-2 gap-3">
                {seller.topProducts.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={`/p/${encodeURIComponent(product.slug)}`}
                      className={cn('block rounded-lg', focusRing)}
                    >
                      <ProductImage
                        src={product.image}
                        alt={product.name}
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                      <p className="mt-1 line-clamp-2 text-xs">{product.name}</p>
                      <p className="text-sm font-semibold">{formatPrice(product.pricePaise)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
              {!seller.topProducts.length && (
                <p className="text-sm text-slate-500">No in-stock products right now.</p>
              )}
              <Link
                href={`/browse/${encodeURIComponent(seller.slug)}`}
                className={cn(
                  'mt-4 inline-flex min-h-11 items-center rounded-lg font-semibold text-teal-600',
                  focusRing,
                )}
                aria-label={`View ${seller.storeName} store`}
              >
                View store
              </Link>
            </Panel>
          ))}
        </div>
      )}
      {data.state === 'error' && (
        <SectionError message="We could not load local sellers." onRetry={data.retry} />
      )}
      {data.hasMore && data.state !== 'error' && (
        <div className="mx-auto max-w-xs">
          <Button variant="secondary" loading={data.state === 'loading'} onClick={data.more}>
            Show more sellers
          </Button>
        </div>
      )}
    </section>
  );
}
