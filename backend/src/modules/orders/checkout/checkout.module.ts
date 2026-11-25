import { Module } from '@nestjs/common';
import { ShoppingModule } from '../cart/shopping.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { PaymentsService } from './payments.service';
@Module({ imports: [ShoppingModule], controllers: [CheckoutController], providers: [CheckoutService, PaymentsService] })
export class CheckoutModule {}
