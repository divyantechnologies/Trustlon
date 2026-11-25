import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ownerWhere, Shopper } from '../../common/shopper/shopper';
import { PrismaService } from '../../prisma/prisma.service';
import { MAX_QUANTITY_PER_ITEM } from '../catalog/product.presenter';
import { COIN_RULES } from '../wallet/wallet.service';
import { CartChanges, CartGroupView, CartItemView, CartView, StockStatus } from './cart.types';
import { checkCoupon } from './coupon-rules';
export type { CartView } from './cart.types';

export const cartInclude = {
  items: {
    orderBy: { addedAt: 'asc' as const },
    include: {
      product: { include: { vendor: { include: { pickup: true } }, deals: true } },
    },
  },
} satisfies Prisma.CartInclude;

export type CartRecord = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

export const guestExpired = (cart: { expiresAt: Date }, now = new Date()) => cart.expiresAt <= now;

export function currentPrice(p: CartRecord['items'][number]['product'], now = new Date()): number {
  return Math.min(
    p.pricePaise,
    ...p.deals
      .filter((d) => d.startsAt <= now && d.endsAt > now)
      .map((d) => d.dealPricePaise),
  );
}

export const purchasable = (p: CartRecord['items'][number]['product']): boolean =>
  p.status === 'LIVE' &&
  !p.deletedAt &&
  p.stock > 0 &&
  p.vendor.status === 'ACTIVE' &&
  !p.vendor.deletedAt;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async record(shopper: Shopper, db: Prisma.TransactionClient = this.prisma): Promise<CartRecord | null> {
    if (shopper.kind === 'guest') {
      await db.cart.deleteMany({
        where: { guestToken: shopper.guestToken, expiresAt: { lte: new Date() } },
      });
    }
    return db.cart.findFirst({ where: ownerWhere(shopper), include: cartInclude });
  }

  async calculate(
    cart: CartRecord | null,
    shopper: Shopper,
    db: Prisma.TransactionClient = this.prisma,
    now = new Date(),
  ): Promise<CartView> {
    const groups = new Map<string, CartGroupView>();
    const savedForLater: CartItemView[] = [];
    let itemsTotal = 0;
    let subtotal = 0;
    let itemCount = 0;
    let hasUnavailableItems = false;

    for (const item of cart?.items ?? []) {
      const p = item.product;
      const unit = currentPrice(p, now);
      const isProductPurchasable = purchasable(p);
      const maxQuantity = isProductPurchasable ? Math.min(p.stock, MAX_QUANTITY_PER_ITEM) : 0;
      const available = maxQuantity > 0 && item.quantity <= maxQuantity;
      const priceUpdated = item.lastPricePaise !== null && item.lastPricePaise !== unit;
      const priceChanged = priceUpdated;
      const stockStatus: StockStatus =
        !maxQuantity || p.stock <= 0
          ? 'out'
          : maxQuantity < 5
            ? 'low'
            : 'in_stock';

      let notice: string | null = null;
      if (!maxQuantity || p.stock <= 0) {
        notice = 'Out of stock';
      } else if (!available || item.quantity > maxQuantity) {
        notice = `Only ${maxQuantity} available. Update quantity.`;
      } else if (priceChanged) {
        notice = 'Price updated';
      }

      const line: CartItemView = {
        id: item.id,
        productId: p.id,
        slug: p.slug,
        title: p.name,
        name: p.name,
        image: p.imageUrl,
        variantLabel: null,
        price: unit,
        mrp: p.mrpPaise,
        quantity: item.quantity,
        maxQuantity,
        stockStatus,
        available,
        priceChanged,
        priceUpdated,
        notice,
        message: notice,
        unitPricePaise: unit,
        mrpPaise: p.mrpPaise,
        lineTotalPaise: unit * item.quantity,
        discountPercent: p.mrpPaise > unit ? Math.round(100 * (1 - unit / p.mrpPaise)) : 0,
      };

      if (item.savedForLater) {
        savedForLater.push(line);
        continue;
      }

      const expectedDelivery = p.vendor.sameDayDelivery
        ? 'Same-day delivery available'
        : p.vendor.standardDeliveryPaise === 0
          ? 'Free delivery in 2-4 days'
          : 'Standard delivery in 2-4 days';

      const group = groups.get(p.vendorId) ?? {
        vendorId: p.vendorId,
        vendorName: p.vendor.displayName,
        expectedDelivery,
        seller: {
          slug: p.vendor.slug,
          name: p.vendor.displayName,
          isPlatformOwned: p.vendor.isPlatformOwned,
          isVerified: p.vendor.isVerified,
        },
        items: [],
        subtotalPaise: 0,
      };
      group.items.push(line);
      group.subtotalPaise = (group.subtotalPaise ?? 0) + line.lineTotalPaise;
      groups.set(p.vendorId, group);

      itemsTotal += Math.max(p.mrpPaise, unit) * item.quantity;
      subtotal += line.lineTotalPaise;
      itemCount += item.quantity;
      hasUnavailableItems = hasUnavailableItems || !available;
    }

    const deliveryFee = subtotal > 0
      ? [...groups.keys()].reduce(
          (sum, id) =>
            sum +
            (cart?.items.find((i) => i.product.vendorId === id)?.product.vendor
              .standardDeliveryPaise ?? 0),
          0,
        )
      : 0;

    const coupon = cart?.couponCode
      ? await db.coupon.findUnique({ where: { code: cart.couponCode } })
      : null;
    const couponCheck = cart?.couponCode
      ? await checkCoupon({
          coupon,
          shopper,
          lines: (cart.items ?? [])
            .filter((i) => !i.savedForLater)
            .map((i) => ({ categoryId: i.product.categoryId, totalPaise: currentPrice(i.product, now) * i.quantity })),
          subtotalPaise: subtotal,
          deliveryFeePaise: deliveryFee,
          now,
          db,
        })
      : null;
    const couponValid = Boolean(couponCheck?.valid);
    const couponMessage = couponCheck?.message ?? '';
    const couponDiscount = couponCheck?.valid ? couponCheck.discountPaise : 0;

    const wallet =
      shopper.kind === 'user'
        ? await db.wallet.findUnique({ where: { userId: shopper.userId } })
        : null;

    const coinsEnabled = Boolean(cart?.coinsEnabled && wallet && wallet.coins > 0);
    const payableBeforeCoins = Math.max(0, subtotal - couponDiscount + deliveryFee);
    const maxCoinsAllowed = Math.floor(
      ((subtotal - couponDiscount) * COIN_RULES.maxRedeemPercent) /
        100 /
        COIN_RULES.coinValuePaise,
    );
    const maxCoinsPayable = Math.floor(payableBeforeCoins / COIN_RULES.coinValuePaise);
    const coinsUsed = coinsEnabled
      ? Math.max(0, Math.min(wallet!.coins, maxCoinsAllowed, maxCoinsPayable))
      : 0;
    const coinsUsedPaise = coinsUsed * COIN_RULES.coinValuePaise;
    const totalPayable = Math.max(0, payableBeforeCoins - coinsUsedPaise);

    return {
      groups: [...groups.values()],
      savedForLater,
      coupon: cart?.couponCode
        ? {
            code: cart.couponCode,
            valid: couponValid,
            message: couponMessage,
          }
        : null,
      coins: {
        balance: wallet?.coins ?? 0,
        used: coinsUsed,
        enabled: Boolean(cart?.coinsEnabled),
      },
      summary: {
        itemsTotal,
        discount: itemsTotal - subtotal,
        couponDiscount,
        deliveryFee,
        coinsUsed: coinsUsedPaise,
        totalPayable,
      },
      currency: 'INR',
      itemCount,
      subtotalPaise: subtotal,
      savingsPaise: itemsTotal - subtotal,
      hasUnavailableItems,
    };
  }

  async view(shopper: Shopper): Promise<CartView> {
    return this.calculate(await this.record(shopper), shopper);
  }

  async addItem(shopper: Shopper, productId: string, quantity: number): Promise<CartView> {
    await this.record(shopper);
    await this.prisma.$transaction(async (tx) => {
      const where = ownerWhere(shopper);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const cart = await tx.cart.upsert({
        where,
        create:
          shopper.kind === 'guest'
            ? { guestToken: shopper.guestToken, expiresAt }
            : { userId: shopper.userId },
        update: {},
      });
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cart.id}))`;
      const p = await tx.product.findUnique({
        where: { id: productId },
        include: { vendor: { include: { pickup: true } }, deals: true },
      });
      if (!p || !purchasable(p)) {
        throw new BadRequestException('This item is out of stock');
      }
      const old = await tx.cartItem.findUnique({
        where: { cartId_productId: { cartId: cart.id, productId } },
      });
      const next = Math.min(
        (old?.savedForLater ? 0 : old?.quantity ?? 0) + quantity,
        p.stock,
        MAX_QUANTITY_PER_ITEM,
      );
      await tx.cartItem.upsert({
        where: { cartId_productId: { cartId: cart.id, productId } },
        create: {
          cartId: cart.id,
          productId,
          quantity: next,
          lastPricePaise: currentPrice(p),
        },
        update: {
          quantity: next,
          savedForLater: false,
          lastPricePaise: currentPrice(p),
        },
      });
    });
    return this.view(shopper);
  }

  async setQuantity(shopper: Shopper, id: string, quantity: number): Promise<CartView> {
    return this.change(shopper, id, { quantity });
  }

  async change(shopper: Shopper, id: string, changes: CartChanges): Promise<CartView> {
    const cart = await this.record(shopper);
    const item = cart?.items.find((i) => i.id === id || i.productId === id);
    if (!cart || !item) {
      throw new NotFoundException('This item is not in your cart');
    }
    if (changes.quantity === 0) {
      return this.removeItem(shopper, id);
    }
    if (changes.quantity !== undefined || changes.savedForLater === false) {
      const quantity = changes.quantity ?? item.quantity;
      if (
        !purchasable(item.product) ||
        quantity > Math.min(item.product.stock, MAX_QUANTITY_PER_ITEM)
      ) {
        throw new BadRequestException('Update quantity to the available stock.');
      }
    }
    if (changes.moveToWishlist && shopper.kind !== 'user') {
      throw new UnauthorizedException('Sign in to move items to your wishlist.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cart.id}))`;
      if (changes.coinsEnabled !== undefined) {
        await tx.cart.update({
          where: { id: cart.id },
          data: { coinsEnabled: changes.coinsEnabled && shopper.kind === 'user' },
        });
      }
      if (changes.moveToWishlist && shopper.kind === 'user') {
        await tx.wishlistItem.upsert({
          where: {
            userId_productId: { userId: shopper.userId, productId: item.productId },
          },
          create: { userId: shopper.userId, productId: item.productId },
          update: {},
        });
        await tx.cartItem.delete({ where: { id: item.id } });
      } else {
        const itemUpdate: Prisma.CartItemUpdateInput = {};
        if (changes.quantity !== undefined) {
          itemUpdate.quantity = changes.quantity;
        }
        if (changes.savedForLater !== undefined) {
          itemUpdate.savedForLater = changes.savedForLater;
        }
        if (changes.quantity !== undefined || changes.savedForLater !== undefined) {
          itemUpdate.lastPricePaise = currentPrice(item.product);
        }
        if (Object.keys(itemUpdate).length > 0) {
          await tx.cartItem.update({ where: { id: item.id }, data: itemUpdate });
        }
      }
    });

    return this.view(shopper);
  }

  async removeItem(shopper: Shopper, id: string): Promise<CartView> {
    const cart = await this.record(shopper);
    if (cart) {
      await this.prisma.cartItem.deleteMany({
        where: { cartId: cart.id, OR: [{ id }, { productId: id }] },
      });
    }
    return this.view(shopper);
  }

  async clear(shopper: Shopper): Promise<CartView> {
    const cart = await this.record(shopper);
    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    return this.view(shopper);
  }

  async coupon(shopper: Shopper, code: string | null): Promise<CartView> {
    const cart = await this.record(shopper);
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Add an item before applying a coupon.');
    }
    const cleanCode = code ? code.trim().toUpperCase() : null;
    if (cleanCode) {
      const preview = await this.calculate({ ...cart, couponCode: cleanCode }, shopper);
      if (!preview.coupon?.valid) {
        throw new BadRequestException(preview.coupon?.message ?? 'Invalid coupon code.');
      }
    }
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponCode: cleanCode },
    });
    return this.view(shopper);
  }

  async mergeGuestCart(guestToken: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${guestToken}))`;
      const guest = await tx.cart.findUnique({ where: { guestToken }, include: cartInclude });
      if (!guest) return;
      if (guestExpired(guest)) {
        await tx.cart.delete({ where: { id: guest.id } });
        return;
      }
      const user = await tx.cart.upsert({
        where: { userId },
        create: { userId, couponCode: guest.couponCode },
        update: {},
      });
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
      for (const item of guest.items) {
        const where = { cartId_productId: { cartId: user.id, productId: item.productId } };
        const old = await tx.cartItem.findUnique({ where });
        const quantity = Math.max(
          1,
          Math.min((old?.quantity ?? 0) + item.quantity, item.product.stock, MAX_QUANTITY_PER_ITEM),
        );
        await tx.cartItem.upsert({
          where,
          create: {
            cartId: user.id,
            productId: item.productId,
            quantity,
            savedForLater: item.savedForLater,
            lastPricePaise: item.lastPricePaise,
          },
          update: {
            quantity,
            savedForLater: Boolean(old?.savedForLater && item.savedForLater),
          },
        });
      }
      await tx.cart.delete({ where: { id: guest.id } });
    });
  }
}
