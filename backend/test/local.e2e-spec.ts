import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { seedLocal } from '../prisma/seed-local';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma.service';

describe('Local sellers and owner settings (database-backed HTTP)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let ownerId: string;
  let ownerToken: string;
  let strangerToken: string;
  let customerToken: string;
  let storeId: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const owner = await prisma.user.upsert({
      where: { email: 'local-owner@example.test' },
      create: {
        email: 'local-owner@example.test',
        mobile: '+919800009901',
        fullName: 'Local Owner',
        role: 'VENDOR_OWNER',
        referralCode: 'TLLOCALTEST',
        termsAcceptedAt: new Date(),
      },
      update: {},
    });
    ownerId = owner.id;
    await seedLocal(prisma, owner.email);
    const jwt = app.get(JwtService);
    const sign = (sub: string, role: string) =>
      jwt.sign({ sub, role, sid: randomUUID() }, { audience: 'trustlon:access' });
    ownerToken = sign(owner.id, 'VENDOR_OWNER');
    strangerToken = sign(randomUUID(), 'VENDOR_OWNER');
    customerToken = sign(owner.id, 'CUSTOMER');
    storeId = (await prisma.vendor.findUniqueOrThrow({ where: { slug: 'local-demo-central' } })).id;
    await prisma.pincode.upsert({
      where: { pincode: '244999' },
      create: {
        pincode: '244999',
        city: 'Test',
        state: 'Uttar Pradesh',
        latitude: 28.8386,
        longitude: 78.7733,
        serviceable: false,
      },
      update: { serviceable: false },
    });
    await prisma.pincode.upsert({
      where: { pincode: '244998' },
      create: { pincode: '244998', city: 'Test', state: 'Uttar Pradesh' },
      update: { latitude: null, longitude: null },
    });
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it.each(['sellers', 'products'])(
    '%s validates inputs and supports the legacy radius alias',
    async (endpoint) => {
      const path = `/api/v1/local/${endpoint}`;
      for (const pincode of ['', '12345', '024001', '24400a', '2440011']) {
        await http().get(path).query({ pincode }).expect(400);
      }
      for (const radius of ['0', '7', '26', 'NaN', '5.5']) {
        await http().get(path).query({ pincode: '244001', radius }).expect(400);
      }
      await http().get(path).query({ pincode: '244001', radius: 5, radiusKm: 10 }).expect(400);
      await http().get(path).query({ pincode: '244001', page: -1 }).expect(400);
      await http().get(path).query({ pincode: '244001', pageSize: 49 }).expect(400);
      const defaultRadius = await http().get(path).query({ pincode: '244001' }).expect(200);
      expect(defaultRadius.body.radiusKm).toBe(10);
      const legacy = await http().get(path).query({ pincode: '244001', radiusKm: 5 }).expect(200);
      expect(legacy.body.radiusKm).toBe(5);
    },
  );

  it.each(['sellers', 'products'])(
    '%s returns empty arrays for unknown, ungeocoded and unserviceable pincodes',
    async (endpoint) => {
      for (const pincode of ['999999', '244998', '244999']) {
        const response = await http()
          .get(`/api/v1/local/${endpoint}`)
          .query({ pincode })
          .expect(200);
        expect(response.body.items).toEqual([]);
        expect(response.body.serviceable).toBe(false);
        if (endpoint === 'sellers') expect(response.body.sellers).toEqual([]);
      }
      const empty = await http().get(`/api/v1/local/${endpoint}?pincode=400001`).expect(200);
      expect(empty.body.items).toEqual([]);
      expect(empty.body.serviceable).toBe(true);
    },
  );

  it.each([
    [5, 3, 8],
    [10, 4, 12],
    [25, 6, 20],
  ])('radius %i returns %i sellers and %i same-day products', async (radius, sellers, products) => {
    const list = await http()
      .get('/api/v1/local/sellers')
      .query({ pincode: '244001', radius })
      .expect(200);
    expect(list.body.total).toBe(sellers);
    expect(list.body.sellers.map((s: { distanceKm: number }) => s.distanceKm)).toEqual(
      [...list.body.sellers].map((s) => s.distanceKm).sort((a, b) => a - b),
    );
    expect(list.body.sellers[0]).toMatchObject({
      id: storeId,
      storeName: 'Moradabad Central',
      logo: null,
      rating: null,
      distanceKm: 0,
      pickupPincode: '244001',
      deliveryPromise: 'same_day',
    });
    for (const seller of list.body.sellers) {
      expect(seller.topProducts).toHaveLength(4);
      expect(
        seller.topProducts.every(
          (p: { price: number; pricePaise: number }) => p.price === p.pricePaise,
        ),
      ).toBe(true);
    }
    expect(
      list.body.sellers.find((s: { slug: string }) => s.slug === 'local-demo-next-day')
        .deliveryPromise,
    ).toBe('next_day');
    const grid = await http()
      .get('/api/v1/local/products')
      .query({ pincode: '244001', radius })
      .expect(200);
    expect(grid.body.total).toBe(products);
    const forbidden = ['disabled', 'pending', 'distant', 'cutoff', 'next-day'];
    for (const product of grid.body.items) {
      expect(forbidden.some((slug) => product.seller.slug === `local-demo-${slug}`)).toBe(false);
      expect(product.inStock).toBe(true);
      expect(product.name).not.toMatch(/Draft|Sold-out/);
      expect(product).toMatchObject({
        slug: expect.any(String),
        image: expect.any(String),
        pricePaise: expect.any(Number),
        category: expect.any(Object),
        seller: expect.any(Object),
      });
    }
  });

  it.each(['sellers', 'products'])('%s paginates without duplicates', async (endpoint) => {
    const first = await http()
      .get(`/api/v1/local/${endpoint}`)
      .query({ pincode: '244001', radius: 25, pageSize: 2 })
      .expect(200);
    const second = await http()
      .get(`/api/v1/local/${endpoint}`)
      .query({ pincode: '244001', radius: 25, pageSize: 2, page: 2 })
      .expect(200);
    expect(first.body.items).toHaveLength(2);
    expect(second.body.items).toHaveLength(2);
    expect(new Set([...first.body.items, ...second.body.items].map((p) => p.id)).size).toBe(4);
    expect(second.body.totalPages).toBe(Math.ceil(second.body.total / 2));
    const beyond = await http()
      .get(`/api/v1/local/${endpoint}`)
      .query({ pincode: '244001', page: 100 })
      .expect(200);
    expect(beyond.body.items).toEqual([]);
  });

  it('enforces exact radius and seller approval/deletion on both endpoints', async () => {
    const central = await prisma.vendor.findUniqueOrThrow({ where: { id: storeId } });
    try {
      for (const change of [
        { pickupLat: 28.8386 + ((5.01 / 6371) * 180) / Math.PI },
        { kycApprovedAt: null },
        { status: 'SUSPENDED' as const },
        { deletedAt: new Date() },
      ]) {
        await prisma.vendor.update({
          where: { id: storeId },
          data: {
            pickupLat: central.pickupLat,
            status: central.status,
            kycApprovedAt: central.kycApprovedAt,
            deletedAt: null,
            ...change,
          },
        });
        const sellers = await http()
          .get('/api/v1/local/sellers?pincode=244001&radius=5')
          .expect(200);
        expect(sellers.body.sellers.some((s: { id: string }) => s.id === storeId)).toBe(false);
        const products = await http()
          .get('/api/v1/local/products?pincode=244001&radius=5')
          .expect(200);
        expect(
          products.body.items.some(
            (p: { seller: { slug: string } }) => p.seller.slug === central.slug,
          ),
        ).toBe(false);
      }
    } finally {
      await prisma.vendor.update({
        where: { id: storeId },
        data: {
          pickupLat: central.pickupLat,
          status: central.status,
          kycApprovedAt: central.kycApprovedAt,
          deletedAt: null,
        },
      });
    }
  });

  it('protects delivery settings by role and ownership, validates fields, and resolves coordinates', async () => {
    const path = `/api/v1/me/stores/${storeId}/delivery`;
    const body = {
      pickupAddress: '  Test pickup street  ',
      pickupPincode: '244102',
      sameDayDelivery: false,
      nextDayDelivery: true,
      deliveryCutoffTime: '14:00',
    };
    await http().get('/api/v1/me/stores/delivery').expect(401);
    await http().put(path).send(body).expect(401);
    await http().put(path).auth(customerToken, { type: 'bearer' }).send(body).expect(403);
    await http().put(path).auth(strangerToken, { type: 'bearer' }).send(body).expect(404);
    for (const change of [
      { pickupPincode: '000000' },
      { deliveryCutoffTime: '25:00' },
      { sameDayDelivery: 'true' },
      { pickupPincode: '244998' },
      { pickupAddress: '  ' },
      { pickupLat: 28.8 },
    ]) {
      await http()
        .put(path)
        .auth(ownerToken, { type: 'bearer' })
        .send({ ...body, ...change })
        .expect(400);
    }
    const saved = await http()
      .put(path)
      .auth(ownerToken, { type: 'bearer' })
      .send(body)
      .expect(200);
    const pin = await prisma.pincode.findUniqueOrThrow({ where: { pincode: '244102' } });
    expect(saved.body).toMatchObject({
      pickupAddress: 'Test pickup street',
      pickupLat: pin.latitude,
      pickupLng: pin.longitude,
    });
    const list = await http()
      .get('/api/v1/me/stores/delivery')
      .auth(ownerToken, { type: 'bearer' })
      .expect(200);
    expect(list.body.items).toHaveLength(10);
    for (const endpoint of ['sellers', 'products']) {
      const response = await http()
        .get(`/api/v1/local/${endpoint}?pincode=244001&radius=25`)
        .expect(200);
      expect(
        response.body.items.some(
          (item: { id: string; seller?: { slug: string } }) =>
            item.id === storeId || item.seller?.slug === 'local-demo-central',
        ),
      ).toBe(false);
    }
    await seedLocal(prisma, 'local-owner@example.test');
    expect(ownerId).toBeTruthy();
  });
});
