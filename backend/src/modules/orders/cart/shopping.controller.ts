import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthUser } from '../../../middlewares/auth/auth-user';
import { CurrentUser } from '../../../middlewares/auth/decorators';
import { JwtAuthGuard } from '../../../middlewares/auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../../middlewares/auth/optional-jwt-auth.guard';
import { CurrentShopper, Shopper } from '../../../utils/shopper/shopper';
import { CartService } from './cart.service';
import { AddCartItemDto, CouponDto, ProductRefDto, SetQuantityDto } from './dto';
import { RecentlyViewedService } from './recently-viewed.service';
import { WishlistService } from './wishlist.service';

/** Works for guests (x-guest-token header) and signed-in users (Bearer token). */
@Controller('cart')
@UseGuards(OptionalJwtAuthGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  view(@CurrentShopper() shopper: Shopper) {
    return this.cart.view(shopper);
  }

  @Post('items')
  @HttpCode(HttpStatus.OK)
  add(@CurrentShopper() shopper: Shopper, @Body() dto: AddCartItemDto) {
    return this.cart.addItem(shopper, dto.productId, dto.quantity);
  }

  @Patch('items/:id')
  setQuantity(
    @CurrentShopper() shopper: Shopper,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetQuantityDto,
  ) {
    return this.cart.change(shopper, id, dto);
  }

  @Delete('items/:id')
  remove(@CurrentShopper() shopper: Shopper, @Param('id', ParseUUIDPipe) id: string) {
    return this.cart.removeItem(shopper, id);
  }

  @Delete()
  clear(@CurrentShopper() shopper: Shopper) {
    return this.cart.clear(shopper);
  }

  @Post('coupon')
  @HttpCode(HttpStatus.OK)
  coupon(@CurrentShopper() shopper: Shopper, @Body() dto: CouponDto) {
    return this.cart.coupon(shopper, dto.code);
  }

  @Delete('coupon')
  removeCoupon(@CurrentShopper() shopper: Shopper) {
    return this.cart.coupon(shopper, null);
  }
}

@Controller('me/recently-viewed')
@UseGuards(OptionalJwtAuthGuard)
export class RecentlyViewedController {
  constructor(private readonly recent: RecentlyViewedService) {}

  @Get()
  async list(@CurrentShopper({ required: false }) shopper: Shopper | null) {
    return { items: shopper ? await this.recent.list(shopper) : [] };
  }

  /** Call when a product page or product preview opens. */
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async record(@CurrentShopper() shopper: Shopper, @Body() dto: ProductRefDto): Promise<void> {
    await this.recent.record(shopper, dto.productId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async clear(@CurrentShopper() shopper: Shopper): Promise<void> {
    await this.recent.clear(shopper);
  }
}

@Controller('me/wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return { items: await this.wishlist.list(user.id) };
  }

  /** Product ids only, for heart icons on product cards. */
  @Get('ids')
  async ids(@CurrentUser() user: AuthUser) {
    return { productIds: await this.wishlist.ids(user.id) };
  }

  @Put(':productId')
  add(@CurrentUser() user: AuthUser, @Param('productId', ParseUUIDPipe) productId: string) {
    return this.wishlist.add(user.id, productId);
  }

  @Delete(':productId')
  remove(@CurrentUser() user: AuthUser, @Param('productId', ParseUUIDPipe) productId: string) {
    return this.wishlist.remove(user.id, productId);
  }
}
