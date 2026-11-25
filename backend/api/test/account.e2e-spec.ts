import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PaymentMethod } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { seedAccountDemo } from '../prisma/seed-account';
import { seedHomepage } from '../prisma/seed';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

const PASSWORD = 'Trustlon123';

interface SubOrderBody {
  id: string;
  status: string;
  seller: { slug: string };
  shipment: { awb: string | null };
  invoice: { number: string } | null;
  refund: { status: string; amountPaise: number } | null;
  actions: { canCancel: boolean; returnEligibleUntil: string | null };
}

describe('My Account and orders APIs (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let token: string;
  let otherToken: string;
  const http = () => request(app.getHttpServer());
  const auth = (accessToken = token) => ({ Authorization: `Bearer ${accessToken}` });

  const createCustomer = async (email: string, mobile: string, referralCode: string) =>
    prisma.user.create({
      data: {
        fullName: 'Asha Rao',
        email,
        mobile,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        passwordChangedAt: new Date(),
        referralCode,
        termsAcceptedAt: new Date(),
        emailVerifiedAt: new Date(),
        mobileVerifiedAt: new Date(),
      },
    });

  const login = async (identifier: string) => {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ identifier, password: PASSWORD })
      .expect(200);
    return res.body.accessToken as string;
  };

  const orders = async (query = '') =>
    (await http().get(`/api/v1/orders${query}`).set(auth()).expect(200)).body;

  const findSubOrder = async (sellerSlug: string) => {
    const list = await orders('?pageSize=48');
    for (const summary of list.items as Array<{ id: string }>) {
      const detail = await http().get(`/api/v1/orders/${summary.id}`).set(auth()).expect(200);
      const match = (detail.body.subOrders as SubOrderBody[]).find(
        (sub) => sub.seller.slug === sellerSlug,
      );
      if (match) return { orderId: summary.id, subOrder: match };
    }
    throw new Error(`No sub-order for ${sellerSlug}`);
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE shipment_events, order_items, sub_orders, orders, wallet_entries, wallets, prime_memberships, cart_items, carts, wishlist_items, recently_viewed, deals, banners, home_sections, products, categories, vendors, pincodes, sessions, otp_challenges, users CASCADE',
    );
    await seedHomepage(prisma);
    await createCustomer('asha@example.com', '+919800000001', 'TLACC00001');
    await seedAccountDemo(prisma);
    await createCustomer('other@example.com', '+919800000002', 'TLACC00002');

    token = await login('asha@example.com');
    otherToken = await login('other@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires sign-in', async () => {
    await http().get('/api/v1/me/summary').expect(401);
    await http().get('/api/v1/orders').expect(401);
  });

  it('returns the account overview in one call', async () => {
    const res = await http().get('/api/v1/me/summary').set(auth()).expect(200);
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.body.profile).toMatchObject({
      fullName: 'Asha Rao',
      email: 'asha@example.com',
      emailVerified: true,
    });
    expect(res.body.wallet).toEqual({ balancePaise: 35_000, coins: 120 });
    expect(res.body.prime).toEqual({ active: false, plan: null, endsAt: null });
    expect(res.body.counts).toEqual({ orders: 5, activeOrders: 2, wishlist: 0 });
    expect(res.body.recentOrders).toHaveLength(3);
    expect(res.body.recentOrders[0].stage).toBe('in_progress');
  });

  it('lists orders newest first and filters by status, product and date', async () => {
    const all = await orders();
    expect(all.total).toBe(5);
    const placed = all.items.map((order: { placedAt: string }) =>
      new Date(order.placedAt).getTime(),
    );
    expect(placed).toEqual([...placed].sort((a, b) => b - a));

    expect((await orders('?status=active')).total).toBe(2);
    expect((await orders('?status=delivered')).total).toBe(2);
    expect((await orders('?status=cancelled')).total).toBe(1);
    expect((await orders('?q=COFFEE')).total).toBe(1);

    const istDay = (iso: string) =>
      new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const latest = all.items[0] as { id: string; placedAt: string };
    const day = istDay(latest.placedAt);
    const sameDay = await orders(`?from=${day}&to=${day}`);
    expect(sameDay.items.map((order: { id: string }) => order.id)).toContain(latest.id);
    expect(
      sameDay.items.every((order: { placedAt: string }) => istDay(order.placedAt) === day),
    ).toBe(true);

    await http().get('/api/v1/orders?status=shipped').set(auth()).expect(400);
    await http().get('/api/v1/orders?from=2026-12-01&to=2026-11-01').set(auth()).expect(400);
  });

  it('shows the full order detail and hides other customers’ orders', async () => {
    const { orderId, subOrder } = await findSubOrder('soundspace');
    const res = await http().get(`/api/v1/orders/${orderId}`).set(auth()).expect(200);
    expect(res.body.subOrders).toHaveLength(2);
    expect(res.body.breakup).toMatchObject({ totalPaise: 529_700, deliveryPaise: 0 });
    expect(res.body.breakup.productDiscountPaise).toBeGreaterThan(0);
    expect(res.body.shippingAddress).toMatchObject({ city: 'Bengaluru', pincode: '560001' });
    expect(subOrder.status).toBe('DELIVERED');
    expect(subOrder.actions.canCancel).toBe(false);
    expect(subOrder.actions.returnEligibleUntil).not.toBeNull();

    await http().get(`/api/v1/orders/${orderId}`).set(auth(otherToken)).expect(404);
    await http().get('/api/v1/orders/not-a-uuid').set(auth()).expect(400);
  });

  it('cancels a packed COD item, restocks it and refunds nothing', async () => {
    const { subOrder } = await findSubOrder('pure-and-kind');
    expect(subOrder).toMatchObject({ status: 'PACKED', actions: { canCancel: true } });
    const before = await prisma.product.findUniqueOrThrow({
      where: { slug: 'daily-glow-skincare-essentials' },
    });

    const res = await http()
      .post(`/api/v1/sub-orders/${subOrder.id}/cancel`)
      .set(auth())
      .send({ reason: 'CHANGED_MIND', comment: 'Bought it in store' })
      .expect(200);
    const cancelled = (res.body.subOrders as SubOrderBody[]).find((sub) => sub.id === subOrder.id)!;
    expect(cancelled).toMatchObject({
      status: 'CANCELLED',
      refund: null,
      actions: { canCancel: false },
    });
    expect(res.body.payment.status).toBe('PENDING');

    const after = await prisma.product.findUniqueOrThrow({
      where: { slug: 'daily-glow-skincare-essentials' },
    });
    expect(after.stock).toBe(before.stock + 2);

    await http()
      .post(`/api/v1/sub-orders/${subOrder.id}/cancel`)
      .set(auth())
      .send({ reason: 'CHANGED_MIND' })
      .expect(409);
  });

  it('refuses to cancel an item that has shipped', async () => {
    const { subOrder } = await findSubOrder('urban-thread');
    expect(subOrder.status).toBe('OUT_FOR_DELIVERY');
    await http()
      .post(`/api/v1/sub-orders/${subOrder.id}/cancel`)
      .set(auth())
      .send({ reason: 'CHANGED_MIND' })
      .expect(409);
  });

  it('validates the cancel reason and ownership', async () => {
    const { subOrder } = await findSubOrder('the-daily-pantry');
    await http()
      .post(`/api/v1/sub-orders/${subOrder.id}/cancel`)
      .set(auth())
      .send({ reason: 'NOPE' })
      .expect(400);
    await http()
      .post(`/api/v1/sub-orders/${subOrder.id}/cancel`)
      .set(auth(otherToken))
      .send({ reason: 'CHANGED_MIND' })
      .expect(404);
  });

  it('refunds a wallet-paid cancellation to the wallet straight away', async () => {
    const { orderId, subOrder } = await findSubOrder('the-daily-pantry');
    await prisma.order.update({
      where: { id: orderId },
      data: { paymentMethod: PaymentMethod.WALLET },
    });

    const res = await http()
      .post(`/api/v1/sub-orders/${subOrder.id}/cancel`)
      .set(auth())
      .send({ reason: 'ORDERED_BY_MISTAKE' })
      .expect(200);
    expect(res.body.subOrders[0].refund).toMatchObject({
      status: 'PROCESSED',
      amountPaise: 89_800,
    });
    expect(res.body.payment.status).toBe('REFUNDED');
    expect(res.body.breakup.refundStatus).toBe('PROCESSED');

    const summary = await http().get('/api/v1/me/summary').set(auth()).expect(200);
    expect(summary.body.wallet.balancePaise).toBe(35_000 + 89_800);
    const entry = await prisma.walletEntry.findFirstOrThrow({ where: { source: 'REFUND' } });
    expect(entry.balanceAfterPaise).toBe(35_000 + 89_800);
  });

  it('downloads the tax invoice once an item has shipped', async () => {
    const { subOrder } = await findSubOrder('trustlon');
    expect(subOrder.invoice?.number).toMatch(/^INV\//);
    const res = await http()
      .get(`/api/v1/invoices/${subOrder.id}/pdf`)
      .set(auth())
      .responseType('blob')
      .expect(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment; filename="Trustlon-Invoice-');
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

    const { subOrder: notShipped } = await findSubOrder('the-living-room');
    await http().get(`/api/v1/invoices/${notShipped.id}/pdf`).set(auth()).expect(404);
    await http().get(`/api/v1/invoices/${subOrder.id}/pdf`).set(auth(otherToken)).expect(404);
  });

  it('returns the tracking timeline for the customer’s own shipment', async () => {
    const { subOrder } = await findSubOrder('urban-thread');
    const awb = subOrder.shipment.awb!;
    const res = await http().get(`/api/v1/shipments/${awb}/tracking`).set(auth()).expect(200);
    expect(res.body).toMatchObject({ awb, courierName: 'Xpressbees', status: 'OUT_FOR_DELIVERY' });
    expect(res.body.events.map((event: { status: string }) => event.status)).toEqual([
      'PLACED',
      'CONFIRMED',
      'PACKED',
      'SHIPPED',
      'OUT_FOR_DELIVERY',
    ]);
    await http().get(`/api/v1/shipments/${awb}/tracking`).set(auth(otherToken)).expect(404);
  });

  it('does not add sample orders twice', async () => {
    const result = await seedAccountDemo(prisma);
    expect(result.accounts).toBe(1); // only the second customer, who had no orders
    expect(await prisma.order.count({ where: { user: { email: 'asha@example.com' } } })).toBe(5);
  });
});
