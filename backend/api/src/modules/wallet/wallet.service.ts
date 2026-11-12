import { Injectable } from '@nestjs/common';
import { Prisma, WalletEntrySource, WalletEntryType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface WalletBalance {
  balancePaise: number;
  coins: number;
}

export interface WalletCredit {
  amountPaise: number;
  coins?: number;
  source: WalletEntrySource;
  description: string;
  reference?: string;
}

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async balance(userId: string): Promise<WalletBalance> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: { balancePaise: true, coins: true },
    });
    return wallet ?? { balancePaise: 0, coins: 0 };
  }

  /** Adds money or coins and records the entry. Pass the transaction the change belongs to. */
  async credit(tx: Prisma.TransactionClient, userId: string, credit: WalletCredit) {
    const coins = credit.coins ?? 0;
    const wallet = await tx.wallet.upsert({
      where: { userId },
      create: { userId, balancePaise: credit.amountPaise, coins },
      update: { balancePaise: { increment: credit.amountPaise }, coins: { increment: coins } },
    });
    return tx.walletEntry.create({
      data: {
        userId,
        type: WalletEntryType.CREDIT,
        source: credit.source,
        amountPaise: credit.amountPaise,
        coins,
        balanceAfterPaise: wallet.balancePaise,
        description: credit.description,
        reference: credit.reference,
      },
    });
  }
}
