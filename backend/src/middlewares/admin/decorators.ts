import { applyDecorators, Controller, SetMetadata, UseGuards } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { PERMISSION_KEY, SUPER_ADMIN_KEY } from './metadata';
import { AdminAction, AdminModule } from './permissions';

/**
 * An admin panel controller under /api/v1/admin/<path>. Every route needs a two-factor staff
 * session; add @Can or @SuperAdminOnly to a route (or the class) to require more.
 */
export const AdminController = (path: string) =>
  applyDecorators(Controller(path ? `admin/${path}` : 'admin'), UseGuards(AdminGuard));

/** The route needs this permission from the role matrix (5.10). */
export const Can = (module: AdminModule, action: AdminAction) =>
  SetMetadata(PERMISSION_KEY, `${module}:${action}`);

/** Only a Super Admin can use the route (e.g. business rules BR-01 to BR-14). */
export const SuperAdminOnly = () => SetMetadata(SUPER_ADMIN_KEY, true);
