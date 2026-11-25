import { Injectable } from '@nestjs/common';
import {
  KycStatus,
  Prisma,
  ProductStatus,
  ReportStatus,
  ReportTarget,
  ReviewStatus,
  SubOrderStatus,
  TicketStatus,
  UserRole,
  VendorStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { addDays, DateRangeQuery, istDayStart, istToday, resolveRange } from '../shared';

interface DayRow {
  day: string;
  own: boolean;
  gmv: bigint;
  orders: number;
}

interface TopRow {
  id: string;
  name: string;
  gmv: bigint;
  units: bigint;
}

/** Admin home (5.1): platform health at a glance. Amounts are in paise. */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(query: DateRangeQuery) {
    const range = resolveRange(query);
    const today = istToday();
    const todayStart = istDayStart(today);
    const monthStart = istDayStart(`${today.slice(0, 7)}-01`);
    const tomorrow = istDayStart(addDays(today, 1));

    const [todayKpi, monthKpi, rangeKpi, newCustomers, activeVendors, alerts, series, top] =
      await Promise.all([
        this.gmv(todayStart, tomorrow),
        this.gmv(monthStart, tomorrow),
        this.gmv(range.start, range.end),
        this.prisma.user.count({
          where: {
            role: UserRole.CUSTOMER,
            createdAt: { gte: range.start, lt: range.end },
            deletedAt: null,
          },
        }),
        this.prisma.vendor.count({ where: { status: VendorStatus.ACTIVE, deletedAt: null } }),
        this.alerts(),
        this.series(range.start, range.end, range.from, range.days),
        this.top(range.start, range.end),
      ]);

    return {
      range: { from: range.from, to: range.to },
      kpis: {
        gmvTodayPaise: todayKpi.gmv,
        gmvMonthPaise: monthKpi.gmv,
        gmvPaise: rangeKpi.gmv,
        orders: rangeKpi.orders,
        ordersToday: todayKpi.orders,
        newCustomers,
        activeVendors,
        averageOrderValuePaise: rangeKpi.orders ? Math.round(rangeKpi.gmv / rangeKpi.orders) : 0,
      },
      alerts,
      series,
      top,
    };
  }

  private async gmv(start: Date, end: Date) {
    const rows = await this.prisma.$queryRaw<Array<{ gmv: bigint | null; orders: number }>>`
      SELECT COALESCE(SUM(s.total_paise), 0)::bigint AS gmv, COUNT(DISTINCT o.id)::int AS orders
      FROM sub_orders s JOIN orders o ON o.id = s.order_id
      WHERE o.placed_at >= ${start} AND o.placed_at < ${end} AND s.status <> 'CANCELLED'`;
    return { gmv: Number(rows[0]?.gmv ?? 0), orders: rows[0]?.orders ?? 0 };
  }

  private async alerts() {
    const stale = new Date(Date.now() - 48 * 3_600_000);
    const [pendingKyc, productsAwaiting, reviewsHeld, reportsOpen, escalations] = await Promise.all(
      [
        this.prisma.vendorKyc.count({ where: { status: KycStatus.SUBMITTED } }),
        this.prisma.product.count({
          where: { status: ProductStatus.PENDING_APPROVAL, deletedAt: null },
        }),
        this.prisma.review.count({ where: { status: ReviewStatus.UNDER_MODERATION } }),
        this.prisma.contentReport.count({ where: { status: ReportStatus.OPEN } }),
        this.prisma.supportTicket.count({
          where: {
            status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
            createdAt: { lt: stale },
          },
        }),
      ],
    );
    const reportedReviews = await this.prisma.contentReport.count({
      where: { status: ReportStatus.OPEN, targetType: ReportTarget.REVIEW },
    });
    return {
      pendingKyc,
      productsAwaitingApproval: productsAwaiting,
      reportedReviews: reviewsHeld + reportedReviews,
      openReports: reportsOpen,
      /** Payouts arrive with the Finance panel (Phase 2); null means "not tracked yet". */
      failedPayouts: null as number | null,
      openEscalations: escalations,
    };
  }

  /** GMV and orders per day, split into Trustlon's own brand and third-party sellers. */
  private async series(start: Date, end: Date, from: string, days: number) {
    const rows = await this.prisma.$queryRaw<DayRow[]>`
      SELECT to_char(((o.placed_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day,
             v.is_platform_owned AS own,
             SUM(s.total_paise)::bigint AS gmv,
             COUNT(DISTINCT o.id)::int AS orders
      FROM sub_orders s
      JOIN orders o ON o.id = s.order_id
      JOIN vendors v ON v.id = s.vendor_id
      WHERE o.placed_at >= ${start} AND o.placed_at < ${end} AND s.status <> 'CANCELLED'
      GROUP BY 1, 2`;
    const orderRows = await this.prisma.$queryRaw<Array<{ day: string; orders: number }>>`
      SELECT to_char(((o.placed_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day,
             COUNT(DISTINCT o.id)::int AS orders
      FROM orders o
      WHERE o.placed_at >= ${start} AND o.placed_at < ${end}
        AND EXISTS (SELECT 1 FROM sub_orders s WHERE s.order_id = o.id AND s.status <> 'CANCELLED')
      GROUP BY 1`;
    const byDay = new Map<string, { ownPaise: number; thirdPartyPaise: number; orders: number }>();
    for (let i = 0; i < days; i += 1)
      byDay.set(addDays(from, i), { ownPaise: 0, thirdPartyPaise: 0, orders: 0 });
    for (const row of rows) {
      const entry = byDay.get(row.day);
      if (!entry) continue;
      if (row.own) entry.ownPaise += Number(row.gmv);
      else entry.thirdPartyPaise += Number(row.gmv);
    }
    for (const row of orderRows) {
      const entry = byDay.get(row.day);
      if (entry) entry.orders = row.orders;
    }
    return [...byDay.entries()].map(([day, value]) => ({ day, ...value }));
  }

  private async top(start: Date, end: Date) {
    const where = Prisma.sql`o.placed_at >= ${start} AND o.placed_at < ${end} AND s.status <> 'CANCELLED'`;
    const [products, vendors, categories] = await Promise.all([
      this.prisma.$queryRaw<TopRow[]>`
        SELECT COALESCE(i.product_id::text, i.product_slug) AS id, MAX(i.product_name) AS name,
               SUM(i.unit_price_paise * i.quantity)::bigint AS gmv, SUM(i.quantity)::bigint AS units
        FROM order_items i JOIN sub_orders s ON s.id = i.sub_order_id JOIN orders o ON o.id = s.order_id
        WHERE ${where}
        GROUP BY 1 ORDER BY gmv DESC LIMIT 5`,
      this.prisma.$queryRaw<TopRow[]>`
        SELECT v.id::text AS id, v.display_name AS name, SUM(s.total_paise)::bigint AS gmv, COUNT(*)::bigint AS units
        FROM sub_orders s JOIN orders o ON o.id = s.order_id JOIN vendors v ON v.id = s.vendor_id
        WHERE ${where}
        GROUP BY v.id, v.display_name ORDER BY gmv DESC LIMIT 5`,
      this.prisma.$queryRaw<TopRow[]>`
        SELECT c.id::text AS id, c.name AS name, SUM(i.unit_price_paise * i.quantity)::bigint AS gmv, SUM(i.quantity)::bigint AS units
        FROM order_items i JOIN sub_orders s ON s.id = i.sub_order_id JOIN orders o ON o.id = s.order_id
        JOIN products p ON p.id = i.product_id JOIN categories c ON c.id = p.category_id
        WHERE ${where}
        GROUP BY c.id, c.name ORDER BY gmv DESC LIMIT 5`,
    ]);
    const view = (rows: TopRow[]) =>
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        gmvPaise: Number(row.gmv),
        units: Number(row.units),
      }));
    return { products: view(products), vendors: view(vendors), categories: view(categories) };
  }
}
