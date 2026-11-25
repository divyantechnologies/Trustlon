import { Body, Controller, Headers, HttpCode, Post, RawBodyRequest, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser } from '../../../middlewares/auth/auth-user';
import { CurrentUser } from '../../../middlewares/auth/decorators';
import { JwtAuthGuard } from '../../../middlewares/auth/jwt-auth.guard';
import { CheckoutService } from './checkout.service';
import { PaymentsService } from './payments.service';
import { CreateOrderDto, RazorpayOrderDto, ValidateCheckoutDto, VerifyPaymentDto } from './dto';
@Controller()
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService, private readonly payments: PaymentsService) {}
  @Post('checkout/validate') @HttpCode(200) @UseGuards(JwtAuthGuard)
  validate(@CurrentUser() user: AuthUser, @Body() dto: ValidateCheckoutDto) { return this.checkout.validate(user.id, dto); }
  @Post('orders') @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) { return this.checkout.create(user.id, dto); }
  @Post('payments/razorpay/order') @HttpCode(200) @UseGuards(JwtAuthGuard)
  order(@CurrentUser() user: AuthUser, @Body() dto: RazorpayOrderDto) { return this.payments.order(user.id, dto.orderId); }
  @Post('payments/razorpay/verify') @HttpCode(200) @UseGuards(JwtAuthGuard)
  verify(@CurrentUser() user: AuthUser, @Body() dto: VerifyPaymentDto) { return this.payments.verify(user.id, dto); }
  @Post('webhooks/razorpay') @HttpCode(200)
  webhook(@Req() request: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature: string) { return this.payments.webhook(request.rawBody, signature ?? ''); }
}
