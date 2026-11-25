import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';
import { CheckoutService } from './checkout.service';
import { VerifyPaymentDto } from './dto';

export function validSignature(body: string | Buffer, signature: string, secret: string) {
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
type GatewayPayment = { id: string; order_id: string; amount: number; currency: string; status: string };
@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService, private readonly checkout: CheckoutService, private readonly config: ConfigService) {}
  private secret(name: string) {
    const value = this.config.get<string>(name);
    if (!value) throw new ServiceUnavailableException('Payments are being configured. Please try again later.');
    return value;
  }
  private async gateway(path: string, body?: object) {
    const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
      method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Basic ${Buffer.from(`${this.secret('RAZORPAY_KEY_ID')}:${this.secret('RAZORPAY_KEY_SECRET')}`).toString('base64')}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new ServiceUnavailableException('The payment provider could not complete this request. Please try again.');
    return response.json();
  }
  async order(userId: string, orderId: string) {
    const keyId = this.secret('RAZORPAY_KEY_ID');
    this.secret('RAZORPAY_KEY_SECRET');
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.reservationState !== 'RESERVED' || !order.reservationExpiresAt || order.reservationExpiresAt <= new Date()) throw new ConflictException('This checkout has expired or is already complete.');
    if (order.razorpayOrderId) return { keyId, orderId: order.razorpayOrderId, amount: order.totalPaise, currency: 'INR' };
    const claimed = await this.prisma.order.updateMany({ where: { id: orderId, gatewayCreating: false, razorpayOrderId: null, reservationState: 'RESERVED' }, data: { gatewayCreating: true } });
    if (!claimed.count) throw new ConflictException('Payment setup is processing. Please wait before retrying.');
    // Retain the claim after ambiguous network failures: never create a second chargeable gateway order.
    const remote = await this.gateway('orders', { amount: order.totalPaise, currency: 'INR', receipt: order.id, notes: { trustlonOrderId: order.id } }) as { id: string; amount: number; currency: string };
    if (typeof remote.id !== 'string' || remote.amount !== order.totalPaise || remote.currency !== 'INR') throw new ServiceUnavailableException('Unexpected payment provider response.');
    await this.prisma.order.update({ where: { id: orderId }, data: { razorpayOrderId: remote.id, gatewayCreating: false } });
    return { keyId, orderId: remote.id as string, amount: order.totalPaise, currency: 'INR' };
  }
  async verify(userId: string, dto: VerifyPaymentDto) {
    const order = await this.prisma.order.findFirst({ where: { id: dto.orderId, userId } });
    if (!order || order.razorpayOrderId !== dto.razorpay_order_id) throw new BadRequestException('Payment does not belong to this order.');
    if (!validSignature(`${order.razorpayOrderId}|${dto.razorpay_payment_id}`, dto.razorpay_signature, this.secret('RAZORPAY_KEY_SECRET'))) throw new BadRequestException('Payment signature is invalid.');
    const payment = await this.gateway(`payments/${encodeURIComponent(dto.razorpay_payment_id)}`) as GatewayPayment;
    if (payment.id !== dto.razorpay_payment_id || payment.status !== 'captured') throw new ConflictException('Your payment is processing. Confirmation will follow after capture.');
    return this.confirm(payment);
  }
  async confirm(payment: GatewayPayment) {
    return this.prisma.$transaction(async tx => {
      const found = await tx.order.findUnique({ where: { razorpayOrderId: payment.order_id } });
      if (!found) throw new BadRequestException('Unknown payment order.');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${found.id}))`;
      const order = await tx.order.findUniqueOrThrow({ where: { id: found.id }, include: { subOrders: true } });
      if (payment.amount !== order.totalPaise || payment.currency !== 'INR' || payment.status !== 'captured') throw new BadRequestException('Payment amount or status does not match.');
      if (order.razorpayPaymentId && order.razorpayPaymentId !== payment.id) throw new ConflictException('A different payment is already linked to this order.');
      if (order.confirmedAt) return { confirmed: true, orderId: order.id };
      if (order.reservationState !== 'RESERVED' || !order.reservationExpiresAt || order.reservationExpiresAt <= new Date() || order.subOrders.some(s => s.status === 'CANCELLED')) {
        // A late payment is recorded for reconciliation, never used to resurrect released inventory.
        await tx.order.update({ where: { id: order.id }, data: { razorpayPaymentId: payment.id, escrowStatus: 'REFUND_REQUIRED' } });
        return { confirmed: false, orderId: order.id, message: 'Payment received after the reservation closed. Support will reconcile the payment.' };
      }
      const changed = await tx.order.updateMany({ where: { id: order.id, reservationState: 'RESERVED', confirmedAt: null }, data: {
        paymentStatus: 'PAID', razorpayPaymentId: payment.id, paymentReference: payment.id,
        reservationState: 'CONSUMED', confirmedAt: new Date(), escrowStatus: 'HELD',
      } });
      if (changed.count) await tx.subOrder.updateMany({ where: { orderId: order.id, status: 'PLACED' }, data: { status: 'CONFIRMED' } });
      // No seller credit, transfer, payable ledger or payout is created here.
      return { confirmed: true, orderId: order.id };
    });
  }
  async webhook(raw: Buffer | undefined, signature: string) {
    if (!raw || !validSignature(raw, signature, this.secret('RAZORPAY_WEBHOOK_SECRET'))) throw new BadRequestException('Webhook signature is invalid.');
    let event: { event?: string; payload?: { payment?: { entity?: GatewayPayment } } };
    try { event = JSON.parse(raw.toString('utf8')); } catch { throw new BadRequestException('Invalid webhook body.'); }
    const payment = event.payload?.payment?.entity;
    if (!['payment.captured', 'order.paid', 'payment.failed'].includes(event.event ?? '')) return { received: true };
    if (!payment || !/^pay_[A-Za-z0-9]+$/.test(payment.id) || !/^order_[A-Za-z0-9]+$/.test(payment.order_id)) throw new BadRequestException('Invalid webhook payment.');
    if (event.event === 'payment.failed') {
      const order = await this.prisma.order.findUnique({ where: { razorpayOrderId: payment.order_id } });
      if (order && payment.amount === order.totalPaise && payment.currency === 'INR' && payment.status === 'failed') await this.checkout.release(order.id, 'FAILED');
    } else await this.confirm(payment);
    return { received: true };
  }
}
