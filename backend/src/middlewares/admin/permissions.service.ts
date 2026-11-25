import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ALL_PERMISSIONS, DEFAULT_PERMISSIONS, Permission } from './permissions';

const CACHE_MS = 30_000;

/** The live role → permissions matrix (defaults overridden from Staff > Roles). */
@Injectable()
export class PermissionsService {
  private cache: { value: Map<UserRole, Set<Permission>>; until: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async forRole(role: UserRole): Promise<Permission[]> {
    if (role === UserRole.SUPER_ADMIN) return ALL_PERMISSIONS;
    const matrix = await this.matrix();
    return [...(matrix.get(role) ?? [])];
  }

  async has(role: UserRole, permission: Permission): Promise<boolean> {
    if (role === UserRole.SUPER_ADMIN) return true;
    return (await this.matrix()).get(role)?.has(permission) ?? false;
  }

  /** For checks inside a route, e.g. CSV export needs "orders:export" on top of "orders:view". */
  async assert(role: UserRole, permission: Permission): Promise<void> {
    if (!(await this.has(role, permission)))
      throw new ForbiddenException('Your role does not allow this');
  }

  clear(): void {
    this.cache = null;
  }

  private async matrix(): Promise<Map<UserRole, Set<Permission>>> {
    if (this.cache && this.cache.until > Date.now()) return this.cache.value;
    const rows = await this.prisma.rolePermission.findMany();
    const saved = new Map(rows.map((row) => [row.role, row.permissions]));
    const value = new Map<UserRole, Set<Permission>>();
    for (const role of Object.values(UserRole)) {
      const list = saved.get(role) ?? DEFAULT_PERMISSIONS[role];
      value.set(
        role,
        new Set(list.filter((x): x is Permission => ALL_PERMISSIONS.includes(x as Permission))),
      );
    }
    this.cache = { value, until: Date.now() + CACHE_MS };
    return value;
  }
}
