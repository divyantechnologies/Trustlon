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
import { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/auth/optional-jwt-auth.guard';
import { CurrentShopper, Shopper } from '../../common/shopper/shopper';
import { CartService } from './cart.service';
import { AddCartItemDto, ProductRefDto, SetQuantityDto } from './dto';
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

  @Patch('items/:productId')
  setQuantity(
    @CurrentShopper() shopper: Shopper,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: SetQuantityDto,
  ) {
    return this.cart.setQuantity(shopper, productId, dto.quantity);
  }

  @Delete('items/:productId')
  remove(@CurrentShopper() shopper: Shopper, @Param('productId', ParseUUIDPipe) productId: string) {
    return this.cart.removeItem(shopper, productId);
  }

  @Delete()
  clear(@CurrentShopper() shopper: Shopper) {
    return this.cart.clear(shopper);
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
