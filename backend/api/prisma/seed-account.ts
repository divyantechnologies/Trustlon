/**
 * Development seed for My Account: sample orders, a wallet balance and seller GSTINs.
 * Orders are added only to customer accounts that have none, so running it again is safe.
 * Set SEED_ACCOUNT_EMAIL to limit it to one account. Never run against production.
 */
import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  PrismaClient,
  RefundStatus,
  SubOrderStatus,
  UserRole,
  WalletEntrySource,
  WalletEntryType,
} from '@prisma/client';
import { splitGst } from '../src/common/utils/gst';
import { formatOrderNumber } from '../src/modules/orders/order-rules';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Sample GSTINs for the seeded sellers; the first two digits match the pickup state. */
const SELLER_GSTINS: Record<string, string> = {
  trustlon: '29AAHCT1234A1Z5',
  soundspace: '27AAKCS5678B1Z2',
  'urban-thread': '07AAECU4321C1Z8',
  'pure-and-kind': '33AAJFP8765D1Z4',
  'the-daily-pantry': '29AAMFD2468E1Z1',
  'green-basket': '29AANFG1357F1Z9',
  'the-living-room': '29AAPFL9753G1Z6',
};

/** GST rate by top-level category, in basis points. */
const GST_BY_ROOT: Record<string, number> = {
  electronics: 1800,
  fashion: 1200,
  home: 1800,
  beauty: 1800,
  grocery: 500,
  sports: 1800,
};

const COURIERS = {
  delhivery: { name: 'Delhivery', code: 'DLV' },
  bluedart: { name: 'Blue Dart', code: 'BDT' },
  xpressbees: { name: 'Xpressbees', code: 'XPB' },
};

type CourierKey = keyof typeof COURIERS;

interface SubOrderPlan {
  vendor: string;
  items: Array<{ slug: string; quantity: number }>;
  status: SubOrderStatus;
  courier?: CourierKey;
  /** Hours after the order was placed for each step reached. */
  confirmedAfter?: number;
  packedAfter?: number;
  shippedAfter?: number;
  outForDeliveryAfter?: number;
  deliveredAfter?: number;
  cancelledAfter?: number;
  expectedAfterDays: number;
}

interface OrderPlan {
  placedDaysAgo: number;
  paymentMethod: PaymentMethod;
  subOrders: SubOrderPlan[];
}

const ORDER_PLANS: OrderPlan[] = [
  {
    placedDaysAgo: 25,
    paymentMethod: PaymentMethod.UPI,
    subOrders: [
      {
        vendor: 'trustlon',
        items: [{ slug: 'trustlon-move-smart-watch', quantity: 1 }],
        status: SubOrderStatus.DELIVERED,
        courier: 'delhivery',
        confirmedAfter: 1,
        packedAfter: 20,
        shippedAfter: 26,
        outForDeliveryAfter: 70,
        deliveredAfter: 76,
        expectedAfterDays: 4,
      },
    ],
  },
  {
    placedDaysAgo: 9,
    paymentMethod: PaymentMethod.CARD,
    subOrders: [
      {
        vendor: 'the-living-room',
        items: [{ slug: 'handpicked-living-room-accent-chair', quantity: 1 }],
        status: SubOrderStatus.CANCELLED,
        confirmedAfter: 2,
        cancelledAfter: 18,
        expectedAfterDays: 5,
      },
    ],
  },
  {
    placedDaysAgo: 6,
    paymentMethod: PaymentMethod.UPI,
    subOrders: [
      {
        vendor: 'trustlon',
        items: [
          { slug: 'trustlon-studio-desk-lamp', quantity: 1 },
          { slug: 'trustlon-go-everyday-backpack', quantity: 1 },
        ],
        status: SubOrderStatus.DELIVERED,
        courier: 'delhivery',
        confirmedAfter: 1,
        packedAfter: 18,
        shippedAfter: 24,
        outForDeliveryAfter: 92,
        deliveredAfter: 98,
        expectedAfterDays: 5,
      },
      {
        vendor: 'soundspace',
        items: [{ slug: 'soundspace-wireless-headphones', quantity: 1 }],
        status: SubOrderStatus.DELIVERED,
        courier: 'bluedart',
        confirmedAfter: 2,
        packedAfter: 22,
        shippedAfter: 30,
        outForDeliveryAfter: 70,
        deliveredAfter: 75,
        expectedAfterDays: 4,
      },
    ],
  },
  {
    placedDaysAgo: 2,
    paymentMethod: PaymentMethod.COD,
    subOrders: [
      {
        vendor: 'urban-thread',
        items: [{ slug: 'everyday-classic-sneakers', quantity: 1 }],
        status: SubOrderStatus.OUT_FOR_DELIVERY,
        courier: 'xpressbees',
        confirmedAfter: 1,
        packedAfter: 10,
        shippedAfter: 16,
        outForDeliveryAfter: 44,
        expectedAfterDays: 2,
      },
      {
        vendor: 'pure-and-kind',
        items: [{ slug: 'daily-glow-skincare-essentials', quantity: 2 }],
        status: SubOrderStatus.PACKED,
        confirmedAfter: 3,
        packedAfter: 30,
        expectedAfterDays: 4,
      },
    ],
  },
  {
    placedDaysAgo: 0.15,
    paymentMethod: PaymentMethod.CARD,
    subOrders: [
      {
        vendor: 'the-daily-pantry',
        items: [{ slug: 'highland-artisan-coffee-250g', quantity: 2 }],
        status: SubOrderStatus.CONFIRMED,
        confirmedAfter: 1,
        expectedAfterDays: 3,
      },
    ],
  },
];

const FREE_DELIVERY_FROM_PAISE = 49_900;
const DELIVERY_FEE_PAISE = 4_000;

/** Indian financial year label, e.g. 26-27 for April 2026 to March 2027. */
function financialYear(date: Date): string {
  const year = date.getUTCMonth() >= 3 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return `${String(year).slice(2)}-${String(year + 1).slice(2)}`;
}

function shipmentEvents(
  plan: SubOrderPlan,
  placedAt: Date,
  sellerCity: string,
  customerCity: string,
) {
  const at = (hours: number) => new Date(placedAt.getTime() + hours * HOUR);
  const courier = plan.courier ? COURIERS[plan.courier].name : 'the courier';
  const events: Array<{
    status: SubOrderStatus;
    title: string;
    location: string | null;
    occurredAt: Date;
  }> = [
    { status: SubOrderStatus.PLACED, title: 'Order placed', location: null, occurredAt: placedAt },
  ];
  if (plan.confirmedAfter !== undefined)
    events.push({
      status: SubOrderStatus.CONFIRMED,
      title: 'Seller confirmed your order',
      location: null,
      occurredAt: at(plan.confirmedAfter),
    });
  if (plan.packedAfter !== undefined)
    events.push({
      status: SubOrderStatus.PACKED,
      title: 'Packed and ready to ship',
      location: sellerCity,
      occurredAt: at(plan.packedAfter),
    });
  if (plan.shippedAfter !== undefined)
    events.push({
      status: SubOrderStatus.SHIPPED,
      title: `Shipped with ${courier}`,
      location: sellerCity,
      occurredAt: at(plan.shippedAfter),
    });
  if (plan.outForDeliveryAfter !== undefined)
    events.push({
      status: SubOrderStatus.OUT_FOR_DELIVERY,
      title: 'Out for delivery',
      location: customerCity,
      occurredAt: at(plan.outForDeliveryAfter),
    });
  if (plan.deliveredAfter !== undefined)
    events.push({
      status: SubOrderStatus.DELIVERED,
      title: 'Delivered',
      location: customerCity,
      occurredAt: at(plan.deliveredAfter),
    });
  if (plan.cancelledAfter !== undefined)
    events.push({
      status: SubOrderStatus.CANCELLED,
      title: 'Cancelled by you',
      location: null,
      occurredAt: at(plan.cancelledAfter),
    });
  return events;
}

async function loadProducts(prisma: PrismaClient, now: Date) {
  const slugs = ORDER_PLANS.flatMap((order) =>
    order.subOrders.flatMap((sub) => sub.items.map((item) => item.slug)),
  );
  const rows = await prisma.product.findMany({
    where: { slug: { in: slugs } },
    include: {
      vendor: { select: { id: true, slug: true, pickup: { select: { city: true } } } },
      category: {
        select: {
          defaultHsn: true,
          returnWindowDays: true,
          parent: { select: { slug: true } },
          slug: true,
        },
      },
      deals: {
        where: { startsAt: { lte: now }, endsAt: { gt: now } },
        orderBy: { dealPricePaise: 'asc' },
        take: 1,
      },
    },
  });
  return new Map(rows.map((row) => [row.slug, row]));
}

async function seedOrdersFor(
  prisma: PrismaClient,
  user: { id: string; fullName: string; mobile: string },
  products: Awaited<ReturnType<typeof loadProducts>>,
  firstSequence: number,
  now: Date,
): Promise<number> {
  const address = {
    name: user.fullName,
    mobile: user.mobile,
    line1: '12, 3rd Cross, Residency Road',
    line2: 'Ashok Nagar',
    landmark: 'Opposite Garuda Mall',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
  };

  let sequence = firstSequence;
  for (const plan of ORDER_PLANS) {
    const placedAt = new Date(now.getTime() - plan.placedDaysAgo * DAY);
    const orderNumber = formatOrderNumber(placedAt, sequence++);

    const subOrders = plan.subOrders.map((subPlan, index) => {
      const items = subPlan.items.map((ref) => {
        const product = products.get(ref.slug);
        if (!product)
          throw new Error(`Run the home page seed first: product ${ref.slug} is missing`);
        const rootSlug = product.category.parent?.slug ?? product.category.slug;
        const unitPricePaise = Math.min(
          product.pricePaise,
          product.deals[0]?.dealPricePaise ?? product.pricePaise,
        );
        return {
          product,
          quantity: ref.quantity,
          unitPricePaise,
          gstRateBps: GST_BY_ROOT[rootSlug] ?? 1800,
        };
      });
      const itemsTotalPaise = items.reduce(
        (sum, item) => sum + item.unitPricePaise * item.quantity,
        0,
      );
      const taxPaise = items.reduce(
        (sum, item) =>
          sum + splitGst(item.unitPricePaise * item.quantity, item.gstRateBps).gstPaise,
        0,
      );
      return {
        plan: subPlan,
        number: `${orderNumber}-${index + 1}`,
        items,
        itemsTotalPaise,
        taxPaise,
      };
    });

    const itemsTotalPaise = subOrders.reduce((sum, sub) => sum + sub.itemsTotalPaise, 0);
    const mrpTotalPaise = subOrders.reduce(
      (sum, sub) =>
        sum + sub.items.reduce((s, item) => s + item.product.mrpPaise * item.quantity, 0),
      0,
    );
    const deliveryPaise = itemsTotalPaise >= FREE_DELIVERY_FROM_PAISE ? 0 : DELIVERY_FEE_PAISE;
    const taxPaise = subOrders.reduce((sum, sub) => sum + sub.taxPaise, 0);
    const allCancelled = plan.subOrders.every((sub) => sub.status === SubOrderStatus.CANCELLED);
    const paymentStatus =
      plan.paymentMethod === PaymentMethod.COD
        ? PaymentStatus.PENDING
        : allCancelled
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PAID;

    await prisma.order.create({
      data: {
        orderNumber,
        userId: user.id,
        paymentMethod: plan.paymentMethod,
        paymentStatus,
        paymentReference:
          plan.paymentMethod === PaymentMethod.COD ? null : `pay_${orderNumber.toLowerCase()}`,
        mrpTotalPaise,
        itemsTotalPaise,
        deliveryPaise,
        taxPaise,
        totalPaise: itemsTotalPaise + deliveryPaise,
        shippingAddress: address,
        placedAt,
        subOrders: {
          create: subOrders.map((sub, index) => {
            const p = sub.plan;
            const at = (hours?: number) =>
              hours === undefined ? null : new Date(placedAt.getTime() + hours * HOUR);
            const subDelivery = index === 0 ? deliveryPaise : 0;
            const total = sub.itemsTotalPaise + subDelivery;
            const shippedAt = at(p.shippedAfter);
            const deliveredAt = at(p.deliveredAfter);
            const cancelledAt = at(p.cancelledAfter);
            const firstItem = sub.items[0].product;
            const returnDays = firstItem.category.returnWindowDays;
            const courier = p.courier ? COURIERS[p.courier] : null;
            const refunded = Boolean(cancelledAt) && plan.paymentMethod !== PaymentMethod.COD;
            return {
              vendorId: firstItem.vendor.id,
              subOrderNumber: sub.number,
              status: p.status,
              itemsTotalPaise: sub.itemsTotalPaise,
              deliveryPaise: subDelivery,
              taxPaise: sub.taxPaise,
              totalPaise: total,
              courierName: shippedAt && courier ? courier.name : null,
              awb: shippedAt && courier ? `${courier.code}${sub.number.replace(/\D/g, '')}` : null,
              expectedDeliveryAt: new Date(placedAt.getTime() + p.expectedAfterDays * DAY),
              shippedAt,
              deliveredAt,
              returnWindowEndsAt: deliveredAt
                ? new Date(deliveredAt.getTime() + returnDays * DAY)
                : null,
              cancelledAt,
              cancelledBy: cancelledAt ? 'CUSTOMER' : null,
              cancelReason: cancelledAt ? 'Found a better price' : null,
              invoiceNumber: shippedAt
                ? `INV/${financialYear(shippedAt)}/${sub.number.slice(2)}`
                : null,
              invoicedAt: shippedAt,
              refundStatus: refunded ? RefundStatus.PROCESSED : RefundStatus.NONE,
              refundPaise: refunded ? total : 0,
              refundReference: refunded
                ? `rfnd_${sub.number.toLowerCase().replace(/-/g, '')}`
                : null,
              refundedAt:
                refunded && cancelledAt ? new Date(cancelledAt.getTime() + 2 * DAY) : null,
              items: {
                create: sub.items.map((item) => ({
                  productId: item.product.id,
                  productSlug: item.product.slug,
                  productName: item.product.name,
                  brand: item.product.brand,
                  imageUrl: item.product.imageUrl,
                  hsnCode: item.product.hsnCode ?? item.product.category.defaultHsn,
                  gstRateBps: item.gstRateBps,
                  quantity: item.quantity,
                  unitPricePaise: item.unitPricePaise,
                  unitMrpPaise: item.product.mrpPaise,
                })),
              },
              events: {
                create: shipmentEvents(
                  p,
                  placedAt,
                  firstItem.vendor.pickup?.city ?? 'Seller warehouse',
                  address.city,
                ),
              },
            } satisfies Prisma.SubOrderUncheckedCreateWithoutOrderInput;
          }),
        },
      },
    });
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet) {
    const entries = [
      {
        source: WalletEntrySource.REFERRAL,
        amountPaise: 10_000,
        coins: 0,
        description: 'Referral bonus',
      },
      {
        source: WalletEntrySource.CASHBACK,
        amountPaise: 25_000,
        coins: 120,
        description: 'Cashback and coins on your order',
      },
    ];
    let balance = 0;
    let coins = 0;
    await prisma.wallet.create({ data: { userId: user.id } });
    for (const [index, entry] of entries.entries()) {
      balance += entry.amountPaise;
      coins += entry.coins;
      await prisma.walletEntry.create({
        data: {
          userId: user.id,
          type: WalletEntryType.CREDIT,
          ...entry,
          balanceAfterPaise: balance,
          createdAt: new Date(now.getTime() - (10 - index * 5) * DAY),
        },
      });
    }
    await prisma.wallet.update({
      where: { userId: user.id },
      data: { balancePaise: balance, coins },
    });
  }

  return sequence;
}

export async function seedAccountDemo(
  prisma: PrismaClient,
  now = new Date(),
): Promise<{ accounts: number }> {
  for (const [slug, gstin] of Object.entries(SELLER_GSTINS)) {
    await prisma.vendor.updateMany({ where: { slug, gstin: null }, data: { gstin } });
  }

  const email = process.env.SEED_ACCOUNT_EMAIL?.trim().toLowerCase();
  const users = await prisma.user.findMany({
    where: {
      role: UserRole.CUSTOMER,
      deletedAt: null,
      orders: { none: {} },
      ...(email ? { email } : {}),
    },
    select: { id: true, fullName: true, mobile: true },
    take: 50,
  });
  if (users.length === 0) return { accounts: 0 };

  const products = await loadProducts(prisma, now);
  let sequence = (await prisma.order.count()) + 101;
  for (const user of users) {
    sequence = await seedOrdersFor(prisma, user, products, sequence, now);
  }
  return { accounts: users.length };
}
