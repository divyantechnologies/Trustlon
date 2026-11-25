import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { CartService } from '../src/modules/shopping/cart.service';
import { CheckoutService } from '../src/modules/checkout/checkout.service';
import { PaymentsService } from '../src/modules/checkout/payments.service';
import { CreateOrderDto } from '../src/modules/checkout/dto';

describe('Cart and checkout (database + HTTP)', () => {
  let app: NestExpressApplication, db: PrismaService, cart: CartService, checkout: CheckoutService, payments: PaymentsService;
  let userId: string, addressId: string, categoryId: string, token: string;
  let vendorIds: string[] = [], productIds: string[] = [];
  const suffix = randomUUID().slice(0, 8), code = `TEST_${suffix.toUpperCase()}`;
  const shopper = () => ({ kind: 'user' as const, userId });
  const http = () => request(app.getHttpServer());
  const signed = (body: string, secret = 'webhook-test') => createHmac('sha256', secret).update(body).digest('hex');
  beforeAll(async () => {
    if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('_test')) throw new Error('Checkout tests require a dedicated *_test database.');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestExpressApplication>({ rawBody: true }); configureApp(app); await app.init();
    db = app.get(PrismaService); cart = app.get(CartService); checkout = app.get(CheckoutService); payments = app.get(PaymentsService);
    app.get(ConfigService).set('RAZORPAY_KEY_SECRET', 'gateway-test');
    app.get(ConfigService).set('RAZORPAY_KEY_ID', 'rzp_test_test');
    app.get(ConfigService).set('RAZORPAY_WEBHOOK_SECRET', 'webhook-test');
    const user = await db.user.create({ data: { fullName: 'Checkout Test', mobile: `+918${Date.now().toString().slice(-9)}`, email: `checkout-${suffix}@example.com`, referralCode: suffix, termsAcceptedAt: new Date() } }); userId = user.id;
    token = app.get(JwtService).sign({ sub: userId, role: 'CUSTOMER', sid: randomUUID() }, { audience: 'trustlon:access' });
    await db.pincode.upsert({ where: { pincode: '560001' }, create: { pincode: '560001', city: 'Bengaluru', state: 'Karnataka' }, update: { city: 'Bengaluru', state: 'Karnataka', serviceable: true } });
    addressId = (await db.address.create({ data: { userId, fullName: 'Test buyer', mobile: user.mobile, line1: '123 Test Street', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' } })).id;
    categoryId = (await db.category.create({ data: { slug: `checkout-${suffix}`, name: 'Checkout tests' } })).id;
    for (let i = 0; i < 2; i++) {
      const vendor = await db.vendor.create({ data: { slug: `checkout-${suffix}-${i}`, displayName: `Vendor ${i}`, initials: 'VT', status: 'ACTIVE', pickupPincode: '560001' } }); vendorIds.push(vendor.id);
      const product = await db.product.create({ data: { vendorId: vendor.id, categoryId, slug: `checkout-${suffix}-${i}`, name: `Item ${i}`, pricePaise: 11800, mrpPaise: 15000, gstRateBps: 1800, imageUrl: '/test.png', stock: 10, status: 'LIVE' } }); productIds.push(product.id);
    }
    await db.coupon.create({ data: { code, value: 1000, startsAt: new Date(Date.now() - 10000), endsAt: new Date(Date.now() + 3600000) } });
  });
  beforeEach(async () => {
    await db.order.deleteMany({ where: { userId } });
    await db.cart.deleteMany({ where: { userId } });
    await db.walletEntry.deleteMany({ where: { userId } });
    await db.wallet.upsert({ where: { userId }, create: { userId, coins: 100 }, update: { coins: 100 } });
    await db.product.updateMany({ where: { id: { in: productIds } }, data: { stock: 10, pricePaise: 11800 } });
    await cart.addItem(shopper(), productIds[0], 2); await cart.addItem(shopper(), productIds[1], 1);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (!db) return;
    await db.order.deleteMany({ where: { userId } }); await db.user.delete({ where: { id: userId } });
    await db.product.deleteMany({ where: { id: { in: productIds } } }); await db.vendor.deleteMany({ where: { id: { in: vendorIds } } }); await db.category.delete({ where: { id: categoryId } }); await db.coupon.delete({ where: { code } }); await app.close();
  });
  async function input(): Promise<CreateOrderDto> {
    const dto = { addressId, paymentMethod: 'UPI' as const, deliveries: vendorIds.map(vendorId => ({ vendorId, method: 'standard' as const })) };
    const quote = await checkout.validate(userId, dto);
    return { ...dto, checkoutKey: randomUUID(), fingerprint: quote.fingerprint };
  }
  async function pending() {
    const order = await checkout.create(userId, await input());
    const gatewayId = `order_${randomUUID().replace(/-/g, '')}`;
    await db.order.update({ where: { id: order.id }, data: { razorpayOrderId: gatewayId } });
    return { order, payment: { id: `pay_${randomUUID().replace(/-/g, '')}`, order_id: gatewayId, amount: order.totalPaise, currency: 'INR', status: 'captured' } };
  }
  it('revalidates prices and stock on every GET and rejects unowned item mutations', async () => {
    await db.product.update({ where: { id: productIds[0] }, data: { pricePaise: 12000, stock: 0 } });
    const result = await http().get('/api/v1/cart').auth(token, { type: 'bearer' }).expect(200);
    expect(result.body.groups[0].items[0]).toMatchObject({ price: 12000, priceUpdated: true, stockStatus: 'out', available: false });
    await http().patch(`/api/v1/cart/items/${randomUUID()}`).auth(token, { type: 'bearer' }).send({ quantity: 1 }).expect(404);
  });
  it('expires guest carts and merges valid guests once with stock caps', async () => {
    const guestToken = randomUUID(); const guest = { kind: 'guest' as const, guestToken };
    await cart.addItem(guest, productIds[0], 2);
    await db.cart.update({ where: { guestToken }, data: { expiresAt: new Date(Date.now() - 1) } });
    expect((await cart.view(guest)).groups).toHaveLength(0);
    await cart.addItem(guest, productIds[0], 2); await db.product.update({ where: { id: productIds[0] }, data: { stock: 3 } });
    await cart.mergeGuestCart(guestToken, userId); await cart.mergeGuestCart(guestToken, userId);
    expect((await cart.view(shopper())).groups[0].items[0].quantity).toBe(3);
    expect(await db.cart.findUnique({ where: { guestToken } })).toBeNull();
  });
  it('applies/removes coupons, spends coins only in the quote, and moves wishlist items atomically', async () => {
    const applied = await http().post('/api/v1/cart/coupon').auth(token, { type: 'bearer' }).send({ code }).expect(200);
    expect(applied.body.summary.couponDiscount).toBe(3540);
    const removed = await http().delete('/api/v1/cart/coupon').auth(token, { type: 'bearer' }).expect(200); expect(removed.body.coupon).toBeNull();
    await http().post('/api/v1/cart/coupon').auth(token, { type: 'bearer' }).send({ code: 'INVALID' }).expect(400);
    const updated = await cart.change(shopper(), productIds[0], { coinsEnabled: true }); expect(updated.summary.coinsUsed).toBeGreaterThan(0);
    expect((await db.wallet.findUniqueOrThrow({ where: { userId } })).coins).toBe(100);
    const saved = await cart.change(shopper(), productIds[0], { moveToWishlist: true }); expect(saved.savedForLater).toHaveLength(1);
    expect(await db.wishlistItem.count({ where: { userId, productId: productIds[0] } })).toBe(1);
    expect((await cart.change(shopper(), productIds[0], { savedForLater: false })).savedForLater).toHaveLength(0);
  });
  it('calculates GST from shipping state and rejects forged prices', async () => {
    const local = await checkout.validate(userId, { addressId }); expect(local.tax).toMatchObject({ cgst: 2700, sgst: 2700, igst: 0 });
    await db.pincode.upsert({ where: { pincode: '400001' }, create: { pincode: '400001', city: 'Mumbai', state: 'Maharashtra' }, update: { state: 'Maharashtra', serviceable: true } });
    const away = await db.address.create({ data: { userId, fullName: 'Away', mobile: '+919999999999', line1: '123 Away', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' } });
    expect((await checkout.validate(userId, { addressId: away.id })).tax).toMatchObject({ cgst: 0, sgst: 0, igst: 5400 });
    await http().post('/api/v1/checkout/validate').auth(token, { type: 'bearer' }).send({ addressId, totalPaise: 1 }).expect(400);
  });
  it('creates one parent and one sub-order per vendor, reserves stock, and deduplicates retries', async () => {
    const dto = await input(); const order = await checkout.create(userId, dto); const again = await checkout.create(userId, dto);
    expect(again.id).toBe(order.id); expect(await db.subOrder.count({ where: { orderId: order.id } })).toBe(2);
    expect((await db.product.findUniqueOrThrow({ where: { id: productIds[0] } })).stock).toBe(8);
    expect(Date.parse(order.reservationExpiresAt!) - Date.now()).toBeGreaterThan(14 * 60000);
    expect(await db.walletEntry.count({ where: { userId } })).toBe(0);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('PENDING');
  });
  it('rejects an outdated quote without reserving stock', async () => {
    const dto = await input(); await db.product.update({ where: { id: productIds[0] }, data: { pricePaise: 12500 } });
    await expect(checkout.create(userId, dto)).rejects.toThrow('Prices or delivery details changed');
    expect((await db.product.findUniqueOrThrow({ where: { id: productIds[0] } })).stock).toBe(10);
  });
  it('releases expired reservations and coins exactly once and restores the cart', async () => {
    await cart.change(shopper(), productIds[0], { coinsEnabled: true });
    const order = await checkout.create(userId, await input());
    await db.order.update({ where: { id: order.id }, data: { reservationExpiresAt: new Date(Date.now() - 1) } });
    await checkout.cleanup(); await checkout.cleanup();
    expect((await db.product.findUniqueOrThrow({ where: { id: productIds[0] } })).stock).toBe(10);
    expect((await db.wallet.findUniqueOrThrow({ where: { userId } })).coins).toBe(100);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).reservationState).toBe('EXPIRED');
    expect((await cart.view(shopper())).itemCount).toBe(3);
  });
  it('verifies signatures server-side and confirms only once across verify/webhook', async () => {
    const { order, payment } = await pending();
    const dto = { orderId: order.id, razorpay_order_id: payment.order_id, razorpay_payment_id: payment.id, razorpay_signature: 'a'.repeat(64) };
    await expect(payments.verify(userId, dto)).rejects.toThrow('signature');
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(payment), { status: 200 }));
    dto.razorpay_signature = signed(`${payment.order_id}|${payment.id}`, 'gateway-test');
    expect(await payments.verify(userId, dto)).toMatchObject({ confirmed: true });
    const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: payment } } });
    await http().post('/api/v1/webhooks/razorpay').set('Content-Type', 'application/json').set('X-Razorpay-Signature', signed(raw)).send(raw).expect(200);
    const confirmed = await db.order.findUniqueOrThrow({ where: { id: order.id } }); expect(confirmed.escrowStatus).toBe('HELD');
    expect(await db.subOrder.count({ where: { orderId: order.id, status: 'CONFIRMED' } })).toBe(2);
    expect((await db.product.findUniqueOrThrow({ where: { id: productIds[0] } })).stock).toBe(8);
    expect(await db.walletEntry.count({ where: { userId } })).toBe(0);
    await http().post('/api/v1/webhooks/razorpay').set('Content-Type', 'application/json').set('X-Razorpay-Signature', signed(raw)).send(raw + ' ').expect(400);
  });
  it('deduplicates concurrent webhooks and refuses wrong amounts', async () => {
    const { order, payment } = await pending();
    await expect(payments.confirm({ ...payment, amount: 1 })).rejects.toThrow('amount');
    await Promise.all([payments.confirm(payment), payments.confirm(payment)]);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('PAID');
  });
  it('releases failed payments once and never confirms late captures', async () => {
    const { order, payment } = await pending();
    const raw = Buffer.from(JSON.stringify({ event: 'payment.failed', payload: { payment: { entity: { ...payment, status: 'failed' } } } }));
    await payments.webhook(raw, signed(raw.toString())); await payments.webhook(raw, signed(raw.toString()));
    expect((await db.product.findUniqueOrThrow({ where: { id: productIds[0] } })).stock).toBe(10);
    expect(await payments.confirm(payment)).toMatchObject({ confirmed: false });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).escrowStatus).toBe('REFUND_REQUIRED');
  });
});
