import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ReturnStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { seedAccountDemo } from '../prisma/seed-account';
import { seedHomepage } from '../prisma/seed';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { ReturnsService } from '../src/modules/returns/returns.service';
import { PrismaService } from '../src/prisma/prisma.service';

const PASSWORD = 'Trustlon123';
/** Smallest valid PNG (1 x 1 pixel). */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

const ADDRESS = {
  label: 'HOME',
  fullName: 'Asha Rao',
  mobile: '98000 00011',
  line1: '12, 3rd Cross, Residency Road',
  line2: 'Ashok Nagar',
  pincode: '560001',
  city: 'Bangalore',
  state: 'Karnataka',
};

describe('Returns, wishlist alerts and address book (e2e)', () => {
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

  const login = async (identifier: string) =>
    (await http().post('/api/v1/auth/login').send({ identifier, password: PASSWORD }).expect(200))
      .body.accessToken as string;

  /** A delivered sub-order of the given seller, from the seeded orders. */
  const deliveredSubOrder = async (vendorSlug: string) =>
    prisma.subOrder.findFirstOrThrow({
      where: {
        order: { user: { email: 'returns@example.com' } },
        vendor: { slug: vendorSlug },
        status: 'DELIVERED',
      },
      include: { items: true },
      orderBy: { deliveredAt: 'desc' },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE return_events, return_photos, return_items, return_requests, price_alerts, addresses, shipment_events, order_items, sub_orders, orders, wallet_entries, wallets, prime_memberships, cart_items, carts, wishlist_items, recently_viewed, deals, banners, home_sections, products, categories, vendors, pincodes, sessions, otp_challenges, users CASCADE',
    );
    await seedHomepage(prisma);
    await createCustomer('returns@example.com', '+919800000011', 'TLRET00001');
    await seedAccountDemo(prisma);
    await createCustomer('other2@example.com', '+919800000012', 'TLRET00002');
    token = await login('returns@example.com');
    otherToken = await login('other2@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('address book', () => {
    it('adds addresses, fills city from the pincode and keeps one default', async () => {
      const first = await http().post('/api/v1/me/addresses').set(auth()).send(ADDRESS).expect(201);
      expect(first.body.items).toHaveLength(1);
      expect(first.body.items[0]).toMatchObject({
        isDefault: true,
        city: 'Bengaluru',
        mobile: '+919800000011',
        delivery: { serviceable: true, codAvailable: true },
      });

      const second = await http()
        .post('/api/v1/me/addresses')
        .set(auth())
        .send({
          ...ADDRESS,
          label: 'OTHER',
          labelName: 'Parents',
          pincode: '110001',
          city: 'New Delhi',
          state: 'Delhi',
          isDefault: true,
        })
        .expect(201);
      expect(second.body.items[0]).toMatchObject({ labelName: 'Parents', isDefault: true });
      expect(second.body.items.filter((a: { isDefault: boolean }) => a.isDefault)).toHaveLength(1);

      const removed = await http()
        .delete(`/api/v1/me/addresses/${second.body.items[0].id}`)
        .set(auth())
        .expect(200);
      expect(removed.body.items).toHaveLength(1);
      expect(removed.body.items[0].isDefault).toBe(true);
    });

    it('validates input and hides other customers’ addresses', async () => {
      await http()
        .post('/api/v1/me/addresses')
        .set(auth())
        .send({ ...ADDRESS, mobile: '12345' })
        .expect(400);
      await http()
        .post('/api/v1/me/addresses')
        .set(auth())
        .send({ ...ADDRESS, pincode: '012345' })
        .expect(400);
      await http()
        .post('/api/v1/me/addresses')
        .set(auth())
        .send({ ...ADDRESS, state: 'Atlantis' })
        .expect(400);
      await http()
        .post('/api/v1/me/addresses')
        .set(auth())
        .send({ ...ADDRESS, label: 'OTHER' })
        .expect(400);

      const [mine] = (await http().get('/api/v1/me/addresses').set(auth()).expect(200)).body.items;
      await http()
        .put(`/api/v1/me/addresses/${mine.id}`)
        .set(auth(otherToken))
        .send(ADDRESS)
        .expect(404);
      await http().delete(`/api/v1/me/addresses/${mine.id}`).set(auth(otherToken)).expect(404);
    });
  });

  describe('price alerts', () => {
    it('creates, updates and removes an alert below today’s price', async () => {
      const product = await prisma.product.findUniqueOrThrow({
        where: { slug: 'trustlon-home-accent-chair' },
      });
      await http()
        .post('/api/v1/me/price-alerts')
        .set(auth())
        .send({ productId: product.id, targetPricePaise: product.pricePaise })
        .expect(400);

      const created = await http()
        .post('/api/v1/me/price-alerts')
        .set(auth())
        .send({ productId: product.id, targetPricePaise: 500_000 })
        .expect(201);
      expect(created.body.items).toHaveLength(1);
      expect(created.body.items[0]).toMatchObject({
        status: 'ACTIVE',
        reached: false,
        targetPricePaise: 500_000,
      });
      expect(created.body.items[0].product.slug).toBe('trustlon-home-accent-chair');

      const id = created.body.items[0].id;
      const paused = await http()
        .patch(`/api/v1/me/price-alerts/${id}`)
        .set(auth())
        .send({ status: 'PAUSED' })
        .expect(200);
      expect(paused.body.items[0].status).toBe('PAUSED');

      await http()
        .patch(`/api/v1/me/price-alerts/${id}`)
        .set(auth(otherToken))
        .send({ status: 'ACTIVE' })
        .expect(404);
      const removed = await http().delete(`/api/v1/me/price-alerts/${id}`).set(auth()).expect(200);
      expect(removed.body.items).toHaveLength(0);
    });
  });

  describe('returns', () => {
    let photoId: string;

    it('uploads a photo and rejects files that are not images', async () => {
      const res = await http()
        .post('/api/v1/returns/photos')
        .set(auth())
        .attach('photo', PNG, { filename: 'damage.png', contentType: 'image/png' })
        .expect(201);
      photoId = res.body.id;

      await http()
        .post('/api/v1/returns/photos')
        .set(auth())
        .attach('photo', Buffer.from('not an image'), {
          filename: 'fake.png',
          contentType: 'image/png',
        })
        .expect(400);

      const photo = await http().get(`/api/v1/returns/photos/${photoId}`).set(auth()).expect(200);
      expect(photo.headers['content-type']).toContain('image/png');
      await http().get(`/api/v1/returns/photos/${photoId}`).set(auth(otherToken)).expect(404);
    });

    it('explains eligibility and refund options for a delivered shipment', async () => {
      const subOrder = await deliveredSubOrder('trustlon');
      const res = await http()
        .get(`/api/v1/returns/eligibility/${subOrder.id}`)
        .set(auth())
        .expect(200);
      expect(res.body).toMatchObject({ eligible: true, reason: null, maxPhotos: 5 });
      expect(
        res.body.items.every((i: { returnableQuantity: number }) => i.returnableQuantity === 1),
      ).toBe(true);
      expect(res.body.refundMethods.map((m: { method: string }) => m.method)).toEqual([
        'ORIGINAL_PAYMENT',
        'WALLET',
      ]);

      const expired = await prisma.subOrder.findFirstOrThrow({
        where: {
          order: { user: { email: 'returns@example.com' } },
          returnWindowEndsAt: { lt: new Date() },
        },
      });
      const closed = await http()
        .get(`/api/v1/returns/eligibility/${expired.id}`)
        .set(auth())
        .expect(200);
      expect(closed.body).toMatchObject({
        eligible: false,
        reason: expect.stringContaining('window'),
      });
    });

    it('creates a return, blocks returning the same item twice and lets the customer cancel', async () => {
      const subOrder = await deliveredSubOrder('trustlon');
      const item = subOrder.items[0];
      const body = {
        subOrderId: subOrder.id,
        items: [{ orderItemId: item.id, quantity: 1 }],
        reason: 'DAMAGED',
        refundMethod: 'WALLET',
      };
      await http().post('/api/v1/returns').set(auth()).send(body).expect(400); // damaged needs a photo

      const created = await http()
        .post('/api/v1/returns')
        .set(auth())
        .send({ ...body, photoIds: [photoId], comments: 'The base is cracked' })
        .expect(201);
      expect(created.body).toMatchObject({
        status: 'REQUESTED',
        canCancel: true,
        refundAmountPaise: item.unitPricePaise,
        refund: { method: 'WALLET', destination: 'your Trustlon wallet' },
      });
      expect(created.body.photos).toHaveLength(1);
      expect(created.body.returnNumber).toMatch(/^RT\d{10}$/);

      const order = await http().get(`/api/v1/orders/${subOrder.orderId}`).set(auth()).expect(200);
      const sub = order.body.subOrders.find((s: { id: string }) => s.id === subOrder.id);
      expect(sub.status).toBe('RETURN_REQUESTED');
      expect(sub.returns).toHaveLength(1);

      await http()
        .post('/api/v1/returns')
        .set(auth())
        .send({ ...body, reason: 'SIZE_OR_FIT' })
        .expect(400);
      await http().get(`/api/v1/returns/${created.body.id}`).set(auth(otherToken)).expect(404);

      const cancelled = await http()
        .post(`/api/v1/returns/${created.body.id}/cancel`)
        .set(auth())
        .expect(200);
      expect(cancelled.body).toMatchObject({ status: 'CANCELLED', canCancel: false });
      const after = await prisma.subOrder.findUniqueOrThrow({ where: { id: subOrder.id } });
      expect(after.status).toBe('DELIVERED');
    });

    it('refunds to the wallet when the return completes', async () => {
      const subOrder = await deliveredSubOrder('soundspace');
      const item = subOrder.items[0];
      const created = await http()
        .post('/api/v1/returns')
        .set(auth())
        .send({
          subOrderId: subOrder.id,
          items: [{ orderItemId: item.id, quantity: item.quantity }],
          reason: 'NO_LONGER_NEEDED',
          refundMethod: 'WALLET',
        })
        .expect(201);

      const returns = app.get(ReturnsService);
      for (const status of [
        ReturnStatus.APPROVED,
        ReturnStatus.PICKED_UP,
        ReturnStatus.RECEIVED,
        ReturnStatus.REFUNDED,
      ]) {
        await returns.transition(created.body.id, status);
      }
      await http().post(`/api/v1/returns/${created.body.id}/cancel`).set(auth()).expect(409);

      const detail = await http().get(`/api/v1/returns/${created.body.id}`).set(auth()).expect(200);
      expect(detail.body.status).toBe('REFUNDED');
      expect(detail.body.events.map((e: { status: string }) => e.status)).toEqual([
        'REQUESTED',
        'APPROVED',
        'PICKED_UP',
        'RECEIVED',
        'REFUNDED',
      ]);

      const summary = await http().get('/api/v1/me/summary').set(auth()).expect(200);
      expect(summary.body.wallet.balancePaise).toBe(35_000 + item.unitPricePaise * item.quantity);
      expect((await prisma.subOrder.findUniqueOrThrow({ where: { id: subOrder.id } })).status).toBe(
        'RETURNED',
      );

      const list = await http().get('/api/v1/returns').set(auth()).expect(200);
      expect(list.body.total).toBe(2);
    });
  });
});
