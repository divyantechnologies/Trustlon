/**
 * Development seed for the address book, wishlist, price alerts and returns (spec 3.3 to 3.5).
 * Runs after the sample orders and only for customers who have no saved addresses yet,
 * so running it again is safe. Never run against production.
 */
import {
  AddressLabel,
  Prisma,
  PrismaClient,
  ReturnReason,
  ReturnRefundMethod,
  ReturnStatus,
  SubOrderStatus,
  UserRole,
} from '@prisma/client';

const DAY = 24 * 60 * 60 * 1000;

const WISHLIST = [
  'trustlon-home-accent-chair',
  'soundspace-wireless-headphones',
  'highland-artisan-coffee-250g',
];

export async function seedAccountExtras(
  prisma: PrismaClient,
  now = new Date(),
): Promise<{ accounts: number }> {
  const email = process.env.SEED_ACCOUNT_EMAIL?.trim().toLowerCase();
  const users = await prisma.user.findMany({
    where: {
      role: UserRole.CUSTOMER,
      deletedAt: null,
      addresses: { none: {} },
      ...(email ? { email } : {}),
    },
    select: { id: true, fullName: true, mobile: true },
    take: 50,
  });

  const products = await prisma.product.findMany({
    where: { slug: { in: WISHLIST } },
    select: {
      id: true,
      slug: true,
      pricePaise: true,
      deals: { where: { endsAt: { gt: now } }, take: 1 },
    },
  });
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const currentPrice = (slug: string) => {
    const product = bySlug.get(slug);
    if (!product) return null;
    return Math.min(product.pricePaise, product.deals[0]?.dealPricePaise ?? product.pricePaise);
  };

  for (const user of users) {
    await prisma.address.createMany({
      data: [
        {
          userId: user.id,
          label: AddressLabel.HOME,
          fullName: user.fullName,
          mobile: user.mobile,
          line1: '12, 3rd Cross, Residency Road',
          line2: 'Ashok Nagar',
          landmark: 'Opposite Garuda Mall',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
          isDefault: true,
        },
        {
          userId: user.id,
          label: AddressLabel.WORK,
          fullName: user.fullName,
          mobile: user.mobile,
          line1: '4th Floor, Prestige Tech Park',
          line2: '80 Feet Road, Koramangala',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560034',
          isDefault: false,
        },
      ],
    });

    for (const slug of WISHLIST) {
      const product = bySlug.get(slug);
      if (!product) continue;
      await prisma.wishlistItem.upsert({
        where: { userId_productId: { userId: user.id, productId: product.id } },
        create: { userId: user.id, productId: product.id },
        update: {},
      });
    }

    // One alert still waiting for a drop, one already reached (target at today's price).
    const chairPrice = currentPrice('trustlon-home-accent-chair');
    const chair = bySlug.get('trustlon-home-accent-chair');
    if (chair && chairPrice) {
      await prisma.priceAlert.upsert({
        where: { userId_productId: { userId: user.id, productId: chair.id } },
        create: {
          userId: user.id,
          productId: chair.id,
          targetPricePaise: Math.floor((chairPrice * 0.85) / 100) * 100,
          priceAtCreationPaise: chairPrice,
        },
        update: {},
      });
    }
    const coffeePrice = currentPrice('highland-artisan-coffee-250g');
    const coffee = bySlug.get('highland-artisan-coffee-250g');
    if (coffee && coffeePrice) {
      await prisma.priceAlert.upsert({
        where: { userId_productId: { userId: user.id, productId: coffee.id } },
        create: {
          userId: user.id,
          productId: coffee.id,
          targetPricePaise: coffeePrice,
          priceAtCreationPaise: coffeePrice + 5_000,
          createdAt: new Date(now.getTime() - 6 * DAY),
        },
        update: {},
      });
    }

    await seedSampleReturn(prisma, user.id, now);
  }

  return { accounts: users.length };
}

/** An approved return for the delivered headphones, waiting for pickup. */
async function seedSampleReturn(prisma: PrismaClient, userId: string, now: Date): Promise<void> {
  const subOrder = await prisma.subOrder.findFirst({
    where: {
      order: { userId },
      status: SubOrderStatus.DELIVERED,
      returnWindowEndsAt: { gt: now },
      vendor: { slug: 'soundspace' },
      returns: { none: {} },
    },
    include: { order: true, items: true },
  });
  if (!subOrder || subOrder.items.length === 0) return;

  const item = subOrder.items[0];
  const requestedAt = new Date(now.getTime() - 1 * DAY);
  const approvedAt = new Date(requestedAt.getTime() + 3 * 60 * 60 * 1000);
  const digits = subOrder.subOrderNumber.replace(/\D/g, '').slice(-6);
  const yymm = `${String(now.getUTCFullYear()).slice(2)}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  await prisma.returnRequest.create({
    data: {
      returnNumber: `RT${yymm}${digits}`,
      userId,
      subOrderId: subOrder.id,
      status: ReturnStatus.APPROVED,
      reason: ReturnReason.DEFECTIVE,
      comments: 'Left ear cup stops working after a few minutes.',
      pickupAddress: subOrder.order.shippingAddress as Prisma.InputJsonValue,
      refundMethod: ReturnRefundMethod.ORIGINAL_PAYMENT,
      refundAmountPaise: item.unitPricePaise * item.quantity,
      requestedAt,
      approvedAt,
      pickupScheduledFor: new Date(now.getTime() + 1 * DAY),
      items: {
        create: {
          orderItemId: item.id,
          quantity: item.quantity,
          unitPricePaise: item.unitPricePaise,
        },
      },
      events: {
        create: [
          { status: ReturnStatus.REQUESTED, title: 'Return requested', occurredAt: requestedAt },
          {
            status: ReturnStatus.APPROVED,
            title: 'Return approved, pickup scheduled',
            note: 'The courier will collect the item from your pickup address.',
            occurredAt: approvedAt,
          },
        ],
      },
    },
  });
  await prisma.subOrder.update({
    where: { id: subOrder.id },
    data: { status: SubOrderStatus.RETURN_REQUESTED },
  });
}
