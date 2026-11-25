import 'reflect-metadata';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CartService, currentPrice, guestExpired, purchasable } from './cart.service';
import { Shopper } from '../../common/shopper/shopper';

describe('CartService', () => {
  let service: CartService;
  let prisma: any;

  const userShopper: Shopper = { kind: 'user', userId: 'user-uuid-1' };
  const guestShopper: Shopper = { kind: 'guest', guestToken: 'guest-uuid-1' };

  const mockVendor = {
    id: 'vendor-1',
    slug: 'tech-store',
    displayName: 'Tech Store',
    isPlatformOwned: false,
    isVerified: true,
    status: 'ACTIVE',
    deletedAt: null,
    standardDeliveryPaise: 5000, // ₹50
    sameDayDelivery: false,
    pickup: null,
  };

  const mockProduct = {
    id: 'prod-1',
    slug: 'wireless-mouse',
    name: 'Wireless Mouse',
    imageUrl: 'https://img.test/mouse.jpg',
    pricePaise: 100000, // ₹1,000
    mrpPaise: 150000, // ₹1,500
    stock: 20,
    status: 'LIVE',
    deletedAt: null,
    vendorId: 'vendor-1',
    vendor: mockVendor,
    deals: [],
  };

  beforeEach(() => {
    prisma = {
      cart: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      cartItem: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
      coupon: {
        findUnique: jest.fn(),
      },
      order: {
        count: jest.fn().mockResolvedValue(0),
      },
      primeMembership: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      wallet: {
        findUnique: jest.fn(),
      },
      wishlistItem: {
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    service = new CartService(prisma as unknown as PrismaService);
  });

  describe('1. Price and stock revalidation on load', () => {
    it('recomputes effective price from deals and marks priceChanged if price updated', async () => {
      const now = new Date('2026-11-16T12:00:00Z');
      const cart = {
        id: 'cart-1',
        userId: 'user-uuid-1',
        couponCode: null,
        coinsEnabled: false,
        items: [
          {
            id: 'item-1',
            cartId: 'cart-1',
            productId: 'prod-1',
            quantity: 2,
            savedForLater: false,
            lastPricePaise: 100000, // old price ₹1,000
            product: {
              ...mockProduct,
              pricePaise: 90000, // regular price dropped to ₹900
              deals: [
                {
                  startsAt: new Date('2026-11-16T00:00:00Z'),
                  endsAt: new Date('2026-11-16T23:59:59Z'),
                  dealPricePaise: 80000, // active flash deal ₹800
                },
              ],
            },
          },
        ],
      };

      const result = await service.calculate(cart as any, userShopper, prisma, now);
      const item = result.groups[0].items[0];

      expect(item.price).toBe(80000); // Deal price used
      expect(item.priceChanged).toBe(true);
      expect(item.priceUpdated).toBe(true);
      expect(item.notice).toBe('Price updated');
      expect(result.summary.totalPayable).toBe(80000 * 2 + 5000); // Subtotal + ₹50 delivery
    });

    it('marks item as out of stock when product stock is 0 or unlisted', async () => {
      const cart = {
        id: 'cart-1',
        userId: 'user-uuid-1',
        couponCode: null,
        coinsEnabled: false,
        items: [
          {
            id: 'item-1',
            cartId: 'cart-1',
            productId: 'prod-1',
            quantity: 2,
            savedForLater: false,
            lastPricePaise: 100000,
            product: {
              ...mockProduct,
              stock: 0, // out of stock
            },
          },
        ],
      };

      const result = await service.calculate(cart as any, userShopper, prisma);
      const item = result.groups[0].items[0];

      expect(item.stockStatus).toBe('out');
      expect(item.available).toBe(false);
      expect(item.maxQuantity).toBe(0);
      expect(item.notice).toBe('Out of stock');
      expect(result.hasUnavailableItems).toBe(true);
    });

    it('warns when stock is less than cart quantity', async () => {
      const cart = {
        id: 'cart-1',
        userId: 'user-uuid-1',
        couponCode: null,
        coinsEnabled: false,
        items: [
          {
            id: 'item-1',
            cartId: 'cart-1',
            productId: 'prod-1',
            quantity: 5,
            savedForLater: false,
            lastPricePaise: 100000,
            product: {
              ...mockProduct,
              stock: 3, // only 3 left
            },
          },
        ],
      };

      const result = await service.calculate(cart as any, userShopper, prisma);
      const item = result.groups[0].items[0];

      expect(item.available).toBe(false);
      expect(item.maxQuantity).toBe(3);
      expect(item.notice).toBe('Only 3 available. Update quantity.');
      expect(result.hasUnavailableItems).toBe(true);
    });
  });

  describe('2. Guest cart expiry and merge on login', () => {
    it('expires guest cart at the 30-day boundary and purges on load', async () => {
      const created = new Date('2026-01-01T00:00:00Z');
      const expiresAt = new Date(created.getTime() + 30 * 86400000);
      const cart = { expiresAt };

      expect(guestExpired(cart, new Date(expiresAt.getTime() - 1000))).toBe(false);
      expect(guestExpired(cart, expiresAt)).toBe(true);
      expect(guestExpired(cart, new Date(expiresAt.getTime() + 1000))).toBe(true);

      // record() automatically purges expired guest carts
      await service.record(guestShopper, prisma);
      expect(prisma.cart.deleteMany).toHaveBeenCalledWith({
        where: { guestToken: 'guest-uuid-1', expiresAt: { lte: expect.any(Date) } },
      });
    });

    it('merges active guest cart into user cart on login and cleans up guest record', async () => {
      const guestCart = {
        id: 'guest-cart-1',
        guestToken: 'guest-token-123',
        expiresAt: new Date(Date.now() + 10 * 86400000), // active
        couponCode: 'SAVE10',
        items: [
          {
            productId: 'prod-1',
            quantity: 3,
            savedForLater: false,
            lastPricePaise: 100000,
            product: mockProduct,
          },
        ],
      };

      prisma.cart.findUnique.mockResolvedValueOnce(guestCart);
      prisma.cart.upsert.mockResolvedValueOnce({ id: 'user-cart-1', userId: 'user-1' });
      prisma.cartItem.findUnique.mockResolvedValueOnce({ quantity: 2, savedForLater: false }); // already has 2

      await service.mergeGuestCart('guest-token-123', 'user-1');

      // Check upsert with capped sum (2 + 3 = 5, within stock 20 and max 10)
      expect(prisma.cartItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ cartId: 'user-cart-1', productId: 'prod-1', quantity: 5 }),
          update: expect.objectContaining({ quantity: 5 }),
        }),
      );
      // Check guest cart deleted
      expect(prisma.cart.delete).toHaveBeenCalledWith({ where: { id: 'guest-cart-1' } });
    });

    it('discards expired guest cart during merge on login without merging items', async () => {
      const expiredGuestCart = {
        id: 'expired-cart',
        guestToken: 'guest-token-old',
        expiresAt: new Date(Date.now() - 1000), // expired
        items: [{ productId: 'prod-1', quantity: 2 }],
      };

      prisma.cart.findUnique.mockResolvedValueOnce(expiredGuestCart);

      await service.mergeGuestCart('guest-token-old', 'user-1');

      expect(prisma.cartItem.upsert).not.toHaveBeenCalled();
      expect(prisma.cart.delete).toHaveBeenCalledWith({ where: { id: 'expired-cart' } });
    });
  });

  describe('3. Quantity limits', () => {
    it('rejects setting quantity exceeding available stock or MAX_QUANTITY_PER_ITEM (10)', async () => {
      const cart = {
        id: 'cart-1',
        userId: 'user-uuid-1',
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 2, product: { ...mockProduct, stock: 5 } }],
      };
      prisma.cart.findFirst.mockResolvedValue(cart);

      // Exceeds stock (6 > 5)
      await expect(service.change(userShopper, 'item-1', { quantity: 6 })).rejects.toThrow(
        BadRequestException,
      );

      // Exceeds MAX_QUANTITY_PER_ITEM 10 (11 > 10 even if stock is 20)
      const cart2 = {
        id: 'cart-1',
        userId: 'user-uuid-1',
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 2, product: mockProduct }],
      };
      prisma.cart.findFirst.mockResolvedValue(cart2);
      await expect(service.change(userShopper, 'item-1', { quantity: 11 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('setting quantity to 0 removes the item from cart', async () => {
      const cart = {
        id: 'cart-1',
        userId: 'user-uuid-1',
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 2, product: mockProduct }],
      };
      prisma.cart.findFirst.mockResolvedValue(cart);

      await service.change(userShopper, 'item-1', { quantity: 0 });
      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-1', OR: [{ id: 'item-1' }, { productId: 'item-1' }] },
      });
    });
  });

  describe('4. Coupon apply and remove', () => {
    const validCoupon = {
      code: 'TRUSTLON20',
      type: 'PERCENT',
      audience: 'ALL',
      categoryIds: [],
      usageLimit: null,
      perUserLimit: 1,
      usedCount: 0,
      value: 2000, // 20%
      minOrderPaise: 50000, // min ₹500
      maxDiscountPaise: 50000, // max ₹500 discount
      startsAt: new Date('2026-01-01T00:00:00Z'),
      endsAt: new Date('2026-12-31T23:59:59Z'),
      isActive: true,
    };

    it('applies a valid coupon within spend threshold and applies discount', async () => {
      const cart = {
        id: 'cart-1',
        userId: 'user-uuid-1',
        couponCode: null,
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 1, product: mockProduct, lastPricePaise: 100000 }],
      };
      prisma.cart.findFirst.mockResolvedValue(cart);
      prisma.coupon.findUnique.mockResolvedValue(validCoupon);

      await service.coupon(userShopper, 'TRUSTLON20');
      expect(prisma.cart.update).toHaveBeenCalledWith({
        where: { id: 'cart-1' },
        data: { couponCode: 'TRUSTLON20' },
      });
    });

    it('rejects coupon if code does not exist', async () => {
      const cart = {
        id: 'cart-1',
        userId: 'user-uuid-1',
        couponCode: null,
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 1, product: mockProduct, lastPricePaise: 100000 }],
      };
      prisma.cart.findFirst.mockResolvedValue(cart);
      prisma.coupon.findUnique.mockResolvedValue(null);

      await expect(service.coupon(userShopper, 'NONEXISTENT')).rejects.toThrow(
        new BadRequestException('Invalid coupon code.'),
      );
    });

    it('rejects expired or inactive coupon', async () => {
      const cart = {
        id: 'cart-1',
        userId: 'user-uuid-1',
        couponCode: null,
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 1, product: mockProduct, lastPricePaise: 100000 }],
      };
      prisma.cart.findFirst.mockResolvedValue(cart);
      prisma.coupon.findUnique.mockResolvedValue({
        ...validCoupon,
        isActive: false,
      });

      await expect(service.coupon(userShopper, 'TRUSTLON20')).rejects.toThrow(
        new BadRequestException('This coupon is expired.'),
      );
    });

    it('rejects coupon when subtotal does not meet minTotalPaise', async () => {
      const cart = {
        id: 'cart-1',
        userId: 'user-uuid-1',
        couponCode: null,
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 1, product: mockProduct, lastPricePaise: 100000 }],
      };
      prisma.cart.findFirst.mockResolvedValue(cart);
      prisma.coupon.findUnique.mockResolvedValue({
        ...validCoupon,
        minOrderPaise: 500000, // requires ₹5,000; cart subtotal is only ₹1,000
      });

      await expect(service.coupon(userShopper, 'TRUSTLON20')).rejects.toThrow(
        new BadRequestException('Minimum order value of ₹5000 required.'),
      );
    });

    it('removing a coupon updates cart to null', async () => {
      const cart = {
        id: 'cart-1',
        userId: 'user-uuid-1',
        couponCode: 'TRUSTLON20',
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 1, product: mockProduct, lastPricePaise: 100000 }],
      };
      prisma.cart.findFirst.mockResolvedValue(cart);

      await service.coupon(userShopper, null);
      expect(prisma.cart.update).toHaveBeenCalledWith({
        where: { id: 'cart-1' },
        data: { couponCode: null },
      });
    });
  });

  describe('5. Coins cap and redemption rules', () => {
    it('caps coins used at user balance, max 10% of subtotal, and total payable', async () => {
      // Subtotal = ₹2,000 (200000 paise). Delivery = ₹50 (5000 paise). Payable before coins = ₹2,050.
      // 10% of subtotal = ₹200 = 200 coins max.
      // User has 500 coins balance.
      // Maximum redeemable = min(500, 200, 2050) = 200 coins.
      const cart = {
        id: 'cart-1',
        userId: 'user-uuid-1',
        couponCode: null,
        coinsEnabled: true,
        items: [
          {
            id: 'item-1',
            cartId: 'cart-1',
            productId: 'prod-1',
            quantity: 2,
            savedForLater: false,
            lastPricePaise: 100000,
            product: mockProduct,
          },
        ],
      };

      prisma.wallet.findUnique.mockResolvedValue({ coins: 500 });
      const result = await service.calculate(cart as any, userShopper, prisma);

      expect(result.coins.balance).toBe(500);
      expect(result.coins.used).toBe(200); // capped at 10%
      expect(result.summary.coinsUsed).toBe(20000); // 200 coins * 100 paise = ₹200
      expect(result.summary.totalPayable).toBe(200000 + 5000 - 20000); // ₹1,850
    });

    it('caps coins at available balance when balance is less than 10%', async () => {
      // Subtotal = ₹2,000. 10% = 200 coins. User has 75 coins.
      // Redeemable = 75 coins.
      const cart = {
        id: 'cart-1',
        userId: 'user-uuid-1',
        couponCode: null,
        coinsEnabled: true,
        items: [
          {
            id: 'item-1',
            cartId: 'cart-1',
            productId: 'prod-1',
            quantity: 2,
            savedForLater: false,
            lastPricePaise: 100000,
            product: mockProduct,
          },
        ],
      };

      prisma.wallet.findUnique.mockResolvedValue({ coins: 75 });
      const result = await service.calculate(cart as any, userShopper, prisma);

      expect(result.coins.used).toBe(75);
      expect(result.summary.coinsUsed).toBe(7500);
      expect(result.summary.totalPayable).toBe(200000 + 5000 - 7500);
    });

    it('uses 0 coins when coinsEnabled is false', async () => {
      const cart = {
        id: 'cart-1',
        userId: 'user-uuid-1',
        couponCode: null,
        coinsEnabled: false,
        items: [
          {
            id: 'item-1',
            cartId: 'cart-1',
            productId: 'prod-1',
            quantity: 2,
            savedForLater: false,
            lastPricePaise: 100000,
            product: mockProduct,
          },
        ],
      };

      prisma.wallet.findUnique.mockResolvedValue({ coins: 500 });
      const result = await service.calculate(cart as any, userShopper, prisma);

      expect(result.coins.used).toBe(0);
      expect(result.summary.coinsUsed).toBe(0);
    });
  });

  describe('6. Summary calculation', () => {
    it('accurately computes itemsTotal, discount, deliveryFee, coupon, coins and totalPayable', async () => {
      // Product 1: MRP ₹1,500, Price ₹1,000, qty 2 -> itemsTotal = 300000, subtotal = 200000, discount = 100000
      // Coupon: 10% of ₹2,000 = ₹200 (20000 paise)
      // Subtotal after coupon = ₹1,800
      // Delivery fee = ₹50 (5000 paise)
      // Coins: 10% of ₹1,800 = 180 coins = ₹180 (18000 paise)
      // Total payable = 180000 + 5000 - 18000 = ₹1,670 (167000 paise)
      const now = new Date('2026-11-16T12:00:00Z');
      const cart = {
        id: 'cart-1',
        userId: 'user-uuid-1',
        couponCode: 'SAVE10',
        coinsEnabled: true,
        items: [
          {
            id: 'item-1',
            cartId: 'cart-1',
            productId: 'prod-1',
            quantity: 2,
            savedForLater: false,
            lastPricePaise: 100000,
            product: mockProduct,
          },
        ],
      };

      prisma.coupon.findUnique.mockResolvedValue({
        code: 'SAVE10',
        type: 'PERCENT',
        audience: 'ALL',
        categoryIds: [],
        usageLimit: null,
        perUserLimit: 1,
        usedCount: 0,
        value: 1000, // 10%
        minOrderPaise: 100000,
        maxDiscountPaise: null,
        startsAt: new Date('2026-01-01T00:00:00Z'),
        endsAt: new Date('2026-12-31T23:59:59Z'),
        isActive: true,
      });

      prisma.wallet.findUnique.mockResolvedValue({ coins: 300 });

      const result = await service.calculate(cart as any, userShopper, prisma, now);

      expect(result.summary).toEqual({
        itemsTotal: 300000, // 2 * ₹1,500
        discount: 100000, // 300000 - 200000
        couponDiscount: 20000, // 10% of 200000
        deliveryFee: 5000, // ₹50
        coinsUsed: 18000, // 10% of 180000 = 180 coins = 18000 paise
        totalPayable: 167000, // 200000 - 20000 + 5000 - 18000
      });
      expect(result.currency).toBe('INR');
      expect(result.itemCount).toBe(2);
    });
  });

  describe('7. Move to wishlist and saved for later', () => {
    it('moves item to wishlist and removes from cart for signed-in user', async () => {
      const cart = {
        id: 'cart-1',
        userId: 'user-uuid-1',
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 2, product: mockProduct }],
      };
      prisma.cart.findFirst.mockResolvedValue(cart);

      await service.change(userShopper, 'item-1', { moveToWishlist: true });

      expect(prisma.wishlistItem.upsert).toHaveBeenCalledWith({
        where: { userId_productId: { userId: 'user-uuid-1', productId: 'prod-1' } },
        create: { userId: 'user-uuid-1', productId: 'prod-1' },
        update: {},
      });
      expect(prisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
    });

    it('rejects move to wishlist for guest with 401', async () => {
      const cart = {
        id: 'guest-cart',
        guestToken: 'guest-uuid-1',
        items: [{ id: 'item-1', productId: 'prod-1', quantity: 2, product: mockProduct }],
      };
      prisma.cart.findFirst.mockResolvedValue(cart);

      await expect(service.change(guestShopper, 'item-1', { moveToWishlist: true })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('moves item to saved for later and excludes it from active groups', async () => {
      const cart = {
        id: 'cart-1',
        userId: 'user-uuid-1',
        items: [
          {
            id: 'item-1',
            cartId: 'cart-1',
            productId: 'prod-1',
            quantity: 2,
            savedForLater: true,
            lastPricePaise: 100000,
            product: mockProduct,
          },
        ],
      };

      const result = await service.calculate(cart as any, userShopper, prisma);
      expect(result.groups).toHaveLength(0);
      expect(result.savedForLater).toHaveLength(1);
      expect(result.savedForLater[0].id).toBe('item-1');
      expect(result.summary.totalPayable).toBe(0);
    });
  });
});
