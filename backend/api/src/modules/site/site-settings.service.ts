import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Language, Prisma } from '@prisma/client';
import { z } from 'zod';
import { Actor, AuditService } from '../../common/admin/audit.service';
import { maskSecret } from '../../common/security/crypto';
import { Encryption } from '../../common/security/security.module';
import { PrismaService } from '../../prisma/prisma.service';
import {
  deepMerge,
  readSettings,
  SECRET_FIELDS,
  SETTING_SCHEMAS,
  SettingGroup,
  SettingValue,
  ThemeSettings,
} from './site-settings.schema';

/** Settings are read on most requests; keep them in memory briefly. Saving clears this. */
const CACHE_MS = 30_000;

/** Keys look like "signup.title" or "sell.hero.title". */
export const CONTENT_KEY = /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+){1,5}$/;

type Json = Record<string, unknown>;

const getPath = (value: Json, path: string[]): unknown =>
  path.reduce<unknown>(
    (node, key) => (node && typeof node === 'object' ? (node as Json)[key] : undefined),
    value,
  );

const setPath = (value: Json, path: string[], next: unknown): void => {
  let node = value;
  for (const key of path.slice(0, -1)) {
    if (!node[key] || typeof node[key] !== 'object') node[key] = {};
    node = node[key] as Json;
  }
  node[path[path.length - 1]] = next;
};

@Injectable()
export class SiteSettingsService {
  private cache = new Map<string, { value: unknown; until: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly encryption: Encryption,
  ) {}

  /** Current value of a settings group, with defaults filled in. Secrets stay encrypted. */
  async get<G extends SettingGroup>(group: G): Promise<SettingValue<G>> {
    const hit = this.cache.get(group);
    if (hit && hit.until > Date.now()) return hit.value as SettingValue<G>;
    const row = await this.prisma.siteSetting.findUnique({ where: { key: group } });
    const value = readSettings(
      SETTING_SCHEMAS[group] as z.ZodTypeAny,
      row?.value,
    ) as SettingValue<G>;
    this.cache.set(group, { value, until: Date.now() + CACHE_MS });
    return value;
  }

  theme(): Promise<ThemeSettings> {
    return this.get('theme');
  }

  /** A decrypted secret, e.g. secret('payments', ['gateway', 'keySecret']), for the code that needs it. */
  async secret(group: SettingGroup, path: string[]): Promise<string | null> {
    const sealed = getPath((await this.get(group)) as Json, path);
    return typeof sealed === 'string' && sealed ? this.encryption.decrypt(sealed) : null;
  }

  /** What every visitor's browser needs: theme, features and a few public rules. */
  async publicConfig() {
    const [theme, features, rules] = await Promise.all([
      this.theme(),
      this.get('features'),
      this.get('business-rules'),
    ]);
    const latest = await this.prisma.contentEntry.aggregate({ _max: { updatedAt: true } });
    const { deleteReasons, ...flags } = features;
    return {
      theme,
      features: flags,
      account: { deleteReasons },
      sell: { callbackDays: rules.sellerCallbackDays },
      /** Changes when any text is edited, so browsers can refresh their copy. */
      contentVersion: latest._max.updatedAt?.getTime() ?? 0,
    };
  }

  /** A group as the admin panel sees it: secrets masked, plus version details. */
  async forAdmin(group: SettingGroup) {
    const [value, row] = await Promise.all([
      this.get(group),
      this.prisma.siteSetting.findUnique({
        where: { key: group },
        select: { version: true, updatedAt: true },
      }),
    ]);
    return {
      group,
      value: this.mask(group, value as Json),
      version: row?.version ?? 0,
      updatedAt: row?.updatedAt ?? null,
    };
  }

  /** Validates a partial update, saves it as a new version and writes the audit log. */
  async update(group: SettingGroup, patch: unknown, actor: Actor, reason?: string) {
    const before = (await this.get(group)) as Json;
    const incoming = JSON.parse(JSON.stringify(patch ?? {})) as Json;
    // Secret fields: empty means "keep the saved one"; anything else is encrypted.
    for (const path of SECRET_FIELDS[group] ?? []) {
      const value = getPath(incoming, path);
      if (
        value === undefined ||
        value === '' ||
        (typeof value === 'string' && value.startsWith('••••'))
      ) {
        if (getPath(incoming, path.slice(0, -1)) !== undefined)
          setPath(incoming, path, getPath(before, path));
      } else if (value === null) {
        setPath(incoming, path, null);
      } else if (typeof value === 'string') {
        setPath(incoming, path, this.encryption.encrypt(value));
      }
    }
    const parsed = (SETTING_SCHEMAS[group] as z.ZodTypeAny).safeParse(deepMerge(before, incoming));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new BadRequestException({
        statusCode: 400,
        message: issue.message,
        field: issue.path.join('.'),
      });
    }
    await this.save(group, parsed.data as Json, before, actor, reason ?? null, 'settings.update');
    return this.forAdmin(group);
  }

  /** Puts a group back to the built-in defaults (saved as a new version). */
  async reset(group: SettingGroup, actor: Actor) {
    const before = (await this.get(group)) as Json;
    const defaults = (SETTING_SCHEMAS[group] as z.ZodTypeAny).parse({}) as Json;
    await this.save(
      group,
      defaults,
      before,
      actor,
      'Restored the original settings',
      'settings.reset',
    );
    return this.forAdmin(group);
  }

  async versions(group: SettingGroup) {
    const rows = await this.prisma.settingVersion.findMany({
      where: { group },
      orderBy: { version: 'desc' },
      take: 50,
    });
    return rows.map((row) => ({
      version: row.version,
      by: row.changedByName ?? 'System',
      reason: row.reason,
      at: row.createdAt,
      value: this.mask(
        group,
        readSettings(SETTING_SCHEMAS[group] as z.ZodTypeAny, row.value) as Json,
      ),
    }));
  }

  /** Makes an earlier version current again, as a new version. */
  async restore(group: SettingGroup, version: number, actor: Actor) {
    const row = await this.prisma.settingVersion.findUnique({
      where: { group_version: { group, version } },
    });
    if (!row) throw new NotFoundException('Version not found');
    const before = (await this.get(group)) as Json;
    const value = readSettings(SETTING_SCHEMAS[group] as z.ZodTypeAny, row.value) as Json;
    await this.save(group, value, before, actor, `Restored version ${version}`, 'settings.restore');
    return this.forAdmin(group);
  }

  private async save(
    group: SettingGroup,
    value: Json,
    before: Json,
    actor: Actor,
    reason: string | null,
    action: string,
  ) {
    const name = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { fullName: true },
    });
    await this.prisma.$transaction(async (tx) => {
      const saved = await tx.siteSetting.upsert({
        where: { key: group },
        create: {
          key: group,
          value: value as Prisma.InputJsonObject,
          version: 1,
          updatedById: actor.id,
        },
        update: {
          value: value as Prisma.InputJsonObject,
          version: { increment: 1 },
          updatedById: actor.id,
        },
      });
      await tx.settingVersion.create({
        data: {
          group,
          version: saved.version,
          value: value as Prisma.InputJsonObject,
          changedById: actor.id,
          changedByName: name?.fullName ?? null,
          reason,
        },
      });
      await this.audit.log(
        actor,
        {
          action,
          entity: 'settings',
          entityId: group,
          summary: `${group} v${saved.version}`,
          reason,
          before: this.mask(group, before),
          after: this.mask(group, value),
        },
        tx,
      );
    });
    this.cache.delete(group);
  }

  private mask(group: SettingGroup, value: Json): Json {
    const paths = SECRET_FIELDS[group];
    if (!paths) return value;
    const copy = JSON.parse(JSON.stringify(value)) as Json;
    for (const path of paths) {
      const sealed = getPath(copy, path);
      let shown: string | null = null;
      if (typeof sealed === 'string' && sealed) {
        try {
          shown = maskSecret(this.encryption.decrypt(sealed));
        } catch {
          shown = '••••';
        }
      }
      setPath(copy, path, shown);
    }
    return copy;
  }

  /* Localisation: storefront text edited in any language (5.9 /settings/localisation). */

  /** Edited text for one language, as { key: value }. */
  async content(language: Language): Promise<Record<string, string>> {
    const cacheKey = `content:${language}`;
    const hit = this.cache.get(cacheKey);
    if (hit && hit.until > Date.now()) return hit.value as Record<string, string>;
    const rows = await this.prisma.contentEntry.findMany({
      where: { language },
      select: { key: true, value: true },
    });
    const value = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    this.cache.set(cacheKey, { value, until: Date.now() + CACHE_MS });
    return value;
  }

  contentDetails(language: Language) {
    return this.prisma.contentEntry.findMany({
      where: { language },
      orderBy: { key: 'asc' },
      select: { key: true, value: true, updatedAt: true },
    });
  }

  async setContent(language: Language, key: string, value: string, actor: Actor) {
    if (!CONTENT_KEY.test(key)) {
      throw new BadRequestException({ statusCode: 400, message: 'Unknown text key', field: 'key' });
    }
    const existing = await this.prisma.contentEntry.findUnique({
      where: { language_key: { language, key } },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.contentEntry.upsert({
        where: { language_key: { language, key } },
        create: { language, key, value, updatedById: actor.id },
        update: { value, updatedById: actor.id },
      });
      await this.audit.log(
        actor,
        {
          action: 'content.update',
          entity: 'content',
          entityId: `${language}:${key}`,
          before: existing?.value ?? null,
          after: value,
        },
        tx,
      );
    });
    this.cache.delete(`content:${language}`);
  }

  async resetContent(language: Language, key: string, actor: Actor) {
    const existing = await this.prisma.contentEntry.findUnique({
      where: { language_key: { language, key } },
    });
    if (!existing) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.contentEntry.delete({ where: { id: existing.id } });
      await this.audit.log(
        actor,
        {
          action: 'content.reset',
          entity: 'content',
          entityId: `${language}:${key}`,
          before: existing.value,
          after: null,
        },
        tx,
      );
    });
    this.cache.delete(`content:${language}`);
  }
}
