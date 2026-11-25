import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BusinessProfile, BusinessVerificationStatus, Prisma } from '@prisma/client';
import { checkGstin, GstinCheck } from '../../../utils/gstin';
import { PrismaService } from '../../../database/prisma.service';
import { BusinessProfileDto } from './dto';

export const BUSINESS_PROFILE_SUBMITTED = 'b2b.profile-submitted';

/** Quantity tiers for bulk pricing (spec 3.8). Each seller sets its own price for every tier. */
export const BULK_PRICING_TIERS = [
  { minQuantity: 10, label: '10 to 49 units' },
  { minQuantity: 50, label: '50 to 199 units' },
  { minQuantity: 200, label: '200 units or more' },
] as const;

export interface BusinessProfileView {
  status: BusinessVerificationStatus;
  businessName: string;
  gstin: string;
  pan: string;
  billing: { line1: string; line2: string | null; city: string; state: string; pincode: string };
  rejectionReason: string | null;
  submittedAt: Date;
  verifiedAt: Date | null;
  bulkPricingEnabled: boolean;
}

function toView(row: BusinessProfile): BusinessProfileView {
  return {
    status: row.status,
    businessName: row.businessName,
    gstin: row.gstin,
    pan: row.pan,
    billing: {
      line1: row.billingLine1,
      line2: row.billingLine2,
      city: row.billingCity,
      state: row.billingState,
      pincode: row.billingPincode,
    },
    rejectionReason: row.rejectionReason,
    submittedAt: row.submittedAt,
    verifiedAt: row.verifiedAt,
    bulkPricingEnabled: row.status === BusinessVerificationStatus.VERIFIED,
  };
}

@Injectable()
export class B2bService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async get(
    userId: string,
  ): Promise<{ profile: BusinessProfileView | null; tiers: typeof BULK_PRICING_TIERS }> {
    const row = await this.prisma.businessProfile.findUnique({ where: { userId } });
    return { profile: row ? toView(row) : null, tiers: BULK_PRICING_TIERS };
  }

  verifyGstin(gstin: string): GstinCheck {
    return checkGstin(gstin);
  }

  /**
   * Saves the profile and sends it for verification. Changing the GSTIN, PAN or business name of a
   * verified profile sends it back for verification; other edits keep it verified.
   */
  async save(userId: string, dto: BusinessProfileDto): Promise<BusinessProfileView> {
    const check = checkGstin(dto.gstin);
    if (!check.valid) throw new BadRequestException({ message: check.reason, field: 'gstin' });
    if (check.pan !== dto.pan) {
      throw new BadRequestException({
        message: 'The PAN must match characters 3 to 12 of the GSTIN',
        field: 'pan',
      });
    }
    if (check.state !== dto.billingState) {
      throw new BadRequestException({
        message: `This GSTIN is registered in ${check.state}. Use a billing address in that state.`,
        field: 'billingState',
      });
    }

    const existing = await this.prisma.businessProfile.findUnique({ where: { userId } });
    const identityChanged =
      !existing ||
      existing.gstin !== dto.gstin ||
      existing.pan !== dto.pan ||
      existing.businessName !== dto.businessName;
    const keepVerified =
      existing?.status === BusinessVerificationStatus.VERIFIED && !identityChanged;

    const data = {
      businessName: dto.businessName,
      gstin: dto.gstin,
      pan: dto.pan,
      billingLine1: dto.billingLine1,
      billingLine2: dto.billingLine2 ?? null,
      billingCity: dto.billingCity,
      billingState: dto.billingState,
      billingPincode: dto.billingPincode,
      ...(keepVerified
        ? {}
        : {
            status: BusinessVerificationStatus.PENDING,
            rejectionReason: null,
            verifiedAt: null,
            submittedAt: new Date(),
          }),
    };

    let row: BusinessProfile;
    try {
      row = await this.prisma.businessProfile.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          message: 'This GSTIN is already linked to another Trustlon account',
          field: 'gstin',
        });
      }
      throw error;
    }
    if (!keepVerified) this.events.emit(BUSINESS_PROFILE_SUBMITTED, { userId, gstin: row.gstin });
    return toView(row);
  }
}
