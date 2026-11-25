import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsUUID, Matches, ValidateNested } from 'class-validator';
import type { CheckoutPayment, DeliveryMethod } from '../../../../../shared/types/checkout';
export class DeliveryDto {
  @IsUUID() vendorId: string;
  @IsIn(['standard', 'express', 'same-day']) method: DeliveryMethod;
}
export class ValidateCheckoutDto {
  @IsOptional() @IsUUID() addressId?: string;
  @IsOptional() @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/) gstin?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => DeliveryDto)
  deliveries?: DeliveryDto[];
  @IsOptional() @IsIn(['UPI', 'CARD', 'NETBANKING', 'WALLET', 'EMI', 'COD', 'TRUSTLON_WALLET']) paymentMethod?: CheckoutPayment;
}
export class CreateOrderDto extends ValidateCheckoutDto {
  @IsUUID() checkoutKey: string;
  @Matches(/^[a-f0-9]{64}$/) fingerprint: string;
}
export class RazorpayOrderDto { @IsUUID() orderId: string; }
export class VerifyPaymentDto extends RazorpayOrderDto {
  @Matches(/^order_[A-Za-z0-9]+$/) razorpay_order_id: string;
  @Matches(/^pay_[A-Za-z0-9]+$/) razorpay_payment_id: string;
  @Matches(/^[a-f0-9]{64}$/i) razorpay_signature: string;
}
