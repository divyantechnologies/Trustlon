import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ACCESS_TOKEN_AUDIENCE, AccessTokenPayload, AuthUser } from './auth-user';

/**
 * For endpoints that work for both guests and signed-in users (cart, recently viewed).
 * No Authorization header: the request continues as a guest.
 * An invalid or expired token: 401, so the client refreshes instead of silently becoming a guest.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = request.headers.authorization;
    if (!header) return true;
    if (!header.startsWith('Bearer ')) throw new UnauthorizedException('Session expired');

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(header.slice(7), {
        audience: ACCESS_TOKEN_AUDIENCE,
      });
      request.user = { id: payload.sub, role: payload.role, sessionId: payload.sid };
      return true;
    } catch {
      throw new UnauthorizedException('Session expired');
    }
  }
}
