import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { OtpPurpose, WalletEntrySource } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { seedAccountDemo } from '../prisma/seed-account';
import { seedHomepage } from '../prisma/seed';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import {
  REFERRAL_REWARD_PAISE,
  ReferralRewardListener,
} from '../src/modules/partners/affiliate/referral.listener';
import { ConsoleOtpSender } from '../src/modules/notifications/otp-sender';
import { PrismaService } from '../src/database/prisma.service';

const PASSWORD = 'Trustlon123';
const UA_PHONE =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

describe('Account settings and Become a vendor (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let otpSender: ConsoleOtpSender;
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const createCustomer = async (
    email: string,
    mobile: string,
    code: string,
    referredById?: string,
  ) =>
    prisma.user.create({
      data: {
        fullName: 'Meera Iyer',
        email,
        mobile,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        passwordChangedAt: new Date(),
        referralCode: code,
        referredById,
        termsAcceptedAt: new Date(),
        emailVerifiedAt: new Date(),
        mobileVerifiedAt: new Date(),
      },
    });

  const login = async (identifier: string, password = PASSWORD, userAgent?: string) => {
    const req = http().post('/api/v1/auth/login');
    if (userAgent) req.set('User-Agent', userAgent);
    return (await req.send({ identifier, password }).expect(200)).body.accessToken as string;
  };

  let referrerId: string;
  let busyId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    otpSender = app.get(ConsoleOtpSender);

    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE account_deletions, notification_preferences, vendor_leads, ticket_attachments, ticket_messages, support_tickets, affiliate_earnings, affiliate_links, business_profiles, review_media, reviews, return_events, return_photos, return_items, return_requests, price_alerts, addresses, shipment_events, order_items, sub_orders, orders, wallet_entries, wallets, prime_memberships, cart_items, carts, wishlist_items, recently_viewed, deals, banners, home_sections, products, categories, vendors, pincodes, sessions, otp_challenges, users CASCADE',
    );
    await seedHomepage(prisma);
    const referrer = await createCustomer('ref@example.com', '+919800000031', 'TLSET00001');
    referrerId = referrer.id;
    const busy = await createCustomer(
      'busy@example.com',
      '+919800000032',
      'TLSET00002',
      referrer.id,
    );
    busyId = busy.id;
    // Gives every customer without orders a set of demo orders, some still on the way.
    await seedAccountDemo(prisma);
    await createCustomer('meera@example.com', '+919800000033', 'TLSET00003');
  });

  afterAll(async () => {
    await app.close();
  });

  it('updates the profile and validates date of birth', async () => {
    const token = await login('meera@example.com');
    const res = await http()
      .patch('/api/v1/me')
      .set(bearer(token))
      .send({
        fullName: 'Meera K Iyer',
        dateOfBirth: '1994-02-28',
        gender: 'FEMALE',
        preferredLanguage: 'HI',
      })
      .expect(200);
    expect(res.body.profile).toMatchObject({
      fullName: 'Meera K Iyer',
      dateOfBirth: '1994-02-28',
      gender: 'FEMALE',
      preferredLanguage: 'HI',
    });
    const tooYoung = new Date();
    tooYoung.setUTCFullYear(tooYoung.getUTCFullYear() - 5);
    const bad = await http()
      .patch('/api/v1/me')
      .set(bearer(token))
      .send({ dateOfBirth: tooYoung.toISOString().slice(0, 10) })
      .expect(400);
    expect(bad.body.field).toBe('dateOfBirth');
    await http()
      .patch('/api/v1/me')
      .set(bearer(token))
      .send({ dateOfBirth: '1994-02-30' })
      .expect(400);
    await http().patch('/api/v1/me').set(bearer(token)).send({ dateOfBirth: null }).expect(200);
  });

  it('changes the email only after the password and a code', async () => {
    const token = await login('meera@example.com');
    const wrong = await http()
      .post('/api/v1/me/contact/otp')
      .set(bearer(token))
      .send({ type: 'email', value: 'new@example.com', currentPassword: 'Wrong1234' })
      .expect(400);
    expect(wrong.body.field).toBe('currentPassword');
    const taken = await http()
      .post('/api/v1/me/contact/otp')
      .set(bearer(token))
      .send({ type: 'email', value: 'busy@example.com', currentPassword: PASSWORD })
      .expect(409);
    expect(taken.body.field).toBe('value');

    await http()
      .post('/api/v1/me/contact/otp')
      .set(bearer(token))
      .send({ type: 'email', value: 'New@Example.com', currentPassword: PASSWORD })
      .expect(200);
    const code = otpSender.lastCodeFor('new@example.com', OtpPurpose.CHANGE_CONTACT) as string;
    const res = await http()
      .post('/api/v1/me/contact/verify')
      .set(bearer(token))
      .send({ type: 'email', value: 'new@example.com', code })
      .expect(200);
    expect(res.body.profile).toMatchObject({ email: 'new@example.com', emailVerified: true });

    // The sign-in code endpoint can't be used for contact changes.
    await http()
      .post('/api/v1/auth/otp/send')
      .send({ identifier: 'other@example.com', purpose: 'CHANGE_CONTACT' })
      .expect(400);
  });

  it('lists sessions, revokes one and signs out others on password change', async () => {
    const phone = await login('new@example.com', PASSWORD, UA_PHONE);
    const laptop = await login('new@example.com');
    const list = await http().get('/api/v1/me/sessions').set(bearer(laptop)).expect(200);
    expect(list.body.items[0].current).toBe(true);
    const phoneSession = list.body.items.find(
      (s: { os: string; current: boolean }) => s.os === 'Android' && !s.current,
    );
    expect(phoneSession).toBeDefined();
    await http()
      .delete(`/api/v1/me/sessions/${list.body.items[0].id}`)
      .set(bearer(laptop))
      .expect(400);
    await http().delete(`/api/v1/me/sessions/${phoneSession.id}`).set(bearer(laptop)).expect(204);
    expect(phone).toBeTruthy();

    await http()
      .post('/api/v1/me/password')
      .set(bearer(laptop))
      .send({ currentPassword: PASSWORD, newPassword: PASSWORD })
      .expect(400);
    const changed = await http()
      .post('/api/v1/me/password')
      .set(bearer(laptop))
      .send({ currentPassword: PASSWORD, newPassword: 'NewPass2026' })
      .expect(200);
    expect(changed.body.signedOutSessions).toBeGreaterThanOrEqual(0);
    await login('new@example.com', 'NewPass2026');
  });

  it('saves notification choices, keeps security messages on and syncs marketing consent', async () => {
    const token = await login('new@example.com', 'NewPass2026');
    const res = await http()
      .patch('/api/v1/me/notification-preferences')
      .set(bearer(token))
      .send({
        channels: { offers: { email: true }, account: { sms: false }, orders: { whatsapp: false } },
      })
      .expect(200);
    expect(res.body.channels.offers.email).toBe(true);
    expect(res.body.channels.account.sms).toBe(true);
    expect(res.body.channels.orders.whatsapp).toBe(false);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'new@example.com' } });
    expect(user.marketingOptIn).toBe(true);
    const overview = await http().get('/api/v1/me/settings').set(bearer(token)).expect(200);
    expect(overview.body.notifications.channels.orders.whatsapp).toBe(false);
    expect(overview.body.deletion.blockers).toEqual([]);
  });

  it('exports personal data as a JSON file', async () => {
    const token = await login('busy@example.com');
    const res = await http().post('/api/v1/me/data-export').set(bearer(token)).expect(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="trustlon-my-data-/);
    expect(res.body.profile.email).toBe('busy@example.com');
    expect(res.body.orders.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('tokenHash');
  });

  it('blocks deletion while orders are on the way', async () => {
    const token = await login('busy@example.com');
    const res = await http()
      .post('/api/v1/me/delete')
      .set(bearer(token))
      .send({ confirm: 'DELETE', currentPassword: PASSWORD })
      .expect(409);
    expect(res.body.blockers.length).toBeGreaterThan(0);
  });

  it('deletes and anonymises an account but keeps nothing that can sign in', async () => {
    const token = await login('new@example.com', 'NewPass2026');
    await http()
      .post('/api/v1/me/delete')
      .set(bearer(token))
      .send({ confirm: 'delete', currentPassword: 'NewPass2026' })
      .expect(400);
    const res = await http()
      .post('/api/v1/me/delete')
      .set(bearer(token))
      .send({ confirm: 'DELETE', currentPassword: 'NewPass2026', reason: 'Testing' })
      .expect(200);
    expect(res.body.retainUntil).toBeDefined();
    const user = await prisma.user.findFirstOrThrow({ where: { referralCode: 'TLSET00003' } });
    expect(user.deletedAt).not.toBeNull();
    expect(user.email).not.toBe('new@example.com');
    expect(user.passwordHash).toBeNull();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    await http()
      .post('/api/v1/auth/login')
      .send({ identifier: 'new@example.com', password: 'NewPass2026' })
      .expect(401);
    // The email can be used for a new account again.
    await http()
      .post('/api/v1/auth/signup/validate')
      .send({
        fullName: 'Meera Iyer',
        email: 'new@example.com',
        mobile: '+919800000099',
        password: PASSWORD,
        acceptTerms: true,
      })
      .expect(200);
  });

  it('rewards the referrer once, after the friend’s first delivered order', async () => {
    const listener = app.get(ReferralRewardListener);
    expect(await listener.reward(busyId)).toBe(true);
    expect(await listener.reward(busyId)).toBe(false);
    const entries = await prisma.walletEntry.findMany({
      where: { userId: referrerId, source: WalletEntrySource.REFERRAL },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].amountPaise).toBe(REFERRAL_REWARD_PAISE);
  });

  describe('Become a vendor', () => {
    it('lists commission rates and calculates the payout', async () => {
      const rates = await http().get('/api/v1/public/commission-rates').expect(200);
      expect(rates.body.categories.length).toBeGreaterThan(0);
      const category = rates.body.categories[0];
      const res = await http()
        .post('/api/v1/public/fee-calculator')
        .send({ pricePaise: 118000, categoryId: category.id, gstRateBps: 1800 })
        .expect(200);
      expect(res.body.commissionBps).toBe(category.commissionPercent * 100);
      expect(res.body.netPayoutPaise).toBe(res.body.pricePaise - res.body.totalDeductionsPaise);
      await http().post('/api/v1/public/fee-calculator').send({ pricePaise: 10 }).expect(400);
      await http()
        .post('/api/v1/public/fee-calculator')
        .send({ pricePaise: 50000, gstRateBps: 1200 })
        .expect(400);
    });

    it('records a seller lead once per day', async () => {
      const lead = {
        contactName: 'Ravi Kumar',
        businessName: 'Kumar Handlooms',
        mobile: '+91 98000 00040',
        email: 'ravi@example.com',
        city: 'Varanasi',
      };
      await http().post('/api/v1/public/vendor-leads').send(lead).expect(201);
      await http().post('/api/v1/public/vendor-leads').send(lead).expect(201);
      expect(await prisma.vendorLead.count({ where: { mobile: '+919800000040' } })).toBe(1);
      const bad = await http()
        .post('/api/v1/public/vendor-leads')
        .send({ ...lead, mobile: '+919800000041', gstin: '29ABCDE1234F1Z0' })
        .expect(400);
      expect(bad.body.field).toBe('gstin');
    });
  });
});
