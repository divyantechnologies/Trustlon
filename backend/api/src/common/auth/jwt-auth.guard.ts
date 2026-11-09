import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ACCESS_TOKEN_AUDIENCE, AccessTokenPayload, AuthUser } from './auth-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required');
    }

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
