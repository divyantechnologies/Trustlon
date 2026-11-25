import type { CountryCode } from 'libphonenumber-js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Address, AddressLabel, Prisma } from '@prisma/client';
import { normalizeIndianMobile, normalizePhone } from '../../../utils/identifier';
import {
  isCountryCode,
  normalisePostalCode,
  postalRule,
  STATE_REQUIRED,
  statesOf,
} from '../../hyperlocal/location/address-rules';
import { PrismaService } from '../../../database/prisma.service';
import { PincodeService } from '../../hyperlocal/location/pincode.service';
import { SiteSettingsService } from '../../site/site-settings.service';
import { AddressDto } from './dto';

export const MAX_ADDRESSES = 20;

export interface AddressView {
  id: string;
  label: AddressLabel;
  labelName: string | null;
  fullName: string;
  mobile: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
  delivery: { serviceable: boolean; codAvailable: boolean; estimatedDeliveryDays: number | null };
}

/** Shape stored on orders and returns, so later edits never change them. */
export interface AddressSnapshot {
  name: string;
  mobile: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export function toAddressSnapshot(address: Address): AddressSnapshot {
  return {
    name: address.fullName,
    mobile: address.mobile,
    line1: address.line1,
    line2: address.line2,
    landmark: address.landmark,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    country: address.country,
  };
}

const ORDER: Prisma.AddressOrderByWithRelationInput[] = [
  { isDefault: 'desc' },
  { updatedAt: 'desc' },
];

@Injectable()
export class AddressesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pincodes: PincodeService,
    private readonly site: SiteSettingsService,
  ) {}

  async list(userId: string): Promise<AddressView[]> {
    const rows = await this.prisma.address.findMany({ where: { userId }, orderBy: ORDER });
    return this.present(rows);
  }

  /** The customer's own address, or a 404 that does not reveal whether the id exists. */
  async findOwned(userId: string, id: string): Promise<Address> {
    const address = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  async create(userId: string, dto: AddressDto): Promise<AddressView[]> {
    const data = await this.toData(dto);
    await this.prisma.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId } });
      if (count >= MAX_ADDRESSES) {
        throw new ConflictException(
          `You can save up to ${MAX_ADDRESSES} addresses. Remove one to add another.`,
        );
      }
      const makeDefault = count === 0 || dto.isDefault === true;
      if (makeDefault)
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      await tx.address.create({ data: { ...data, userId, isDefault: makeDefault } });
    });
    return this.list(userId);
  }

  async update(userId: string, id: string, dto: AddressDto): Promise<AddressView[]> {
    const existing = await this.findOwned(userId, id);
    const data = await this.toData(dto);
    await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault && !existing.isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      // The default can only move to another address, never be switched off directly.
      await tx.address.update({
        where: { id },
        data: { ...data, isDefault: existing.isDefault || dto.isDefault === true },
      });
    });
    return this.list(userId);
  }

  async setDefault(userId: string, id: string): Promise<AddressView[]> {
    await this.findOwned(userId, id);
    await this.prisma.$transaction([
      this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
      this.prisma.address.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return this.list(userId);
  }

  async remove(userId: string, id: string): Promise<AddressView[]> {
    const existing = await this.findOwned(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.address.delete({ where: { id } });
      if (existing.isDefault) {
        const next = await tx.address.findFirst({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
        });
        if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
    return this.list(userId);
  }

  private async toData(dto: AddressDto) {
    const fail = (field: string, message: string) =>
      new BadRequestException({ statusCode: 400, message, field });
    const country = dto.country ?? 'IN';
    if (!isCountryCode(country)) throw fail('country', 'Choose a country');
    const india = country === 'IN';
    if (!india && !(await this.site.get('features')).internationalAddresses) {
      throw fail('country', 'Addresses outside India are not available right now');
    }

    const mobile = india
      ? normalizeIndianMobile(dto.mobile)
      : normalizePhone(dto.mobile, country as CountryCode);
    if (!mobile) {
      throw fail(
        'mobile',
        india
          ? 'Enter a valid 10-digit Indian mobile number'
          : 'Enter a valid phone number for this country',
      );
    }

    const pincode = normalisePostalCode(country, dto.pincode);
    if (pincode === null) {
      const rule = postalRule(country);
      throw fail(
        'pincode',
        india
          ? 'Enter a valid six-digit pincode'
          : `Enter a valid ${rule.label.toLowerCase()}${rule.example ? `, e.g. ${rule.example}` : ''}`,
      );
    }

    // Known pincodes fix the city and state, so Indian addresses match the courier's data.
    const known = india ? await this.pincodes.find(pincode) : null;
    const states = statesOf(country);
    let state = known?.state ?? (dto.state ?? '').trim();
    if (state && states.length) {
      const match = states.find((name) => name.toLowerCase() === state.toLowerCase());
      if (!match) throw fail('state', 'Choose a state from the list');
      state = match;
    }
    if (!state && STATE_REQUIRED.has(country)) throw fail('state', 'Choose a state');

    return {
      label: dto.label as AddressLabel,
      labelName: dto.label === 'OTHER' ? (dto.labelName ?? null) : null,
      fullName: dto.fullName,
      mobile,
      line1: dto.line1,
      line2: dto.line2 ?? null,
      landmark: dto.landmark ?? null,
      pincode,
      country,
      city: known?.city ?? dto.city,
      state,
    };
  }

  private async present(rows: Address[]): Promise<AddressView[]> {
    const pincodes = [
      ...new Set(rows.filter((row) => row.country === 'IN').map((row) => row.pincode)),
    ];
    const known = pincodes.length
      ? await this.prisma.pincode.findMany({ where: { pincode: { in: pincodes } } })
      : [];
    const byPincode = new Map(known.map((row) => [row.pincode, row]));
    return rows.map((row) => {
      const pin = row.country === 'IN' ? byPincode.get(row.pincode) : undefined;
      return {
        id: row.id,
        label: row.label,
        labelName: row.labelName,
        fullName: row.fullName,
        mobile: row.mobile,
        line1: row.line1,
        line2: row.line2,
        landmark: row.landmark,
        city: row.city,
        state: row.state,
        pincode: row.pincode,
        country: row.country,
        isDefault: row.isDefault,
        delivery: {
          serviceable: Boolean(pin?.serviceable),
          codAvailable: Boolean(pin?.serviceable && pin.codAvailable),
          estimatedDeliveryDays: pin?.serviceable ? pin.deliveryDays : null,
        },
      };
    });
  }
}
