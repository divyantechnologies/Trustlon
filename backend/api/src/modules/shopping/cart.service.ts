import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, ProductStatus, VendorStatus } from '@prisma/client';
import { ownerWhere, Shopper } from '../../common/shopper/shopper';
import { CURRENCY, discountPercent } from '../../common/utils/money';
import { PrismaService } from '../../prisma/prisma.service';
import { PricingService } from '../catalog/pricing.service';
import { MAX_QUANTITY_PER_ITEM } from '../catalog/product.presenter';

const cartProductInclude = {
  vendor: {
    select: {
      slug: true,
      displayName: true,
      isPlatformOwned: true,
      isVerified: true,
      status: true,
      deletedAt: true,
    },
  },
} satisfies Prisma.ProductInclude;

type CartProduct = Prisma.ProductGetPayload<{ include: typeof cartProductInclude }>;

export interface CartLine {
  productId: string;
  slug: string;
  name: string;
  image: string;
  quantity: number;
  unitPricePaise: number;
  mrpPaise: number;
  discountPercent: number;
  lineTotalPaise: number;
  /** False when the product was removed, is out of stock, or the seller is suspended. */
  available: boolean;
  maxQuantity: number;
}

export interface CartGroup {
  seller: { slug: string; name: string; isPlatformOwned: boolean; isVerified: boolean };
  items: CartLine[];
  subtotalPaise: number;
}

export interface CartView {
  currency: string;
  groups: CartGroup[];
  itemCount: number;
  subtotalPaise: number;
  savingsPaise: number;
  hasUnavailableItems: boolean;
}

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  /** Prices and stock are re-read on every call, so the cart never shows stale prices. */
  async view(shopper: Shopper): Promise<CartView> {
    const cart = await this.prisma.cart.findFirst({
      where: ownerWhere(shopper),
      include: {
        items: { orderBy: { addedAt: 'asc' }, include: { product: { include: cartProductInclude } } },
      },
    });
    if (!cart || cart.items.length === 0) return emptyCart();

    const deals = await this.pricing.activeDeals(cart.items.map((item) => item.productId));
    const groups = new Map<string, CartGroup>();
    let itemCount = 0;
    let subtotal = 0;
    let mrpTotal = 0;
    let hasUnavailable = false;

    for (const item of cart.items) {
      const product = item.product;
      const available = isPurchasable(product);
      const unit = this.pricing.effectivePrice(product, deals.get(product.id));
      const line: CartLine = {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: product.imageUrl,
        quantity: item.quantity,
        unitPricePaise: unit,
        mrpPaise: product.mrpPaise,
        discountPercent: discountPercent(unit, product.mrpPaise),
        lineTotalPaise: unit * item.quantity,
        available,
        maxQuantity: maxQuantity(product),
      };

      const key = product.vendor.slug;
      const group: CartGroup = groups.get(key) ?? {
        seller: {
          slug: product.vendor.slug,
          name: product.vendor.displayName,
          isPlatformOwned: product.vendor.isPlatformOwned,
          isVerified: product.vendor.isVerified,
        },
        items: [],
        subtotalPaise: 0,
      };
      group.items.push(line);
      groups.set(key, group);

      if (available) {
        group.subtotalPaise += line.lineTotalPaise;
        itemCount += item.quantity;
        subtotal += line.lineTotalPaise;
        mrpTotal += product.mrpPaise * item.quantity;
      } else {
        hasUnavailable = true;
      }
    }

    return {
      currency: CURRENCY,
      groups: [...groups.values()],
      itemCount,
      subtotalPaise: subtotal,
      savingsPaise: Math.max(0, mrpTotal - subtotal),
      hasUnavailableItems: hasUnavailable,
    };
  }

  /** Adds to the existing quantity, capped at stock and at 10 per item. */
  async addItem(shopper: Shopper, productId: string, quantity: number): Promise<CartView> {
    const product = await this.requirePurchasable(productId);
    const cart = await this.getOrCreate(shopper);
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });
    const next = Math.min((existing?.quantity ?? 0) + quantity, maxQuantity(product));

    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      create: { cartId: cart.id, productId, quantity: next },
      update: { quantity: next },
    });
    return this.view(shopper);
  }

  /** Sets an exact quantity. 0 removes the item. */
  async setQuantity(shopper: Shopper, productId: string, quantity: number): Promise<CartView> {
    if (quantity === 0) return this.removeItem(shopper, productId);

    const cart = await this.prisma.cart.findFirst({ where: ownerWhere(shopper) });
    const item = cart
      ? await this.prisma.cartItem.findUnique({
          where: { cartId_productId: { cartId: cart.id, productId } },
        })
      : null;
    if (!cart || !item) throw new NotFoundException('This item is not in your cart');

    const product = await this.requirePurchasable(productId);
    const max = maxQuantity(product);
    if (quantity > max) {
      throw new BadRequestException({
        statusCode: 400,
        message: `Only ${max} available for this item`,
        maxQuantity: max,
      });
    }

    await this.prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
    return this.view(shopper);
  }

  async removeItem(shopper: Shopper, productId: string): Promise<CartView> {
    const cart = await this.prisma.cart.findFirst({ where: ownerWhere(shopper) });
    if (cart) await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
    return this.view(shopper);
  }

  async clear(shopper: Shopper): Promise<CartView> {
    const cart = await this.prisma.cart.findFirst({ where: ownerWhere(shopper) });
    if (cart) await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return emptyCart();
  }

  /** Moves a guest cart into the user's cart after sign-in. Quantities add up, capped per item. */
  async mergeGuestCart(guestToken: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const guest = await tx.cart.findUnique({ where: { guestToken }, include: { items: true } });
      if (!guest) return;

      const userCart =
        (await tx.cart.findUnique({ where: { userId } })) ??
        (await tx.cart.create({ data: { userId } }));

      for (const item of guest.items) {
        const existing = await tx.cartItem.findUnique({
          where: { cartId_productId: { cartId: userCart.id, productId: item.productId } },
        });
        const quantity = Math.min((existing?.quantity ?? 0) + item.quantity, MAX_QUANTITY_PER_ITEM);
        await tx.cartItem.upsert({
          where: { cartId_productId: { cartId: userCart.id, productId: item.productId } },
          create: { cartId: userCart.id, productId: item.productId, quantity },
          update: { quantity },
        });
      }
      await tx.cart.delete({ where: { id: guest.id } });
    });
  }

  private async getOrCreate(shopper: Shopper) {
    const where = shopper.kind === 'user' ? { userId: shopper.userId } : { guestToken: shopper.guestToken };
    try {
      return await this.prisma.cart.upsert({ where, create: where, update: {} });
    } catch (error) {
      // Two first requests at the same time: the other one created the cart.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.cart.findUniqueOrThrow({ where });
      }
      throw error;
    }
  }

  private async requirePurchasable(productId: string): Promise<CartProduct> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: cartProductInclude,
    });
    if (!product || product.deletedAt || product.status !== ProductStatus.LIVE) {
      throw new NotFoundException('Product not found');
    }
    if (!isPurchasable(product)) {
      throw new UnprocessableEntityException('This item is out of stock');
    }
    return product;
  }
}

function isPurchasable(product: CartProduct): boolean {
  return (
    product.status === ProductStatus.LIVE &&
    !product.deletedAt &&
    product.stock > 0 &&
    product.vendor.status === VendorStatus.ACTIVE &&
    !product.vendor.deletedAt
  );
}

function maxQuantity(product: { stock: number }): number {
  return Math.max(0, Math.min(product.stock, MAX_QUANTITY_PER_ITEM));
}

function emptyCart(): CartView {
  return {
    currency: CURRENCY,
    groups: [],
    itemCount: 0,
    subtotalPaise: 0,
    savingsPaise: 0,
    hasUnavailableItems: false,
  };
}
