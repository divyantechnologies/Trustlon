import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderSummary } from '../orders/order.presenter';
import { OrdersService } from '../orders/orders.service';
import { WalletBalance, WalletService } from '../wallet/wallet.service';

export interface AccountSummary {
  profile: {
    fullName: string;
    mobile: string;
    email: string;
    mobileVerified: boolean;
    emailVerified: boolean;
    memberSince: Date;
  };
  prime: { active: boolean; plan: string | null; endsAt: Date | null };
  wallet: WalletBalance;
  recentOrders: OrderSummary[];
  counts: { orders: number; activeOrders: number; wishlist: number };
}

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly wallet: WalletService,
  ) {}

  async summary(userId: string): Promise<AccountSummary> {
    const now = new Date();
    const [user, prime, wallet, recentOrders, orderCounts, wishlist] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: {
          fullName: true,
          mobile: true,
          email: true,
          mobileVerifiedAt: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.primeMembership.findUnique({ where: { userId } }),
      this.wallet.balance(userId),
      this.orders.recent(userId, 3),
      this.orders.count(userId),
      this.prisma.wishlistItem.count({ where: { userId } }),
    ]);
    if (!user) throw new NotFoundException('Account not found');

    const primeActive = Boolean(prime && !prime.cancelledAt && prime.endsAt > now);
    return {
      profile: {
        fullName: user.fullName,
        mobile: user.mobile,
        email: user.email,
        mobileVerified: Boolean(user.mobileVerifiedAt),
        emailVerified: Boolean(user.emailVerifiedAt),
        memberSince: user.createdAt,
      },
      prime: {
        active: primeActive,
        plan: primeActive ? prime!.plan : null,
        endsAt: primeActive ? prime!.endsAt : null,
      },
      wallet,
      recentOrders,
      counts: { orders: orderCounts.total, activeOrders: orderCounts.active, wishlist },
    };
  }
}
