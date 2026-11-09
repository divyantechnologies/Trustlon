import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { seedHomepage } from '../prisma/seed';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

const PASSWORD = 'Trustlon123';

describe('Storefront home APIs (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const guest = randomUUID();
  const productId = new Map<string, string>();

  const login = async (guestCartToken?: string) => {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ identifier: 'shopper@example.com', password: PASSWORD, guestCartToken })
      .expect(200);
    return res.body.accessToken as string;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE cart_items, carts, wishlist_items, recently_viewed, deals, banners, home_sections, products, categories, vendors, pincodes, sessions, otp_challenges, users CASCADE',
    );
    await seedHomepage(prisma);
    for (const row of await prisma.product.findMany({ select: { id: true, slug: true } })) {
      productId.set(row.slug, row.id);
    }

    await prisma.user.create({
      data: {
        fullName: 'Test Shopper',
        email: 'shopper@example.com',
        mobile: '+919812345678',
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        passwordChangedAt: new Date(),
        referralCode: 'TLTEST0001',
        termsAcceptedAt: new Date(),
        emailVerifiedAt: new Date(),
        mobileVerifiedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('home page', () => {
    it('returns every shared home section in one call', async () => {
      const res = await http().get('/api/v1/home').expect(200);
      expect(res.headers['cache-control']).toContain('s-maxage=300');

      expect(res.body.sections.map((s: { key: string }) => s.key)[0]).toBe('HERO_BANNERS');
      expect(res.body.banners).toHaveLength(4);
      expect(res.body.banners[0]).toMatchObject({ eyebrow: 'ELECTRONICS & APPLIANCES', tag: expect.any(String) });
      expect(res.body.promos.strip.highlights).toHaveLength(4);
      expect(res.body.promos.wide).toHaveLength(2);
      expect(res.body.promos.side).toHaveLength(2);
      expect(res.body.combos).toHaveLength(5);
      expect(res.body.trending).toHaveLength(8);
      expect(res.body.categories).toHaveLength(6);
      expect(res.body.categories[0].children).toHaveLength(4);

      expect(res.body.deals.items).toHaveLength(5);
      expect(new Date(res.body.deals.endsAt).getTime()).toBeGreaterThan(Date.now());
      const headphones = res.body.deals.items.find(
        (p: { slug: string }) => p.slug === 'soundspace-wireless-headphones',
      );
      expect(headphones).toMatchObject({ pricePaise: 249900, mrpPaise: 499900, discountPercent: 50 });

      expect(res.body.originals).toHaveLength(4);
      expect(res.body.originals.every((p: { seller: { isPlatformOwned: boolean } }) => p.seller.isPlatformOwned)).toBe(true);
      expect(res.body.featuredStores.map((s: { slug: string }) => s.slug)).toEqual([
        'soundspace',
        'urban-thread',
        'pure-and-kind',
        'the-daily-pantry',
      ]);
    });
  });

  describe('catalog and search', () => {
    it('lists a category including its sub-categories', async () => {
      const res = await http().get('/api/v1/products?category=home').expect(200);
      expect(res.body.total).toBe(4);
      expect(res.body.items.every((p: { category: { slug: string } }) => ['lighting', 'furniture'].includes(p.category.slug))).toBe(true);
    });

    it('filters deals, originals and stores, and sorts by price', async () => {
      const deals = await http().get('/api/v1/products?deals=true').expect(200);
      expect(deals.body.total).toBe(5);

      const originals = await http().get('/api/v1/products?originals=true&sort=price_asc').expect(200);
      const prices = originals.body.items.map((p: { pricePaise: number }) => p.pricePaise);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));

      const store = await http().get('/api/v1/products?store=the-daily-pantry').expect(200);
      expect(store.body.items.map((p: { slug: string }) => p.slug).sort()).toEqual([
        'highland-artisan-coffee-250g',
        'morning-coffee-gift-set',
      ]);

      const combos = await http().get('/api/v1/products?bundle=true').expect(200);
      expect(combos.body.total).toBe(5);
    });

    it('returns an empty page for an unknown category', async () => {
      const res = await http().get('/api/v1/products?category=nothing-here').expect(200);
      expect(res.body).toMatchObject({ items: [], total: 0 });
    });

    it('searches across name, brand and seller', async () => {
      const res = await http().get('/api/v1/search?q=coffee').expect(200);
      expect(res.body.total).toBe(3);
      const bySeller = await http().get('/api/v1/search?q=pure kind').expect(200);
      expect(bySeller.body.items[0].slug).toBe('daily-glow-skincare-essentials');
    });

    it('suggests products, categories and stores', async () => {
      const popular = await http().get('/api/v1/search/suggest').expect(200);
      expect(popular.body.products).toHaveLength(4);

      const lamp = await http().get('/api/v1/search/suggest?q=lamp').expect(200);
      expect(lamp.body.products[0].slug).toBe('trustlon-studio-desk-lamp');

      const sound = await http().get('/api/v1/search/suggest?q=sound').expect(200);
      expect(sound.body.stores[0].slug).toBe('soundspace');
    });

    it('returns product detail with similar products', async () => {
      const res = await http().get('/api/v1/products/trustlon-home-accent-chair').expect(200);
      expect(res.body.product).toMatchObject({ slug: 'trustlon-home-accent-chair', maxQuantity: 10 });
      expect(res.body.similar.map((p: { slug: string }) => p.slug)).toEqual(['handpicked-living-room-accent-chair']);
      await http().get('/api/v1/products/does-not-exist').expect(404);
    });

    it('hides products of suspended sellers', async () => {
      await prisma.vendor.update({ where: { slug: 'urban-thread' }, data: { status: 'SUSPENDED' } });
      await http().get('/api/v1/products/everyday-classic-sneakers').expect(404);
      await prisma.vendor.update({ where: { slug: 'urban-thread' }, data: { status: 'ACTIVE' } });
    });
  });

  describe('location', () => {
    it('reports pincode serviceability', async () => {
      const res = await http().get('/api/v1/pincode/560001/serviceability').expect(200);
      expect(res.body).toMatchObject({ city: 'Bengaluru', serviceable: true, sameDayAvailable: true });

      const unknown = await http().get('/api/v1/pincode/999999/serviceability').expect(200);
      expect(unknown.body.serviceable).toBe(false);
      await http().get('/api/v1/pincode/12/serviceability').expect(400);
    });

    it('finds local sellers nearest first', async () => {
      const res = await http().get('/api/v1/local/sellers?pincode=560001&radiusKm=10').expect(200);
      const slugs = res.body.sellers.map((s: { slug: string }) => s.slug);
      expect(slugs[0]).toBe('green-basket');
      expect(slugs).toEqual(expect.arrayContaining(['the-living-room', 'the-daily-pantry']));
      expect(slugs).not.toContain('soundspace');

      const far = await http().get('/api/v1/local/sellers?pincode=110001').expect(200);
      expect(far.body.sellers).toHaveLength(0);
      await http().get('/api/v1/local/sellers?pincode=560001&radiusKm=7').expect(400);
    });
  });

  describe('guest cart, recently viewed and recommendations', () => {
    it('requires a guest token or sign-in for the cart', async () => {
      await http().get('/api/v1/cart').expect(400);
    });

    it('adds items, caps quantity at 10 and prices deals', async () => {
      const id = productId.get('soundspace-wireless-headphones');
      const added = await http()
        .post('/api/v1/cart/items')
        .set('x-guest-token', guest)
        .send({ productId: id, quantity: 2 })
        .expect(200);
      expect(added.body).toMatchObject({ itemCount: 2, subtotalPaise: 499800 });
      expect(added.body.groups[0].seller.slug).toBe('soundspace');

      await http().post('/api/v1/cart/items').set('x-guest-token', guest).send({ productId: id, quantity: 10 }).expect(200);
      const capped = await http().get('/api/v1/cart').set('x-guest-token', guest).expect(200);
      expect(capped.body.itemCount).toBe(10);

      await http().patch(`/api/v1/cart/items/${id}`).set('x-guest-token', guest).send({ quantity: 11 }).expect(400);
      const set = await http().patch(`/api/v1/cart/items/${id}`).set('x-guest-token', guest).send({ quantity: 3 }).expect(200);
      expect(set.body.itemCount).toBe(3);
    });

    it('rejects out-of-stock items', async () => {
      const id = productId.get('trustlon-move-smart-watch') as string;
      await prisma.product.update({ where: { id }, data: { stock: 0 } });
      await http().post('/api/v1/cart/items').set('x-guest-token', guest).send({ productId: id }).expect(422);
      await prisma.product.update({ where: { id }, data: { stock: 50 } });
    });

    it('records recently viewed products, latest first', async () => {
      for (const slug of ['trustlon-studio-desk-lamp', 'highland-artisan-coffee-250g']) {
        await http().post('/api/v1/me/recently-viewed').set('x-guest-token', guest).send({ productId: productId.get(slug) }).expect(204);
      }
      const res = await http().get('/api/v1/me/recently-viewed').set('x-guest-token', guest).expect(200);
      expect(res.body.items.map((p: { slug: string }) => p.slug)).toEqual([
        'highland-artisan-coffee-250g',
        'trustlon-studio-desk-lamp',
      ]);

      const anonymous = await http().get('/api/v1/me/recently-viewed').expect(200);
      expect(anonymous.body.items).toEqual([]);
    });

    it('recommends from recently viewed categories first, never the viewed items', async () => {
      const res = await http().get('/api/v1/recommendations?limit=10').set('x-guest-token', guest).expect(200);
      const slugs = res.body.items.map((p: { slug: string }) => p.slug);
      expect(slugs[0]).toBe('fresh-roast-filter-coffee-500g');
      expect(slugs).not.toContain('highland-artisan-coffee-250g');
      expect(slugs).not.toContain('trustlon-studio-desk-lamp');
      expect(slugs).toHaveLength(10);

      const anonymous = await http().get('/api/v1/recommendations?limit=4').expect(200);
      expect(anonymous.body.items).toHaveLength(4);
    });
  });

  describe('signed-in shopper', () => {
    let token: string;

    it('merges the guest cart and history into the account at sign-in', async () => {
      token = await login(guest);
      // The merge runs in the background after the login response.
      let itemCount = 0;
      for (let attempt = 0; attempt < 30 && itemCount !== 3; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const cart = await http().get('/api/v1/cart').set('Authorization', `Bearer ${token}`).expect(200);
        itemCount = cart.body.itemCount;
      }
      expect(itemCount).toBe(3);

      const recent = await http().get('/api/v1/me/recently-viewed').set('Authorization', `Bearer ${token}`).expect(200);
      expect(recent.body.items).toHaveLength(2);

      const guestCart = await http().get('/api/v1/cart').set('x-guest-token', guest).expect(200);
      expect(guestCart.body.itemCount).toBe(0);
    });

    it('rejects an invalid token instead of treating it as a guest', async () => {
      await http().get('/api/v1/cart').set('Authorization', 'Bearer not-a-token').expect(401);
    });

    it('keeps a wishlist for signed-in users only', async () => {
      const id = productId.get('trustlon-studio-desk-lamp');
      await http().get('/api/v1/me/wishlist').expect(401);

      const added = await http().put(`/api/v1/me/wishlist/${id}`).set('Authorization', `Bearer ${token}`).expect(200);
      expect(added.body.productIds).toEqual([id]);
      const list = await http().get('/api/v1/me/wishlist').set('Authorization', `Bearer ${token}`).expect(200);
      expect(list.body.items[0].slug).toBe('trustlon-studio-desk-lamp');

      const removed = await http().delete(`/api/v1/me/wishlist/${id}`).set('Authorization', `Bearer ${token}`).expect(200);
      expect(removed.body.productIds).toEqual([]);
    });
  });

  describe('marketing admin', () => {
    it('is closed to customers', async () => {
      const token = await login();
      await http().get('/api/v1/admin/marketing/banners').set('Authorization', `Bearer ${token}`).expect(403);
    });

    it('lets Marketing add a banner that appears on the home page at once', async () => {
      await prisma.user.update({ where: { email: 'shopper@example.com' }, data: { role: UserRole.MARKETING } });
      const token = await login();
      await http().get('/api/v1/home').expect(200);

      await http()
        .post('/api/v1/admin/marketing/banners')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Festive sale', ctaLabel: 'Shop now', imageUrl: '/images/home/hero.jpg', href: '/browse/deals', priority: 99 })
        .expect(201);

      const home = await http().get('/api/v1/home').expect(200);
      expect(home.body.banners[0].title).toBe('Festive sale');
    });

    it('validates deal prices and windows', async () => {
      const token = await login();
      const id = productId.get('trustlon-home-accent-chair');
      const startsAt = new Date().toISOString();
      const endsAt = new Date(Date.now() + 3600_000).toISOString();

      await http()
        .post('/api/v1/admin/marketing/deals')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: id, dealPricePaise: 599900, startsAt, endsAt })
        .expect(400);
      await http()
        .post('/api/v1/admin/marketing/deals')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: id, dealPricePaise: 499900, startsAt: endsAt, endsAt: startsAt })
        .expect(400);
      await http()
        .post('/api/v1/admin/marketing/deals')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: id, dealPricePaise: 499900, startsAt, endsAt })
        .expect(201);

      const product = await http().get('/api/v1/products/trustlon-home-accent-chair').expect(200);
      expect(product.body.product.pricePaise).toBe(499900);
    });
  });
});
