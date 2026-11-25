import {
  BadRequestException,
  Body,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Language, Prisma, UserRole } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { randomBytes } from 'crypto';
import type { Request } from 'express';
import { actorOf, AuditService } from '../../../common/admin/audit.service';
import { AdminController, Can } from '../../../common/admin/decorators';
import { Permission, SUPER_ADMIN_SETTING_GROUPS } from '../../../common/admin/permissions';
import { PermissionsService } from '../../../common/admin/permissions.service';
import { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser } from '../../../common/auth/decorators';
import { detectImageType, FileStorage } from '../../../common/storage/file-storage';
import { PrismaService } from '../../../prisma/prisma.service';
import { isSettingGroup, SETTING_GROUPS, SettingGroup } from '../../site/site-settings.schema';
import { CONTENT_KEY, SiteSettingsService } from '../../site/site-settings.service';

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase() : value;

class SettingsPatchDto {
  /** Any part of the group; the merged result is validated. */
  @IsObject()
  value!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

class LanguageQuery {
  @Transform(upper)
  @IsEnum(Language)
  language!: Language;
}

class ContentDto extends LanguageQuery {
  @Matches(CONTENT_KEY, { message: 'Unknown text key' })
  key!: string;

  @IsString()
  @MaxLength(5000)
  value!: string;
}

class ContentKeyQuery extends LanguageQuery {
  @Matches(CONTENT_KEY, { message: 'Unknown text key' })
  key!: string;
}

class PincodeQuery {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  serviceable?: boolean;
}

class PincodeUpdateDto {
  @IsOptional()
  @IsBoolean()
  serviceable?: boolean;

  @IsOptional()
  @IsBoolean()
  codAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  sameDayAvailable?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  deliveryDays?: number;
}

class PincodeBulkDto extends PincodeUpdateDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @Matches(/^\d{6}$/, { each: true, message: 'PIN codes have 6 digits' })
  pincodes!: string[];
}

/** Who sees each group in Admin > Settings (5.9), and who can change it. */
const GROUP_INFO: Record<SettingGroup, { label: string; description: string }> = {
  'business-rules': {
    label: 'Business rules',
    description: 'Commission, escrow, returns, COD limit, Trust Score thresholds',
  },
  payments: { label: 'Payments', description: 'Gateway keys, payment methods, EMI options' },
  shipping: {
    label: 'Shipping',
    description: 'Courier partners, delivery fees, weight slabs, serviceable PIN codes',
  },
  tax: { label: 'Tax', description: 'Operator GSTINs, TCS and TDS rates, e-invoice threshold' },
  notifications: {
    label: 'Notifications',
    description: 'SMS, email and WhatsApp templates in English and Hindi',
  },
  rewards: {
    label: 'Rewards',
    description: 'Referral reward, affiliate commission, Trustlon Coins',
  },
  features: {
    label: 'Features',
    description: 'Turn storefront features on or off; account deletion reasons',
  },
  theme: { label: 'Theme', description: 'Colours, font, corners and logo of the storefront' },
  prime: {
    label: 'Trustlon Prime',
    description: 'Membership price, benefits, free-delivery threshold',
  },
};

const LOGO_MAX_BYTES = 1024 * 1024;

@AdminController('settings')
export class AdminSettingsController {
  constructor(
    private readonly settings: SiteSettingsService,
    private readonly permissions: PermissionsService,
    private readonly storage: FileStorage,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Can('settings', 'view')
  async groups(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.siteSetting.findMany({
      select: { key: true, version: true, updatedAt: true },
    });
    const saved = new Map(rows.map((row) => [row.key, row]));
    return {
      items: await Promise.all(
        SETTING_GROUPS.map(async (group) => ({
          group,
          ...GROUP_INFO[group],
          superAdminOnly: SUPER_ADMIN_SETTING_GROUPS.includes(group),
          canEdit: await this.canEdit(user, group),
          version: saved.get(group)?.version ?? 0,
          updatedAt: saved.get(group)?.updatedAt ?? null,
        })),
      ),
    };
  }

  /* Localisation (storefront text in every language). */

  @Get('localisation/content')
  @Can('settings', 'view')
  async content(@Query() query: LanguageQuery) {
    return { items: await this.settings.contentDetails(query.language) };
  }

  @Put('localisation/content')
  @Can('settings', 'edit')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setContent(
    @Body() dto: ContentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<void> {
    await this.settings.setContent(dto.language, dto.key, dto.value, actorOf(user, req));
  }

  @Delete('localisation/content')
  @Can('settings', 'edit')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetContent(
    @Query() query: ContentKeyQuery,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<void> {
    await this.settings.resetContent(query.language, query.key, actorOf(user, req));
  }

  /* Serviceable PIN codes (pincode master). */

  @Get('shipping/pincodes')
  @Can('settings', 'view')
  async pincodes(@Query() query: PincodeQuery) {
    const q = query.q?.trim() ?? '';
    const where: Prisma.PincodeWhereInput = {
      ...(query.serviceable !== undefined ? { serviceable: query.serviceable } : {}),
      ...(q
        ? /^\d+$/.test(q)
          ? { pincode: { startsWith: q } }
          : {
              OR: [
                { city: { contains: q, mode: 'insensitive' } },
                { state: { contains: q, mode: 'insensitive' } },
                { area: { contains: q, mode: 'insensitive' } },
              ],
            }
        : {}),
    };
    const [items, total, serviceable] = await Promise.all([
      this.prisma.pincode.findMany({ where, orderBy: { pincode: 'asc' }, take: 100 }),
      this.prisma.pincode.count({ where }),
      this.prisma.pincode.count({ where: { serviceable: true } }),
    ]);
    return { items, total, serviceableTotal: serviceable };
  }

  @Patch('shipping/pincodes/:pincode')
  @Can('settings', 'edit')
  async updatePincode(
    @Param('pincode') pincode: string,
    @Body() dto: PincodeUpdateDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    if (!/^\d{6}$/.test(pincode)) throw new BadRequestException('PIN codes have 6 digits');
    const before = await this.prisma.pincode.findUnique({ where: { pincode } });
    if (!before) throw new NotFoundException('This PIN code is not in the pincode master');
    const after = await this.prisma.pincode.update({ where: { pincode }, data: dto });
    await this.audit.log(actorOf(user, req), {
      action: 'pincode.update',
      entity: 'pincode',
      entityId: pincode,
      summary: `${after.city}, ${after.state}`,
      before: pickPin(before),
      after: pickPin(after),
    });
    return after;
  }

  @Post('shipping/pincodes/bulk')
  @Can('settings', 'edit')
  @HttpCode(HttpStatus.OK)
  async bulkPincodes(
    @Body() dto: PincodeBulkDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const { pincodes, ...data } = dto;
    if (Object.keys(data).length === 0) throw new BadRequestException('Choose what to change');
    const result = await this.prisma.pincode.updateMany({
      where: { pincode: { in: pincodes } },
      data,
    });
    await this.audit.log(actorOf(user, req), {
      action: 'pincode.bulk_update',
      entity: 'pincode',
      summary: `${result.count} PIN codes`,
      after: { ...data, pincodes: pincodes.slice(0, 50) },
    });
    return { updated: result.count, notFound: pincodes.length - result.count };
  }

  /* Theme logo. */

  @Post('theme/logo')
  @Can('settings', 'edit')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseInterceptors(FileInterceptor('logo', { limits: { fileSize: LOGO_MAX_BYTES, files: 1 } }))
  async uploadLogo(
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('Choose an image');
    const type = detectImageType(file.buffer);
    if (!type) throw new BadRequestException('Use a PNG, JPG or WebP image');
    const name = `logo-${randomBytes(8).toString('hex')}.${type.extension}`;
    await this.storage.put(`site/${name}`, file.buffer);
    return this.settings.update(
      'theme',
      { logoUrl: `/api/v1/site/assets/${name}` },
      actorOf(user, req),
      'New logo',
    );
  }

  /* Groups. */

  @Get(':group')
  async get(@Param('group') group: string, @CurrentUser() user: AuthUser) {
    const g = this.group(group);
    await this.assertView(user, g);
    return { ...(await this.settings.forAdmin(g)), canEdit: await this.canEdit(user, g) };
  }

  @Patch(':group')
  async update(
    @Param('group') group: string,
    @Body() dto: SettingsPatchDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const g = this.group(group);
    await this.assertEdit(user, g);
    return this.settings.update(g, dto.value, actorOf(user, req), dto.reason);
  }

  @Post(':group/reset')
  @HttpCode(HttpStatus.OK)
  async reset(@Param('group') group: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const g = this.group(group);
    await this.assertEdit(user, g);
    return this.settings.reset(g, actorOf(user, req));
  }

  @Get(':group/versions')
  async versions(@Param('group') group: string, @CurrentUser() user: AuthUser) {
    const g = this.group(group);
    await this.assertView(user, g);
    return { items: await this.settings.versions(g) };
  }

  @Post(':group/versions/:version/restore')
  @HttpCode(HttpStatus.OK)
  async restore(
    @Param('group') group: string,
    @Param('version', ParseIntPipe) version: number,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const g = this.group(group);
    await this.assertEdit(user, g);
    return this.settings.restore(g, version, actorOf(user, req));
  }

  private group(value: string): SettingGroup {
    if (!isSettingGroup(value)) throw new NotFoundException('Unknown settings group');
    return value;
  }

  private viewPermission(group: SettingGroup): Permission {
    return group === 'prime' ? 'marketing:view' : 'settings:view';
  }

  private async assertView(user: AuthUser, group: SettingGroup) {
    await this.permissions.assert(user.role, this.viewPermission(group));
  }

  private async canEdit(user: AuthUser, group: SettingGroup): Promise<boolean> {
    if (user.role === UserRole.SUPER_ADMIN) return true;
    if (SUPER_ADMIN_SETTING_GROUPS.includes(group)) return false;
    return this.permissions.has(user.role, group === 'prime' ? 'marketing:edit' : 'settings:edit');
  }

  private async assertEdit(user: AuthUser, group: SettingGroup) {
    if (!(await this.canEdit(user, group))) {
      throw new ForbiddenException(
        SUPER_ADMIN_SETTING_GROUPS.includes(group)
          ? 'Only a Super Admin can change these settings'
          : 'Your role does not allow this',
      );
    }
  }
}

function pickPin(row: {
  serviceable: boolean;
  codAvailable: boolean;
  sameDayAvailable: boolean;
  deliveryDays: number;
}) {
  return {
    serviceable: row.serviceable,
    codAvailable: row.codAvailable,
    sameDayAvailable: row.sameDayAvailable,
    deliveryDays: row.deliveryDays,
  };
}
