import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser } from '../auth/auth-user';

/** Header the storefront sends with its guest token (stored in localStorage as `tl_guest_cart`). */
export const GUEST_TOKEN_HEADER = 'x-guest-token';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Who the cart, recently viewed list and recommendations belong to. */
export type Shopper = { kind: 'user'; userId: string } | { kind: 'guest'; guestToken: string };

export function readShopper(request: Request & { user?: AuthUser }): Shopper | null {
  if (request.user) return { kind: 'user', userId: request.user.id };
  const header = request.headers[GUEST_TOKEN_HEADER];
  const token = Array.isArray(header) ? header[0] : header;
  if (token && UUID.test(token)) return { kind: 'guest', guestToken: token.toLowerCase() };
  return null;
}

/**
 * Use with OptionalJwtAuthGuard. Resolves the signed-in user, else the guest token header.
 * `required: false` returns null instead of rejecting when neither is present.
 */
export const CurrentShopper = createParamDecorator(
  (options: { required?: boolean } | undefined, ctx: ExecutionContext): Shopper | null => {
    const shopper = readShopper(ctx.switchToHttp().getRequest());
    if (!shopper && options?.required !== false) {
      throw new BadRequestException(
        `Sign in, or send a guest token in the ${GUEST_TOKEN_HEADER} header (a UUID)`,
      );
    }
    return shopper;
  },
);

/** Prisma `where` fragment for rows owned by this shopper (tables with userId and guestToken). */
export function ownerWhere(shopper: Shopper): { userId: string } | { guestToken: string } {
  return shopper.kind === 'user' ? { userId: shopper.userId } : { guestToken: shopper.guestToken };
}
