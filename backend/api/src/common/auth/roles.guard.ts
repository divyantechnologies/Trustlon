import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { AuthUser } from './auth-user';
import { ROLES_KEY } from './decorators';

/**
 * Use together with JwtAuthGuard: @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.SUPER_ADMIN)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (!request.user || !required.includes(request.user.role)) {
      throw new ForbiddenException('You do not have access to this resource');
    }
    return true;
  }
}
