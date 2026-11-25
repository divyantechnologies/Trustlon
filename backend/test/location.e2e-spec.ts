import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { seedHomepage } from '../prisma/seed';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma.service';

const PASSWORD = 'Trustlon123';

describe('Location data and international addresses (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let token: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE cities, account_deletions, notification_preferences, vendor_leads, ticket_attachments, ticket_messages, support_tickets, affiliate_earnings, affiliate_links, business_profiles, review_media, reviews, return_events, return_photos, return_items, return_requests, price_alerts, addresses, shipment_events, order_items, sub_orders, orders, wallet_entries, wallets, prime_memberships, cart_items, carts, wishlist_items, recently_viewed, deals, banners, home_sections, products, categories, vendors, pincodes, sessions, otp_challenges, users CASCADE',
    );
    await seedHomepage(prisma);
    await prisma.city.createMany({
      data: [
        {
          id: 1,
          countryCode: 'US',
          name: 'San Francisco',
          searchName: 'san francisco',
          population: 870000,
        },
        { id: 2, countryCode: 'US', name: 'San Jose', searchName: 'san jose', population: 1000000 },
        { id: 3, countryCode: 'CH', name: 'Zürich', searchName: 'zurich', population: 400000 },
      ],
    });
    await prisma.user.create({
      data: {
        fullName: 'Ravi Menon',
        email: 'ravi@example.com',
        mobile: '+919800000051',
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        referralCode: 'TLLOC00001',
        termsAcceptedAt: new Date(),
      },
    });
    token = (
      await http()
        .post('/api/v1/auth/login')
        .send({ identifier: '98000 00051', password: PASSWORD })
        .expect(200)
    ).body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists countries with their postal code rules', async () => {
    const res = await http().get('/api/v1/location/countries').expect(200);
    const india = res.body.items.find((c: { code: string }) => c.code === 'IN');
    expect(india).toMatchObject({ postalLabel: 'Pincode', stateRequired: true, hasStates: true });
    expect(res.body.items.length).toBeGreaterThan(240);
  });

  it('lists states and suggests cities', async () => {
    const states = await http().get('/api/v1/location/countries/us/states').expect(200);
    expect(states.body.items).toContain('California');
    const india = await http().get('/api/v1/location/countries/IN/states').expect(200);
    expect(india.body.items).toContain('Karnataka');
    const cities = await http().get('/api/v1/location/countries/US/cities?q=san').expect(200);
    expect(cities.body.items).toEqual(['San Jose', 'San Francisco']);
    const zurich = await http().get('/api/v1/location/countries/CH/cities?q=zur').expect(200);
    expect(zurich.body.items).toEqual(['Zürich']);
    const bengaluru = await http().get('/api/v1/location/countries/IN/cities?q=beng').expect(200);
    expect(bengaluru.body.items).toContain('Bengaluru');
    await http().get('/api/v1/location/countries/XX/states').expect(404);
  });

  it('searches pincodes by number or area and looks one up', async () => {
    const byNumber = await http().get('/api/v1/pincode/search?q=5600').expect(200);
    expect(byNumber.body.items.map((p: { pincode: string }) => p.pincode)).toContain('560001');
    const byArea = await http().get('/api/v1/pincode/search?q=kora').expect(200);
    expect(byArea.body.items[0]).toMatchObject({ pincode: '560034', city: 'Bengaluru' });
    const one = await http().get('/api/v1/pincode/560034').expect(200);
    expect(one.body).toMatchObject({ state: 'Karnataka' });
    await http().get('/api/v1/pincode/099999').expect(400);
    await http().get('/api/v1/pincode/999999').expect(404);
  });

  it('saves addresses abroad with that country’s postal code and phone rules', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const address = {
      label: 'OTHER',
      labelName: 'Sister',
      fullName: 'Priya Menon',
      mobile: '+1 650 253 0000',
      line1: '500 Howard Street',
      city: 'San Francisco',
      state: 'california',
      pincode: '94105',
      country: 'US',
    };
    const bad = await http()
      .post('/api/v1/me/addresses')
      .set(auth)
      .send({ ...address, pincode: '9410' })
      .expect(400);
    expect(bad.body.field).toBe('pincode');
    const noState = await http()
      .post('/api/v1/me/addresses')
      .set(auth)
      .send({ ...address, state: 'Narnia' })
      .expect(400);
    expect(noState.body.field).toBe('state');
    const saved = await http().post('/api/v1/me/addresses').set(auth).send(address).expect(201);
    expect(saved.body.items[0]).toMatchObject({
      country: 'US',
      state: 'California',
      mobile: '+16502530000',
      delivery: { serviceable: false },
    });

    // Indian addresses still need an Indian mobile and a real pincode.
    const indian = await http()
      .post('/api/v1/me/addresses')
      .set(auth)
      .send({ ...address, country: 'IN', pincode: '560034', state: 'Karnataka', city: 'Bangalore' })
      .expect(400);
    expect(indian.body.field).toBe('mobile');
    const ok = await http()
      .post('/api/v1/me/addresses')
      .set(auth)
      .send({
        ...address,
        country: undefined,
        mobile: '98000 00051',
        pincode: '560034',
        state: '',
        city: 'Bangalore',
      })
      .expect(201);
    const home = ok.body.items.find((a: { country: string }) => a.country === 'IN');
    expect(home).toMatchObject({ city: 'Bengaluru', state: 'Karnataka', pincode: '560034' });
  });
});
