import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { KycStatus, ProductStatus, SubmissionKind, UserRole, VendorStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { seedHomepage } from '../prisma/seed';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { currentStep, totpCode } from '../src/utils/security/totp';
import { PrismaService } from '../src/database/prisma.service';
import { adminToken } from './admin-session';

const PASSWORD = 'Trustlon123';

describe('Admin panel (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: string;
  let marketing: string;
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const user = (email: string, mobile: string, code: string, role: UserRole) =>
    bcrypt.hash(PASSWORD, 4).then((passwordHash) =>
      prisma.user.create({
        data: {
          fullName: 'Team Member',
          email,
          mobile,
          role,
          passwordHash,
          referralCode: code,
          termsAcceptedAt: new Date(),
        },
      }),
    );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE audit_logs, role_permissions, staff_mfa, content_reports, order_notes, setting_versions, site_settings, content_entries, cms_pages, seo_meta, redirects, coupons, product_submissions, category_attributes, attributes, hsn_rates, vendor_trust_scores, vendor_notes, vendor_documents, vendor_kyc, wallet_entries, wallets, review_media, reviews, shipment_events, order_items, sub_orders, orders, deals, banners, home_sections, products, categories, vendors, pincodes, sessions, otp_challenges, users CASCADE',
    );
    await seedHomepage(prisma);
    await user('admin@example.com', '+919800000071', 'TLADM00011', UserRole.SUPER_ADMIN);
    await user('mkt@example.com', '+919800000072', 'TLADM00012', UserRole.MARKETING);
    await user('cust@example.com', '+919800000073', 'TLADM00013', UserRole.CUSTOMER);
    admin = await adminToken(app, 'admin@example.com');
    marketing = await adminToken(app, 'mkt@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('sign-in with two-factor authentication', () => {
    it('sets up an authenticator app on first sign-in, then asks for a code', async () => {
      const login = await http()
        .post('/api/v1/admin/auth/login')
        .send({ email: 'mkt@example.com', password: PASSWORD })
        .expect(200);
      expect(login.body.step).toBe('enroll');
      const setup = await http()
        .post('/api/v1/admin/auth/2fa/setup')
        .send({ challengeToken: login.body.challengeToken })
        .expect(200);
      expect(setup.body.otpauthUri).toContain('otpauth://totp/');

      await http()
        .post('/api/v1/admin/auth/2fa/enroll')
        .send({ challengeToken: login.body.challengeToken, code: '000000' })
        .expect(400);
      const enrolled = await http()
        .post('/api/v1/admin/auth/2fa/enroll')
        .send({
          challengeToken: login.body.challengeToken,
          code: totpCode(setup.body.secret, currentStep()),
        })
        .expect(200);
      expect(enrolled.body.recoveryCodes).toHaveLength(10);
      expect(String(enrolled.headers['set-cookie'])).toContain('tl_admin_rt=');
      await http().get('/api/v1/admin/auth/me').set(bearer(enrolled.body.accessToken)).expect(200);

      const again = await http()
        .post('/api/v1/admin/auth/login')
        .send({ email: 'mkt@example.com', password: PASSWORD })
        .expect(200);
      expect(again.body.step).toBe('verify');
      // The code used for set-up can't be used again.
      await http()
        .post('/api/v1/admin/auth/2fa/verify')
        .send({
          challengeToken: again.body.challengeToken,
          code: totpCode(setup.body.secret, currentStep()),
        })
        .expect(400);
      await http()
        .post('/api/v1/admin/auth/2fa/verify')
        .send({
          challengeToken: again.body.challengeToken,
          recoveryCode: enrolled.body.recoveryCodes[0],
        })
        .expect(200);
    });

    it('keeps customers and storefront sessions out', async () => {
      await http()
        .post('/api/v1/admin/auth/login')
        .send({ email: 'cust@example.com', password: PASSWORD })
        .expect(403);
      await http()
        .post('/api/v1/admin/auth/login')
        .send({ email: 'admin@example.com', password: 'Wrong123' })
        .expect(401);
      const storefront = await http()
        .post('/api/v1/auth/login')
        .send({ identifier: 'admin@example.com', password: PASSWORD })
        .expect(200);
      await http()
        .get('/api/v1/admin/dashboard/summary')
        .set(bearer(storefront.body.accessToken))
        .expect(401);
      await http().get('/api/v1/admin/dashboard/summary').set(bearer(admin)).expect(200);
    });
  });

  describe('settings', () => {
    it('lets only Super Admin change business rules, versions every change and can restore', async () => {
      await http()
        .patch('/api/v1/admin/settings/business-rules')
        .set(bearer(marketing))
        .send({ value: { defaultCommissionPercent: 12 } })
        .expect(403);
      await http()
        .patch('/api/v1/admin/settings/business-rules')
        .set(bearer(admin))
        .send({ value: { defaultCommissionPercent: 99 } })
        .expect(400);
      const saved = await http()
        .patch('/api/v1/admin/settings/business-rules')
        .set(bearer(admin))
        .send({ value: { defaultCommissionPercent: 12 }, reason: 'Festive pricing' })
        .expect(200);
      expect(saved.body.value.defaultCommissionPercent).toBe(12);
      expect(saved.body.version).toBe(1);

      const rates = await http().get('/api/v1/sell/commission-rates').expect(200);
      expect(JSON.stringify(rates.body)).toContain('12');

      await http()
        .patch('/api/v1/admin/settings/business-rules')
        .set(bearer(admin))
        .send({ value: { defaultCommissionPercent: 15 } })
        .expect(200);
      const restored = await http()
        .post('/api/v1/admin/settings/business-rules/versions/1/restore')
        .set(bearer(admin))
        .expect(200);
      expect(restored.body.value.defaultCommissionPercent).toBe(12);
      expect(restored.body.version).toBe(3);

      const log = await http()
        .get('/api/v1/admin/audit-log?entity=settings')
        .set(bearer(admin))
        .expect(200);
      expect(log.body.total).toBeGreaterThanOrEqual(3);
    });

    it('stores gateway secrets encrypted and shows them masked', async () => {
      await http()
        .patch('/api/v1/admin/settings/payments')
        .set(bearer(admin))
        .send({ value: { gateway: { keyId: 'rzp_test_1', keySecret: 'supersecret1234' } } })
        .expect(200);
      const read = await http()
        .get('/api/v1/admin/settings/payments')
        .set(bearer(admin))
        .expect(200);
      expect(read.body.value.gateway.keySecret).toBe('••••1234');
      const row = await prisma.siteSetting.findUniqueOrThrow({ where: { key: 'payments' } });
      expect(JSON.stringify(row.value)).not.toContain('supersecret');
      // Saving other fields keeps the secret.
      await http()
        .patch('/api/v1/admin/settings/payments')
        .set(bearer(admin))
        .send({ value: { gateway: { keyId: 'rzp_test_2', keySecret: '••••1234' } } })
        .expect(200);
      expect(
        (await http().get('/api/v1/admin/settings/payments').set(bearer(admin))).body.value.gateway
          .keySecret,
      ).toBe('••••1234');
    });

    it('lets Marketing edit storefront text and the theme', async () => {
      await http()
        .put('/api/v1/admin/settings/localisation/content')
        .set(bearer(marketing))
        .send({ language: 'hi', key: 'signup.title', value: 'नया खाता' })
        .expect(204);
      const content = await http().get('/api/v1/site/content/hi').expect(200);
      expect(content.body.entries['signup.title']).toBe('नया खाता');
      const theme = await http()
        .patch('/api/v1/admin/settings/theme')
        .set(bearer(marketing))
        .send({ value: { colors: { teal: '#FF6600' } } })
        .expect(200);
      expect(theme.body.value.colors.teal).toBe('#FF6600');
      const config = await http().get('/api/v1/site/config').expect(200);
      expect(config.body.theme.colors.teal).toBe('#FF6600');
    });
  });

  describe('vendors and products', () => {
    it('approves KYC and suspends a vendor, hiding its products', async () => {
      const vendor = await prisma.vendor.findUniqueOrThrow({ where: { slug: 'soundspace' } });
      await prisma.vendorKyc.create({
        data: { vendorId: vendor.id, status: KycStatus.SUBMITTED, submittedAt: new Date() },
      });
      const queue = await http().get('/api/v1/admin/kyc/queue').set(bearer(admin)).expect(200);
      expect(queue.body.items.map((i: { vendorId: string }) => i.vendorId)).toContain(vendor.id);
      await http()
        .post(`/api/v1/admin/kyc/${vendor.id}/approve`)
        .set(bearer(marketing))
        .send({})
        .expect(403);
      await http()
        .post(`/api/v1/admin/kyc/${vendor.id}/approve`)
        .set(bearer(admin))
        .send({})
        .expect(201);

      await http()
        .post(`/api/v1/admin/vendors/${vendor.id}/suspend`)
        .set(bearer(admin))
        .send({ reason: 'x' })
        .expect(400);
      await http()
        .post(`/api/v1/admin/vendors/${vendor.id}/suspend`)
        .set(bearer(admin))
        .send({ reason: 'Counterfeit complaints' })
        .expect(201);
      await http().get('/api/v1/products/soundspace-wireless-headphones').expect(404);
      await http()
        .post(`/api/v1/admin/vendors/${vendor.id}/reinstate`)
        .set(bearer(admin))
        .send({ reason: 'Resolved' })
        .expect(201);
      await http().get('/api/v1/products/soundspace-wireless-headphones').expect(200);
      expect((await prisma.vendor.findUniqueOrThrow({ where: { id: vendor.id } })).status).toBe(
        VendorStatus.ACTIVE,
      );
    });

    it('applies an approved edit to a live product', async () => {
      const product = await prisma.product.findUniqueOrThrow({
        where: { slug: 'everyday-classic-sneakers' },
      });
      await prisma.productSubmission.create({
        data: {
          productId: product.id,
          kind: SubmissionKind.EDIT,
          changes: [{ field: 'pricePaise', before: product.pricePaise, after: 159_900 }],
        },
      });
      const queue = await http()
        .get('/api/v1/admin/products/moderation')
        .set(bearer(marketing))
        .expect(200);
      expect(
        queue.body.items.some((i: { product: { id: string } }) => i.product.id === product.id),
      ).toBe(true);
      await http()
        .post(`/api/v1/admin/products/${product.id}/approve`)
        .set(bearer(marketing))
        .send({})
        .expect(200);
      const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(after.pricePaise).toBe(159_900);
      expect(after.status).toBe(ProductStatus.LIVE);
    });
  });

  describe('customers and staff', () => {
    it('adjusts a wallet with a ledger entry and a reason', async () => {
      const customer = await prisma.user.findUniqueOrThrow({
        where: { email: 'cust@example.com' },
      });
      await http()
        .post(`/api/v1/admin/customers/${customer.id}/wallet-adjustment`)
        .set(bearer(admin))
        .send({ direction: 'DEBIT', amountRupees: 10, reason: 'Test' })
        .expect(400);
      const res = await http()
        .post(`/api/v1/admin/customers/${customer.id}/wallet-adjustment`)
        .set(bearer(admin))
        .send({ direction: 'CREDIT', amountRupees: 150, reason: 'Goodwill for late delivery' })
        .expect(200);
      expect(res.body.wallet.balancePaise).toBe(15_000);
      expect(res.body.wallet.entries[0].source).toBe('ADJUSTMENT');
    });

    it('creates staff with a temporary password that must be changed', async () => {
      const created = await http()
        .post('/api/v1/admin/staff')
        .set(bearer(admin))
        .send({
          fullName: 'Riya Shah',
          email: 'riya@example.com',
          mobile: '9800000074',
          role: 'SUPPORT',
        })
        .expect(201);
      expect(created.body.temporaryPassword).toHaveLength(14);
      const login = await http()
        .post('/api/v1/admin/auth/login')
        .send({ email: 'riya@example.com', password: created.body.temporaryPassword })
        .expect(200);
      expect(login.body.step).toBe('password');
      const next = await http()
        .post('/api/v1/admin/auth/password')
        .send({ challengeToken: login.body.challengeToken, newPassword: 'NewSecret123' })
        .expect(200);
      expect(next.body.step).toBe('enroll');
    });

    it('lets only Super Admin edit role permissions', async () => {
      await http()
        .patch('/api/v1/admin/roles/MARKETING')
        .set(bearer(marketing))
        .send({ permissions: [] })
        .expect(403);
      const res = await http()
        .patch('/api/v1/admin/roles/MARKETING')
        .set(bearer(admin))
        .send({ permissions: ['marketing:edit'] })
        .expect(200);
      const role = res.body.roles.find((r: { role: string }) => r.role === 'MARKETING');
      expect(role.permissions).toEqual(
        expect.arrayContaining(['marketing:edit', 'marketing:view']),
      );
      await http().get('/api/v1/admin/vendors').set(bearer(marketing)).expect(403);
      await http().post('/api/v1/admin/roles/MARKETING/reset').set(bearer(admin)).expect(200);
    });
  });
});
