import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from '../auth/auth-user';

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string | null;
  summary?: string | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
}

export interface Actor {
  id: string;
  role: UserRole;
  ip?: string;
}

type Db = PrismaService | Prisma.TransactionClient;

const json = (value: unknown) =>
  value === undefined || value === null
    ? Prisma.DbNull
    : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);

/** Writes the audit log (5.10): actor, action, entity, before and after, IP, time. */
@Injectable()
export class AuditService {
  private names = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  /** Pass a transaction client so the log row commits with the change it describes. */
  async log(actor: Actor, entry: AuditEntry, db: Db = this.prisma): Promise<void> {
    await db.auditLog.create({
      data: {
        actorId: actor.id,
        actorName: await this.nameOf(actor.id),
        actorRole: actor.role,
        action: entry.action.slice(0, 60),
        entity: entry.entity.slice(0, 40),
        entityId: entry.entityId?.slice(0, 120) ?? null,
        summary: entry.summary?.slice(0, 300) ?? null,
        reason: entry.reason?.slice(0, 500) ?? null,
        before: json(entry.before),
        after: json(entry.after),
        ip: actor.ip?.slice(0, 45) ?? null,
      },
    });
  }

  private async nameOf(userId: string): Promise<string | null> {
    const hit = this.names.get(userId);
    if (hit) return hit;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });
    if (user) this.names.set(userId, user.fullName);
    return user?.fullName ?? null;
  }
}

/** The signed-in staff member plus the request IP, for AuditService.log. */
export function actorOf(user: AuthUser, request: Request): Actor {
  return { id: user.id, role: user.role, ip: request.ip };
}
