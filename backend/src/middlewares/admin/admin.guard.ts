import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import type { Request, Response } from 'express';
import { ACCESS_TOKEN_AUDIENCE, AccessTokenPayload, AuthUser } from '../auth/auth-user';
import { PermissionsService } from './permissions.service';
import { PERMISSION_KEY, SUPER_ADMIN_KEY } from './metadata';
import { Permission, STAFF_ROLES } from './permissions';

/**
 * Protects every admin panel route: a valid access token from a two-factor session, a staff
 * role, and the permission named with @Can (checked against the live role matrix).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Authentication required');

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(header.slice(7), {
        audience: ACCESS_TOKEN_AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException('Session expired');
    }
    if (payload.mfa !== true) {
      throw new UnauthorizedException('Sign in to the admin panel with two-factor authentication');
    }
    if (!STAFF_ROLES.includes(payload.role)) {
      throw new ForbiddenException('You do not have access to the admin panel');
    }
    request.user = { id: payload.sub, role: payload.role, sessionId: payload.sid, mfa: true };
    // Admin responses hold private data: never cache them.
    context.switchToHttp().getResponse<Response>().setHeader('Cache-Control', 'private, no-store');

    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(SUPER_ADMIN_KEY, targets)) {
      if (payload.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('Only a Super Admin can do this');
      }
      return true;
    }
    const required = this.reflector.getAllAndOverride<Permission | undefined>(
      PERMISSION_KEY,
      targets,
    );
    if (required && !(await this.permissions.has(payload.role, required))) {
      throw new ForbiddenException('Your role does not allow this');
    }
    return true;
  }
}
