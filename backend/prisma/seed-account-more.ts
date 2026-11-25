/**
 * Development seed for wallet history, reviews, affiliate earnings and support (spec 3.6 to 3.10).
 * Runs after the other account seeds, only for customers who have no support tickets yet, so it is
 * safe to run again. Never run against production.
 */
import {
  AffiliateEarningStatus,
  PrismaClient,
  ReviewStatus,
  SubOrderStatus,
  TicketAuthor,
  TicketCategory,
  TicketStatus,
  UserRole,
  WalletEntrySource,
  WalletEntryType,
} from '@prisma/client';
import { randomInt } from 'crypto';

const DAY = 24 * 60 * 60 * 1000;

export async function seedAccountMore(
  prisma: PrismaClient,
  now = new Date(),
): Promise<{ accounts: number }> {
  const email = process.env.SEED_ACCOUNT_EMAIL?.trim().toLowerCase();
  const users = await prisma.user.findMany({
    where: {
      role: UserRole.CUSTOMER,
      deletedAt: null,
      supportTickets: { none: {} },
      orders: { some: {} },
      ...(email ? { email } : {}),
    },
    select: { id: true, fullName: true },
    take: 50,
  });

  for (const user of users) {
    await seedWallet(prisma, user.id, now);
    await seedReview(prisma, user.id, now);
    await seedAffiliate(prisma, user.id, now);
    await seedTicket(prisma, user.id, user.fullName, now);
  }
  return { accounts: users.length };
}

/** Coins that expire soon, and one wallet spend, so every row type shows on the wallet page. */
async function seedWallet(prisma: PrismaClient, userId: string, now: Date): Promise<void> {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) return;
  const coins = 40;
  const spend = Math.min(10_000, wallet.balancePaise);
  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({ where: { userId }, data: { coins: { increment: coins } } });
    await tx.walletEntry.create({
      data: {
        userId,
        type: WalletEntryType.CREDIT,
        source: WalletEntrySource.CASHBACK,
        amountPaise: 0,
        coins,
        balanceAfterPaise: wallet.balancePaise,
        description: 'Festive bonus coins',
        coinsExpireAt: new Date(now.getTime() + 20 * DAY),
        createdAt: new Date(now.getTime() - 345 * DAY),
      },
    });
    if (spend > 0) {
      const updated = await tx.wallet.update({
        where: { userId },
        data: { balancePaise: { decrement: spend } },
      });
      await tx.walletEntry.create({
        data: {
          userId,
          type: WalletEntryType.DEBIT,
          source: WalletEntrySource.ORDER_PAYMENT,
          amountPaise: spend,
          balanceAfterPaise: updated.balancePaise,
          description: 'Used at checkout',
          createdAt: new Date(now.getTime() - 2 * DAY),
        },
      });
    }
  });
}

/** A published review for the oldest delivered item, so "My reviews" is not empty. */
async function seedReview(prisma: PrismaClient, userId: string, now: Date): Promise<void> {
  const item = await prisma.orderItem.findFirst({
    where: {
      review: { is: null },
      productId: { not: null },
      subOrder: { status: SubOrderStatus.DELIVERED, order: { userId } },
    },
    orderBy: { subOrder: { deliveredAt: 'asc' } },
  });
  if (!item?.productId) return;
  const product = await prisma.product.findUnique({
    where: { id: item.productId },
    select: { ratingAvg: true, ratingCount: true },
  });
  if (!product) return;
  const rating = 5;
  const count = product.ratingCount + 1;
  await prisma.$transaction([
    prisma.review.create({
      data: {
        userId,
        productId: item.productId,
        orderItemId: item.id,
        rating,
        title: 'Does everything I need',
        body: 'Battery easily lasts four days and the step count matches my phone. The strap is comfortable for all-day wear.',
        status: ReviewStatus.PUBLISHED,
        countedRating: rating,
        publishedAt: new Date(now.getTime() - 15 * DAY),
        createdAt: new Date(now.getTime() - 15 * DAY),
      },
    }),
    prisma.product.update({
      where: { id: item.productId },
      data: {
        ratingCount: count,
        ratingAvg:
          Math.round(((product.ratingAvg * product.ratingCount + rating) / count) * 100) / 100,
      },
    }),
  ]);
}

async function seedAffiliate(prisma: PrismaClient, userId: string, now: Date): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { slug: 'trustlon-home-accent-chair' },
    select: { id: true, name: true, pricePaise: true },
  });
  if (!product) return;
  const link = await prisma.affiliateLink.upsert({
    where: { userId_productId: { userId, productId: product.id } },
    create: {
      userId,
      productId: product.id,
      code: `demo${userId.replace(/-/g, '').slice(0, 6)}`,
      clicks: 37,
    },
    update: {},
  });
  const commission = Math.round(product.pricePaise * 0.05);
  await prisma.affiliateEarning.createMany({
    data: [
      {
        userId,
        linkId: link.id,
        orderNumber: 'TL2610004711',
        productName: product.name,
        saleAmountPaise: product.pricePaise,
        commissionPaise: commission,
        status: AffiliateEarningStatus.PENDING,
        confirmAfter: new Date(now.getTime() - 1 * DAY),
        createdAt: new Date(now.getTime() - 12 * DAY),
      },
      {
        userId,
        linkId: link.id,
        orderNumber: 'TL2611000958',
        productName: product.name,
        saleAmountPaise: product.pricePaise,
        commissionPaise: commission,
        status: AffiliateEarningStatus.PENDING,
        confirmAfter: new Date(now.getTime() + 6 * DAY),
        createdAt: new Date(now.getTime() - 3 * DAY),
      },
    ],
  });
}

/** A delivery question that an agent has answered and is waiting on the customer. */
async function seedTicket(
  prisma: PrismaClient,
  userId: string,
  fullName: string,
  now: Date,
): Promise<void> {
  const order = await prisma.order.findFirst({
    where: { userId, subOrders: { some: { status: SubOrderStatus.OUT_FOR_DELIVERY } } },
    select: { id: true },
  });
  const opened = new Date(now.getTime() - 20 * 60 * 60 * 1000);
  const answered = new Date(opened.getTime() + 3 * 60 * 60 * 1000);
  const suffix = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await prisma.supportTicket.create({
    data: {
      ticketNumber: `ST${String(now.getUTCFullYear()).slice(2)}${String(now.getUTCMonth() + 1).padStart(2, '0')}${suffix}`,
      userId,
      category: TicketCategory.DELIVERY,
      subject: 'Can my sneakers arrive before Saturday?',
      orderId: order?.id ?? null,
      status: TicketStatus.AWAITING_CUSTOMER,
      lastMessageAt: answered,
      createdAt: opened,
      messages: {
        create: [
          {
            authorType: TicketAuthor.CUSTOMER,
            authorName: fullName,
            body: 'Hi, I am travelling on Saturday morning. Is there any way the sneakers can be delivered before that?',
            createdAt: opened,
          },
          {
            authorType: TicketAuthor.SYSTEM,
            authorName: 'Trustlon Support',
            body: 'Thanks for writing to us. Our support team will reply here, and we will let you know when they do.',
            createdAt: new Date(opened.getTime() + 1000),
          },
          {
            authorType: TicketAuthor.AGENT,
            authorName: 'Priya from Trustlon Support',
            body: 'Good news: the parcel is already out for delivery in Bengaluru and should reach you today. If you will not be home, reply here and we will ask the courier to call you first.',
            createdAt: answered,
          },
        ],
      },
    },
  });
}
