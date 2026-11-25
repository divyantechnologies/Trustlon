import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AffiliateEarningStatus, TicketAuthor } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { seedAccountDemo } from '../prisma/seed-account';
import { seedHomepage } from '../prisma/seed';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { gstinCheckCharacter } from '../src/common/utils/gstin';
import { PrismaService } from '../src/prisma/prisma.service';

const PASSWORD = 'Trustlon123';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
const GSTIN_BASE = '29ABCDE1234F1Z';
const GSTIN = GSTIN_BASE + gstinCheckCharacter(GSTIN_BASE);

describe('Wallet, reviews, B2B, affiliate and support (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let token: string;
  let otherToken: string;
  let userId: string;
  const http = () => request(app.getHttpServer());
  const auth = (accessToken = token) => ({ Authorization: `Bearer ${accessToken}` });

  const createCustomer = async (
    email: string,
    mobile: string,
    referralCode: string,
    referredById?: string,
  ) =>
    prisma.user.create({
      data: {
        fullName: 'Asha Rao',
        email,
        mobile,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        passwordChangedAt: new Date(),
        referralCode,
        referredById,
        termsAcceptedAt: new Date(),
        emailVerifiedAt: new Date(),
        mobileVerifiedAt: new Date(),
      },
    });

  const login = async (identifier: string) =>
    (await http().post('/api/v1/auth/login').send({ identifier, password: PASSWORD }).expect(200))
      .body.accessToken as string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE ticket_attachments, ticket_messages, support_tickets, affiliate_earnings, affiliate_links, business_profiles, review_media, reviews, return_events, return_photos, return_items, return_requests, price_alerts, addresses, shipment_events, order_items, sub_orders, orders, wallet_entries, wallets, prime_memberships, cart_items, carts, wishlist_items, recently_viewed, deals, banners, home_sections, products, categories, vendors, pincodes, sessions, otp_challenges, users CASCADE',
    );
    await seedHomepage(prisma);
    const user = await createCustomer('self@example.com', '+919800000021', 'TLSELF0001');
    userId = user.id;
    await seedAccountDemo(prisma);
    await createCustomer('friend@example.com', '+919800000022', 'TLSELF0002', user.id);
    token = await login('self@example.com');
    otherToken = await login('friend@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('wallet', () => {
    it('shows balances, coin rules and the ledger', async () => {
      const res = await http().get('/api/v1/wallet').set(auth()).expect(200);
      expect(res.body).toMatchObject({
        balancePaise: 35_000,
        coins: 120,
        rules: { coinValuePaise: 100 },
      });
      expect(res.body.coinsExpiringSoon).toMatchObject({ coins: 0, withinDays: 30 });

      const all = await http().get('/api/v1/wallet/transactions').set(auth()).expect(200);
      expect(all.body.total).toBe(2);
      const referral = await http()
        .get('/api/v1/wallet/transactions?type=referral')
        .set(auth())
        .expect(200);
      expect(referral.body.items).toHaveLength(1);
      await http().get('/api/v1/wallet/transactions?type=nope').set(auth()).expect(400);
    });
  });

  describe('reviews', () => {
    let reviewId: string;

    it('lists delivered items waiting for a review', async () => {
      const res = await http().get('/api/v1/me/reviews').set(auth()).expect(200);
      // Smart watch, desk lamp, backpack and headphones are delivered; nothing reviewed yet.
      expect(res.body.pending).toHaveLength(4);
      expect(res.body.reviews).toHaveLength(0);
    });

    it('publishes a clean review and updates the product rating', async () => {
      const pending = (await http().get('/api/v1/me/reviews').set(auth())).body.pending;
      const lamp = pending.find(
        (p: { product: { slug: string } }) => p.product.slug === 'trustlon-studio-desk-lamp',
      );
      const before = await prisma.product.findUniqueOrThrow({
        where: { slug: 'trustlon-studio-desk-lamp' },
      });

      const media = await http()
        .post('/api/v1/reviews/media')
        .set(auth())
        .attach('file', PNG, { filename: 'lamp.png', contentType: 'image/png' })
        .expect(201);
      expect(media.body.kind).toBe('PHOTO');

      const res = await http()
        .post('/api/v1/reviews')
        .set(auth())
        .send({
          orderItemId: lamp.orderItemId,
          rating: 4,
          title: 'Warm light, sturdy base',
          body: 'Bright enough for reading and the arm stays where you put it.',
          mediaIds: [media.body.id],
        })
        .expect(201);
      reviewId = res.body.id;
      expect(res.body).toMatchObject({
        status: 'PUBLISHED',
        rating: 4,
        media: [{ kind: 'PHOTO' }],
      });

      const after = await prisma.product.findUniqueOrThrow({
        where: { slug: 'trustlon-studio-desk-lamp' },
      });
      expect(after.ratingCount).toBe(before.ratingCount + 1);

      await http()
        .post('/api/v1/reviews')
        .set(auth())
        .send({
          orderItemId: lamp.orderItemId,
          rating: 5,
          title: 'Again',
          body: 'Trying to review twice here.',
        })
        .expect(409);
      // Published media is visible to everyone.
      await http().get(`/api/v1/reviews/media/${media.body.id}`).expect(200);
    });

    it('holds suspicious text for moderation and adjusts the rating on edit', async () => {
      const held = await http()
        .patch(`/api/v1/reviews/${reviewId}`)
        .set(auth())
        .send({ body: 'Buy cheaper at www.example-deals.com or call 9876543210 today' })
        .expect(200);
      expect(held.body.status).toBe('UNDER_MODERATION');
      const review = await prisma.review.findUniqueOrThrow({ where: { id: reviewId } });
      expect(review.moderationFlags).toEqual(
        expect.arrayContaining(['CONTAINS_LINK', 'CONTAINS_CONTACT']),
      );
      expect(review.countedRating).toBeNull();

      await http()
        .patch(`/api/v1/reviews/${reviewId}`)
        .set(auth(otherToken))
        .send({ rating: 1 })
        .expect(404);
    });

    it('only accepts reviews for delivered items', async () => {
      const undelivered = await prisma.orderItem.findFirstOrThrow({
        where: { subOrder: { status: 'CONFIRMED', order: { userId } } },
      });
      await http()
        .post('/api/v1/reviews')
        .set(auth())
        .send({
          orderItemId: undelivered.id,
          rating: 5,
          title: 'Great coffee',
          body: 'Have not tried it yet, but sure.',
        })
        .expect(409);
    });
  });

  describe('B2B profile', () => {
    const profile = {
      businessName: 'Rao Interiors',
      gstin: GSTIN,
      pan: 'ABCDE1234F',
      billingLine1: '22 Brigade Road',
      billingCity: 'Bengaluru',
      billingState: 'Karnataka',
      billingPincode: '560001',
    };

    it('checks a GSTIN', async () => {
      const ok = await http()
        .post('/api/v1/kyc/gstin/verify')
        .set(auth())
        .send({ gstin: GSTIN })
        .expect(200);
      expect(ok.body).toMatchObject({ valid: true, state: 'Karnataka', pan: 'ABCDE1234F' });
      const wrongCheck = GSTIN.slice(0, 14) + (GSTIN[14] === 'A' ? 'B' : 'A');
      const bad = await http()
        .post('/api/v1/kyc/gstin/verify')
        .set(auth())
        .send({ gstin: wrongCheck })
        .expect(200);
      expect(bad.body.valid).toBe(false);
    });

    it('saves the profile as pending and enforces PAN and state', async () => {
      expect((await http().get('/api/v1/me/b2b').set(auth()).expect(200)).body.profile).toBeNull();
      await http()
        .post('/api/v1/me/b2b')
        .set(auth())
        .send({ ...profile, pan: 'ZZZZZ9999Z' })
        .expect(400);
      await http()
        .post('/api/v1/me/b2b')
        .set(auth())
        .send({ ...profile, billingState: 'Delhi' })
        .expect(400);

      const saved = await http().post('/api/v1/me/b2b').set(auth()).send(profile).expect(200);
      expect(saved.body).toMatchObject({
        status: 'PENDING',
        bulkPricingEnabled: false,
        gstin: GSTIN,
      });

      await http().post('/api/v1/me/b2b').set(auth(otherToken)).send(profile).expect(409);
    });
  });

  describe('affiliate', () => {
    it('creates one link per product, counts clicks and confirms due commissions', async () => {
      const product = await prisma.product.findUniqueOrThrow({
        where: { slug: 'trustlon-home-accent-chair' },
      });
      const first = await http()
        .post('/api/v1/affiliate/links')
        .set(auth())
        .send({ productId: product.id })
        .expect(201);
      const again = await http()
        .post('/api/v1/affiliate/links')
        .set(auth())
        .send({ productId: product.id })
        .expect(201);
      expect(again.body.items).toHaveLength(1);
      const code = first.body.items[0].code as string;
      expect(first.body.items[0].path).toBe(`/r/${code}`);

      const click = await http().post(`/api/v1/affiliate/clicks/${code}`).expect(201);
      expect(click.body.product).toMatchObject({
        slug: 'trustlon-home-accent-chair',
        categorySlug: 'furniture',
      });
      await http().post('/api/v1/affiliate/clicks/doesnotexist').expect(404);

      await prisma.affiliateEarning.create({
        data: {
          userId,
          linkId: first.body.items[0].id,
          orderNumber: 'TL2611009999',
          productName: product.name,
          saleAmountPaise: 100_000,
          commissionPaise: 5_000,
          confirmAfter: new Date(Date.now() - 60_000),
        },
      });

      const summary = await http().get('/api/v1/affiliate/summary').set(auth()).expect(200);
      expect(summary.body.referral).toMatchObject({
        code: 'TLSELF0001',
        friendsJoined: 1,
        path: '/signup?ref=TLSELF0001',
      });
      expect(summary.body.affiliate).toMatchObject({
        links: 1,
        clicks: 1,
        orders: 1,
        pendingPaise: 0,
        confirmedPaise: 5_000,
      });

      const earnings = await http().get('/api/v1/affiliate/earnings').set(auth()).expect(200);
      expect(earnings.body.items[0].status).toBe(AffiliateEarningStatus.CONFIRMED);
    });
  });

  describe('support tickets', () => {
    let ticketId: string;

    it('opens a ticket with an attachment about one of the customer’s orders', async () => {
      const order = await prisma.order.findFirstOrThrow({ where: { userId } });
      const file = await http()
        .post('/api/v1/tickets/attachments')
        .set(auth())
        .attach('file', PDF, { filename: 'invoice copy.pdf', contentType: 'application/pdf' })
        .expect(201);
      expect(file.body.fileName).toBe('invoice copy.pdf');

      const res = await http()
        .post('/api/v1/tickets')
        .set(auth())
        .send({
          category: 'PAYMENT',
          subject: 'Charged twice for my order',
          orderId: order.id,
          description:
            'My bank shows two payments for the same order. Please check and refund one.',
          attachmentIds: [file.body.id],
        })
        .expect(201);
      ticketId = res.body.id;
      expect(res.body).toMatchObject({ status: 'OPEN', canReply: true, order: { id: order.id } });
      expect(res.body.ticketNumber).toMatch(/^ST\d{10}$/);
      expect(res.body.messages.map((m: { authorType: string }) => m.authorType)).toEqual([
        'CUSTOMER',
        'SYSTEM',
      ]);
      expect(res.body.messages[0].attachments).toHaveLength(1);

      await http().get(`/api/v1/tickets/attachments/${file.body.id}`).set(auth()).expect(200);
      await http()
        .get(`/api/v1/tickets/attachments/${file.body.id}`)
        .set(auth(otherToken))
        .expect(404);

      const foreignOrder = await http()
        .post('/api/v1/tickets')
        .set(auth(otherToken))
        .send({
          category: 'ORDER',
          subject: 'Not my order',
          orderId: order.id,
          description: 'Trying to link an order that is not mine.',
        })
        .expect(400);
      expect(foreignOrder.body.field).toBe('orderId');
    });

    it('lets the customer reply, resolve and reopen by replying', async () => {
      await prisma.ticketMessage.create({
        data: {
          ticketId,
          authorType: TicketAuthor.AGENT,
          authorName: 'Priya from Trustlon Support',
          body: 'We have refunded the second payment.',
        },
      });
      const resolved = await http()
        .post(`/api/v1/tickets/${ticketId}/resolve`)
        .set(auth())
        .expect(200);
      expect(resolved.body).toMatchObject({ status: 'RESOLVED', canClose: false, canReply: true });

      const reopened = await http()
        .post(`/api/v1/tickets/${ticketId}/messages`)
        .set(auth())
        .send({ body: 'The refund has not reached my bank yet.' })
        .expect(201);
      expect(reopened.body.status).toBe('OPEN');

      const open = await http().get('/api/v1/tickets?status=open').set(auth()).expect(200);
      expect(open.body.total).toBe(1);
      await http().get(`/api/v1/tickets/${ticketId}`).set(auth(otherToken)).expect(404);
    });
  });
});
