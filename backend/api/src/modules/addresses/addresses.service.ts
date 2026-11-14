import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Address, AddressLabel, Prisma } from '@prisma/client';
import { normalizePhone } from '../../common/utils/identifier';
import { PrismaService } from '../../prisma/prisma.service';
import { PincodeService } from '../location/pincode.service';
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
    const mobile = normalizePhone(dto.mobile, 'IN');
    if (!mobile || !mobile.startsWith('+91')) {
      throw new BadRequestException({
        message: 'Enter a valid Indian mobile number',
        field: 'mobile',
      });
    }
    // Known pincodes fix the city and state, so addresses match the courier's data.
    const known = await this.pincodes.find(dto.pincode);
    return {
      label: dto.label as AddressLabel,
      labelName: dto.label === 'OTHER' ? (dto.labelName ?? null) : null,
      fullName: dto.fullName,
      mobile,
      line1: dto.line1,
      line2: dto.line2 ?? null,
      landmark: dto.landmark ?? null,
      pincode: dto.pincode,
      city: known?.city ?? dto.city,
      state: known?.state ?? dto.state,
    };
  }

  private async present(rows: Address[]): Promise<AddressView[]> {
    const pincodes = [...new Set(rows.map((row) => row.pincode))];
    const known = pincodes.length
      ? await this.prisma.pincode.findMany({ where: { pincode: { in: pincodes } } })
      : [];
    const byPincode = new Map(known.map((row) => [row.pincode, row]));
    return rows.map((row) => {
      const pin = byPincode.get(row.pincode);
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
