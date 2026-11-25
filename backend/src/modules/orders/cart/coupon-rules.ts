import { Coupon, CouponAudience, CouponType, Prisma } from '@prisma/client';
import { Shopper } from '../../../utils/shopper/shopper';

export interface CouponCheck {
  valid: boolean;
  message: string;
  discountPaise: number;
}

interface CouponInput {
  coupon: Coupon | null;
  shopper: Shopper;
  /** Cart lines being bought (not saved for later). */
  lines: Array<{ categoryId: string | null; totalPaise: number }>;
  subtotalPaise: number;
  deliveryFeePaise: number;
  now: Date;
  db: Prisma.TransactionClient;
}

const rupees = (paise: number) => `₹${paise / 100}`;
const invalid = (message: string): CouponCheck => ({ valid: false, message, discountPaise: 0 });

/**
 * Applies an Admin › Marketing › Coupons coupon to a cart (5.7): dates, usage limits, audience,
 * minimum order and categories. Trustlon funds the discount; the vendor's invoice is unchanged.
 */
export async function checkCoupon({
  coupon,
  shopper,
  lines,
  subtotalPaise,
  deliveryFeePaise,
  now,
  db,
}: CouponInput): Promise<CouponCheck> {
  if (!coupon) return invalid('Invalid coupon code.');
  if (!coupon.isActive || coupon.startsAt > now || coupon.endsAt <= now)
    return invalid('This coupon is expired.');
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
    return invalid('This coupon has been fully used.');
  if (subtotalPaise === 0) return invalid('Cart is empty.');

  const eligiblePaise = coupon.categoryIds.length
    ? lines
        .filter((l) => l.categoryId && coupon.categoryIds.includes(l.categoryId))
        .reduce((sum, l) => sum + l.totalPaise, 0)
    : subtotalPaise;
  if (eligiblePaise === 0) return invalid('This coupon doesn’t apply to the items in your cart.');
  if (eligiblePaise < coupon.minOrderPaise)
    return invalid(`Minimum order value of ${rupees(coupon.minOrderPaise)} required.`);

  if (coupon.audience !== CouponAudience.ALL || coupon.perUserLimit > 0) {
    if (shopper.kind !== 'user') {
      if (coupon.audience !== CouponAudience.ALL) return invalid('Sign in to use this coupon.');
    } else {
      const placed = { userId: shopper.userId, paymentStatus: { not: 'FAILED' as const } };
      if (
        coupon.audience === CouponAudience.NEW_USERS &&
        (await db.order.count({ where: placed })) > 0
      ) {
        return invalid('This coupon is for your first order only.');
      }
      if (coupon.audience === CouponAudience.PRIME_MEMBERS) {
        const prime = await db.primeMembership.findUnique({ where: { userId: shopper.userId } });
        if (!prime || prime.endsAt <= now)
          return invalid('This coupon is for Trustlon Prime members.');
      }
      if (
        (await db.order.count({ where: { ...placed, couponCode: coupon.code } })) >=
        coupon.perUserLimit
      ) {
        return invalid('You’ve already used this coupon.');
      }
    }
  }

  let discountPaise = 0;
  if (coupon.type === CouponType.PERCENT) {
    discountPaise = Math.floor((eligiblePaise * coupon.value) / 10000);
    if (coupon.maxDiscountPaise !== null)
      discountPaise = Math.min(discountPaise, coupon.maxDiscountPaise);
  } else if (coupon.type === CouponType.FLAT) {
    discountPaise = Math.min(coupon.value, eligiblePaise);
  } else {
    if (deliveryFeePaise === 0) return invalid('Delivery is already free on this order.');
    discountPaise = deliveryFeePaise;
  }
  return {
    valid: true,
    message: 'Coupon applied successfully.',
    discountPaise: Math.max(0, Math.min(discountPaise, subtotalPaise + deliveryFeePaise)),
  };
}
