'use client';

import type { CartChanges, CartItemView } from '../types';
import { QuantityStepper } from '../../product/components/QuantityStepper';
import { ProductImage, secondary } from '../../product/components/primitives';
import { money } from '../../product/helpers';

export function CartItemRow({
  item,
  busy,
  onChange,
  onRemove,
}: {
  item: CartItemView;
  busy: boolean;
  onChange: (id: string, changes: CartChanges) => void;
  onRemove: (id: string) => void;
}) {
  const isOutOfStock = item.stockStatus === 'out' || !item.available || item.maxQuantity === 0;

  return (
    <article className="flex gap-4 py-5" aria-labelledby={`cart-item-${item.id}-title`}>
      <a href={`/p/${encodeURIComponent(item.slug || item.productId)}`} className="shrink-0">
        <ProductImage
          src={item.image}
          alt={item.title}
          className="h-20 w-20 rounded-xl object-contain sm:h-24 sm:w-24"
        />
      </a>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <a
            id={`cart-item-${item.id}-title`}
            href={`/p/${encodeURIComponent(item.slug || item.productId)}`}
            className="font-semibold text-[#12203F] hover:text-teal-700"
          >
            {item.title}
          </a>
          <p className="font-semibold text-[#12203F]">
            {money(item.price / 100)}{' '}
            {item.mrp > item.price && (
              <del className="ml-2 text-sm font-normal text-slate-400">
                {money(item.mrp / 100)}
              </del>
            )}
          </p>
        </div>

        {item.variantLabel && (
          <p className="text-sm text-slate-500">{item.variantLabel}</p>
        )}

        {/* Notices for Price updated / Out of stock */}
        <div className="flex flex-wrap items-center gap-2">
          {isOutOfStock ? (
            <span
              role="status"
              className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700"
            >
              Out of stock
            </span>
          ) : (
            (item.priceChanged || item.priceUpdated) && (
              <span
                role="status"
                className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700"
              >
                Price updated
              </span>
            )
          )}
          {item.notice &&
            item.notice !== 'Out of stock' &&
            item.notice !== 'Price updated' && (
              <span
                role="status"
                className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800"
              >
                {item.notice}
              </span>
            )}
        </div>

        <fieldset
          disabled={busy}
          className="flex flex-wrap items-center gap-3 pt-2 disabled:opacity-50"
        >
          <legend className="sr-only">Actions for {item.title}</legend>
          {item.maxQuantity > 0 && !isOutOfStock ? (
            <QuantityStepper
              value={item.quantity}
              min={1}
              max={item.maxQuantity}
              onChange={(quantity) => onChange(item.id, { quantity })}
            />
          ) : null}
          <button
            type="button"
            className={secondary}
            onClick={() => onRemove(item.id)}
            aria-label={`Remove ${item.title} from cart`}
          >
            Remove
          </button>
          <button
            type="button"
            className={secondary}
            onClick={() => onChange(item.id, { savedForLater: true })}
            aria-label={`Save ${item.title} for later`}
          >
            Save for later
          </button>
          <button
            type="button"
            className={secondary}
            onClick={() => onChange(item.id, { moveToWishlist: true })}
            aria-label={`Move ${item.title} to wishlist`}
          >
            Move to wishlist
          </button>
        </fieldset>
      </div>
    </article>
  );
}
