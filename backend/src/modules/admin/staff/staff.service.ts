import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { skip } from '../../../middlewares/admin/admin-query';
import { Actor, AuditService } from '../../../middlewares/admin/audit.service';
import { EXPORT_LIMIT, toCsv } from '../../../middlewares/admin/csv';
import {
  ADMIN_ACTIONS,
  ADMIN_MODULES,
  ALL_PERMISSIONS,
  DEFAULT_PERMISSIONS,
  MODULE_ACTIONS,
  Permission,
  ROLE_PANELS,
  STAFF_ROLES,
} from '../../../middlewares/admin/permissions';
import { PermissionsService } from '../../../middlewares/admin/permissions.service';
import { toPage } from '../../../utils/http/pagination';
import { PrismaService } from '../../../database/prisma.service';
import { BCRYPT_ROUNDS } from '../../auth/auth.constants';
import { SessionService } from '../../auth/services/session.service';
import { addDays, istDayStart } from '../shared';
import { AuditQuery, CreateStaffDto, UpdateStaffDto } from './dto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** 14 characters with upper, lower and a digit, so it passes the password rule. */
function temporaryPassword(): string {
  const bytes = randomBytes(14);
  let out = '';
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return `${out.slice(0, 11)}A7z`;
}

function referralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'TL';
  for (const byte of randomBytes(8)) code += chars[byte % chars.length];
  return code;
}

/** Staff, roles and the audit log (5.10). */
@Injectable()
export class AdminStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly permissions: PermissionsService,
    private readonly sessions: SessionService,
  ) {}

  async list() {
    const rows = await this.prisma.user.findMany({
      where: { role: { in: STAFF_ROLES }, deletedAt: null },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      include: { staffMfa: { select: { confirmedAt: true, recoveryCodes: true } } },
    });
    return {
      items: rows.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        mobile: u.mobile,
        role: u.role,
        panels: ROLE_PANELS[u.role],
        status: u.status,
        twoFactor: u.staffMfa?.confirmedAt ? 'on' : 'not_set_up',
        recoveryCodesLeft: u.staffMfa?.recoveryCodes.length ?? 0,
        mustChangePassword: u.mustChangePassword,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      })),
    };
  }

  async create(dto: CreateStaffDto, actor: Actor) {
    if (dto.role === UserRole.SUPER_ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only a Super Admin can add another Super Admin');
    }
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { mobile: dto.mobile }] },
    });
    if (existing) {
      if (!dto.promoteExisting || existing.email !== dto.email) {
        throw new ConflictException({
          statusCode: 409,
          message:
            existing.email === dto.email
              ? 'Someone already has an account with this email. Tick "Use the existing account" to give it this role.'
              : 'This mobile number belongs to another account',
          field: existing.email === dto.email ? 'email' : 'mobile',
        });
      }
      if (STAFF_ROLES.includes(existing.role))
        throw new ConflictException({
          statusCode: 409,
          message: 'This person is already staff',
          field: 'email',
        });
      if (existing.role !== UserRole.CUSTOMER)
        throw new ConflictException({
          statusCode: 409,
          message: 'Vendor accounts can’t be made staff',
          field: 'email',
        });
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: existing.id }, data: { role: dto.role } });
        await this.audit.log(
          actor,
          {
            action: 'staff.promote',
            entity: 'staff',
            entityId: existing.id,
            summary: existing.email,
            before: { role: existing.role },
            after: { role: dto.role },
          },
          tx,
        );
      });
      await this.sessions.revokeAllForUser(existing.id, 'role_changed');
      return { id: existing.id, temporaryPassword: null, promoted: true };
    }
    const password = temporaryPassword();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const user = await this.prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              fullName: dto.fullName,
              email: dto.email,
              mobile: dto.mobile,
              role: dto.role,
              passwordHash,
              passwordChangedAt: new Date(),
              mustChangePassword: true,
              referralCode: referralCode(),
              termsAcceptedAt: new Date(),
            },
          });
          await this.audit.log(
            actor,
            {
              action: 'staff.create',
              entity: 'staff',
              entityId: created.id,
              summary: created.email,
              after: { fullName: dto.fullName, role: dto.role },
            },
            tx,
          );
          return created;
        });
        return { id: user.id, temporaryPassword: password, promoted: false };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          String(error.meta?.target ?? '').includes('referral')
        )
          continue;
        throw error;
      }
    }
    throw new ConflictException('Please try again');
  }

  async update(id: string, dto: UpdateStaffDto, actor: Actor) {
    const user = await this.staffMember(id);
    if (id === actor.id) throw new BadRequestException('You can’t change your own role or status');
    const touchesSuper = user.role === UserRole.SUPER_ADMIN || dto.role === UserRole.SUPER_ADMIN;
    if (touchesSuper && actor.role !== UserRole.SUPER_ADMIN)
      throw new ForbiddenException('Only a Super Admin can change a Super Admin');
    if (dto.role === undefined && dto.status === undefined)
      throw new BadRequestException('Choose a new role or status');
    const losesSuper =
      user.role === UserRole.SUPER_ADMIN &&
      ((dto.role !== undefined && dto.role !== UserRole.SUPER_ADMIN) ||
        dto.status === UserStatus.BLOCKED);
    if (losesSuper) {
      const others = await this.prisma.user.count({
        where: {
          role: UserRole.SUPER_ADMIN,
          status: UserStatus.ACTIVE,
          deletedAt: null,
          id: { not: id },
        },
      });
      if (others === 0)
        throw new ConflictException('There must always be at least one active Super Admin');
    }
    const data: Prisma.UserUpdateInput = {
      ...(dto.role !== undefined ? { role: dto.role } : {}),
      ...(dto.status !== undefined
        ? {
            status: dto.status,
            blockedReason: dto.status === UserStatus.BLOCKED ? dto.reason : null,
          }
        : {}),
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data });
      await this.audit.log(
        actor,
        {
          action: dto.role === UserRole.CUSTOMER ? 'staff.remove' : 'staff.update',
          entity: 'staff',
          entityId: id,
          summary: user.email,
          reason: dto.reason,
          before: { role: user.role, status: user.status },
          after: { role: dto.role ?? user.role, status: dto.status ?? user.status },
        },
        tx,
      );
    });
    // New permissions apply from the next sign-in.
    await this.sessions.revokeAllForUser(id, 'role_changed');
    return this.list();
  }

  async resetTwoFactor(id: string, reason: string, actor: Actor) {
    const user = await this.staffMember(id);
    if (user.role === UserRole.SUPER_ADMIN && actor.role !== UserRole.SUPER_ADMIN)
      throw new ForbiddenException('Only a Super Admin can do this');
    await this.prisma.$transaction(async (tx) => {
      await tx.staffMfa.deleteMany({ where: { userId: id } });
      await this.audit.log(
        actor,
        { action: 'staff.reset_2fa', entity: 'staff', entityId: id, summary: user.email, reason },
        tx,
      );
    });
    await this.sessions.revokeAllForUser(id, '2fa_reset');
    return this.list();
  }

  async resetPassword(id: string, reason: string, actor: Actor) {
    const user = await this.staffMember(id);
    if (id === actor.id) throw new BadRequestException('Change your own password from My account');
    if (user.role === UserRole.SUPER_ADMIN && actor.role !== UserRole.SUPER_ADMIN)
      throw new ForbiddenException('Only a Super Admin can do this');
    const password = temporaryPassword();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
          passwordChangedAt: new Date(),
          mustChangePassword: true,
        },
      });
      await this.audit.log(
        actor,
        {
          action: 'staff.reset_password',
          entity: 'staff',
          entityId: id,
          summary: user.email,
          reason,
        },
        tx,
      );
    });
    await this.sessions.revokeAllForUser(id, 'password_reset');
    return { temporaryPassword: password };
  }

  async roles() {
    const rows = await this.prisma.rolePermission.findMany();
    const saved = new Map(rows.map((row) => [row.role, row]));
    const counts = await this.prisma.user.groupBy({
      by: ['role'],
      where: { role: { in: STAFF_ROLES }, deletedAt: null },
      _count: { _all: true },
    });
    const members = new Map(counts.map((c) => [c.role, c._count._all]));
    return {
      modules: ADMIN_MODULES.map((module) => ({ module, actions: MODULE_ACTIONS[module] })),
      actions: ADMIN_ACTIONS,
      roles: STAFF_ROLES.map((role) => ({
        role,
        editable: role !== UserRole.SUPER_ADMIN,
        panels: ROLE_PANELS[role],
        members: members.get(role) ?? 0,
        permissions:
          role === UserRole.SUPER_ADMIN
            ? ALL_PERMISSIONS
            : (saved.get(role)?.permissions ?? DEFAULT_PERMISSIONS[role]),
        customised: saved.has(role),
        updatedAt: saved.get(role)?.updatedAt ?? null,
      })),
    };
  }

  async setRole(role: UserRole, permissions: string[], actor: Actor) {
    if (!STAFF_ROLES.includes(role)) throw new NotFoundException('Unknown staff role');
    if (role === UserRole.SUPER_ADMIN)
      throw new BadRequestException('Super Admin always has every permission');
    const unknown = permissions.filter((p) => !ALL_PERMISSIONS.includes(p as Permission));
    if (unknown.length) throw new BadRequestException(`Unknown permission: ${unknown[0]}`);
    // "view" is needed for any other action on the same module.
    const clean = [...new Set(permissions)] as Permission[];
    for (const p of clean) {
      const [module] = p.split(':');
      const view = `${module}:view` as Permission;
      if (!clean.includes(view)) clean.push(view);
    }
    const before =
      (await this.prisma.rolePermission.findUnique({ where: { role } }))?.permissions ??
      DEFAULT_PERMISSIONS[role];
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.upsert({
        where: { role },
        create: { role, permissions: clean, updatedById: actor.id },
        update: { permissions: clean, updatedById: actor.id },
      });
      await this.audit.log(
        actor,
        {
          action: 'role.update',
          entity: 'role',
          entityId: role,
          summary: role,
          before,
          after: clean,
        },
        tx,
      );
    });
    this.permissions.clear();
    return this.roles();
  }

  async resetRole(role: UserRole, actor: Actor) {
    if (role === UserRole.SUPER_ADMIN)
      throw new BadRequestException('Super Admin always has every permission');
    const before = await this.prisma.rolePermission.findUnique({ where: { role } });
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { role } });
      await this.audit.log(
        actor,
        {
          action: 'role.reset',
          entity: 'role',
          entityId: role,
          summary: role,
          before: before?.permissions ?? null,
          after: DEFAULT_PERMISSIONS[role],
        },
        tx,
      );
    });
    this.permissions.clear();
    return this.roles();
  }

  async auditLog(query: AuditQuery) {
    const q = query.q?.trim();
    const where: Prisma.AuditLogWhereInput = {
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.action ? { action: { startsWith: query.action } } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: istDayStart(query.from) } : {}),
              ...(query.to ? { lt: istDayStart(addDays(query.to, 1)) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { summary: { contains: q, mode: 'insensitive' } },
              { reason: { contains: q, mode: 'insensitive' } },
              { actorName: { contains: q, mode: 'insensitive' } },
              { entityId: { contains: q } },
              { action: { contains: q.toLowerCase() } },
            ],
          }
        : {}),
    };
    const csv = query.format === 'csv';
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: csv ? 0 : skip(query),
        take: csv ? EXPORT_LIMIT : query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    if (csv) {
      return toCsv(
        [
          'Time',
          'Staff',
          'Role',
          'Action',
          'Entity',
          'Entity ID',
          'Summary',
          'Reason',
          'Before',
          'After',
          'IP',
        ],
        rows.map((r) => [
          r.createdAt.toISOString(),
          r.actorName,
          r.actorRole,
          r.action,
          r.entity,
          r.entityId,
          r.summary,
          r.reason,
          r.before === null ? '' : JSON.stringify(r.before),
          r.after === null ? '' : JSON.stringify(r.after),
          r.ip,
        ]),
      );
    }
    const [actors, entities] = await Promise.all([
      this.prisma.auditLog.findMany({
        distinct: ['actorId'],
        where: { actorId: { not: null } },
        select: { actorId: true, actorName: true },
        take: 200,
      }),
      this.prisma.auditLog.findMany({ distinct: ['entity'], select: { entity: true }, take: 100 }),
    ]);
    return {
      ...toPage(rows, total, query.page, query.pageSize),
      filters: {
        actors: actors.map((a) => ({ id: a.actorId, name: a.actorName })),
        entities: entities.map((e) => e.entity).sort(),
      },
    };
  }

  private async staffMember(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, role: { in: STAFF_ROLES } },
    });
    if (!user) throw new NotFoundException('Staff member not found');
    return user;
  }
}
