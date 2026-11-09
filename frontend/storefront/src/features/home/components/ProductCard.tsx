'use client';
import { Button, cn, focusRing } from '@/design-system';
import { useI18n } from '@/lib/i18n/language-provider';
import { useHome } from '../home-provider';
import { formatPrice } from '../format';
import type { Product } from '../types';
import { Icon } from './Icon';
import { ProductImage } from './ProductImage';
export function ProductCard({ product }: { product: Product }) {
  const home = useHome();
  const { language } = useI18n();
  const saved = home.isWishlisted(product.id);
  const inCart = home.quantityInCart(product.id);
  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:border-teal/40 hover:shadow-sm">
      <div className="relative bg-navy-50">
        <button
          aria-label={`View ${product.name}`}
          onClick={() => home.viewProduct(product)}
          className={cn('block aspect-[1.15] w-full overflow-hidden', focusRing)}
        >
          <ProductImage
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition duration-300 motion-safe:group-hover:scale-105"
          />
        </button>
        {product.discountPercent > 0 && (
          <span className="absolute left-3 top-3 rounded bg-white px-2 py-1 text-[10px] font-semibold text-teal-600">
            {product.discountPercent}% OFF
          </span>
        )}
        <button
          aria-label={`${saved ? 'Remove' : 'Save'} ${product.name} ${saved ? 'from' : 'to'} wishlist`}
          aria-pressed={saved}
          onClick={() => void home.toggleWishlist(product)}
          className={cn(
            'absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 hover:text-teal-600',
            focusRing,
            saved && 'text-teal-600',
          )}
        >
          <Icon name="heart" className={cn('h-4 w-4', saved && 'fill-current')} />
        </button>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center justify-between gap-2 text-[10px]">
          <span className="truncate uppercase tracking-wider text-slate-500">
            {product.seller.isPlatformOwned ? 'TRUSTLON ORIGINAL' : product.seller.name}
          </span>
          {product.ratingCount > 0 && (
            <span
              className="flex shrink-0 items-center gap-1 text-teal-600"
              aria-label={`Rated ${product.rating} out of 5 by ${product.ratingCount} customers`}
            >
              <Icon name="star" className="h-3 w-3 fill-current" />
              {product.rating.toFixed(1)}
              <span className="text-slate-500">({product.ratingCount})</span>
            </span>
          )}
        </div>
        <button
          onClick={() => home.viewProduct(product)}
          className={cn(
            'mb-3 min-h-10 rounded text-left text-sm font-medium leading-5 hover:text-teal-600',
            focusRing,
          )}
        >
          {product.name}
        </button>
        <div className="mb-3 flex flex-wrap items-baseline gap-2">
          <span className="text-lg font-semibold">{formatPrice(product.pricePaise)}</span>
          {product.mrpPaise > product.pricePaise && (
            <del className="text-xs text-slate-500">{formatPrice(product.mrpPaise)}</del>
          )}
        </div>
        <p className="mb-4 flex items-center gap-1 text-[10px] text-slate-500">
          <Icon name="shield" className="h-3 w-3 text-teal-600" />
          {product.seller.isPlatformOwned
            ? 'Sold by Trustlon'
            : product.seller.isVerified
              ? 'Verified seller'
              : 'Escrow protected'}
        </p>
        <div className="mt-auto">
          <Button
            variant="secondary"
            disabled={!product.inStock}
            onClick={() => void home.addToCart(product)}
          >
            {product.inStock && <Icon name="plus" className="hidden h-4 w-4 sm:block" />}
            <span className="text-xs sm:text-sm">
              {!product.inStock
                ? language === 'hi'
                  ? 'स्टॉक में नहीं'
                  : 'Out of stock'
                : language === 'hi'
                  ? 'कार्ट में जोड़ें'
                  : 'Add to cart'}
              {inCart ? ` (${inCart})` : ''}
            </span>
          </Button>
        </div>
      </div>
    </article>
  );
}
