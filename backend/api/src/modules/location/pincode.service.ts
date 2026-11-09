import { Injectable } from '@nestjs/common';
import { Pincode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface Serviceability {
  pincode: string;
  area: string | null;
  city: string | null;
  state: string | null;
  serviceable: boolean;
  codAvailable: boolean;
  sameDayAvailable: boolean;
  estimatedDeliveryDays: number | null;
}

export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

@Injectable()
export class PincodeService {
  constructor(private readonly prisma: PrismaService) {}

  find(pincode: string): Promise<Pincode | null> {
    if (!PINCODE_PATTERN.test(pincode)) return Promise.resolve(null);
    return this.prisma.pincode.findUnique({ where: { pincode } });
  }

  /** Unknown pincodes are reported as not serviceable rather than as an error. */
  async serviceability(pincode: string): Promise<Serviceability> {
    const row = await this.find(pincode);
    if (!row) {
      return {
        pincode,
        area: null,
        city: null,
        state: null,
        serviceable: false,
        codAvailable: false,
        sameDayAvailable: false,
        estimatedDeliveryDays: null,
      };
    }
    return {
      pincode: row.pincode,
      area: row.area,
      city: row.city,
      state: row.state,
      serviceable: row.serviceable,
      codAvailable: row.serviceable && row.codAvailable,
      sameDayAvailable: row.serviceable && row.sameDayAvailable,
      estimatedDeliveryDays: row.serviceable ? row.deliveryDays : null,
    };
  }
}
