import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AUTH_EVENTS, UserLoggedInEvent } from '../auth/auth.constants';
import { CartService } from './cart.service';
import { RecentlyViewedService } from './recently-viewed.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * After sign-in, the guest's cart and recently viewed list move to the account.
 * Runs in the background right after the login response; the storefront reloads the cart
 * when the signed-in state changes.
 */
@Injectable()
export class ShoppingListener {
  private readonly logger = new Logger(ShoppingListener.name);

  constructor(
    private readonly cart: CartService,
    private readonly recent: RecentlyViewedService,
  ) {}

  @OnEvent(AUTH_EVENTS.USER_LOGGED_IN)
  async onLogin(event: UserLoggedInEvent): Promise<void> {
    const token = event.guestCartToken?.toLowerCase();
    if (!token || !UUID.test(token)) return;
    try {
      await this.cart.mergeGuestCart(token, event.userId);
      await this.recent.mergeGuest(token, event.userId);
    } catch (error) {
      this.logger.error(`Guest merge failed for user ${event.userId}`, error as Error);
    }
  }
}
