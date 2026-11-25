import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { VendorLeadStatus } from '@prisma/client';
import { checkGstin } from '../../common/utils/gstin';
import { PrismaService } from '../../prisma/prisma.service';
import { FeeCalculatorDto, VendorLeadDto } from './dto';
import { SiteSettingsService } from '../site/site-settings.service';
import { calculateFees, FeeRates, PRODUCT_GST_RATES_BPS } from './fees';

/** Emitted when a business asks to sell on Trustlon; the onboarding team is notified. */
export const VENDOR_LEAD_CREATED = 'sell.vendor-lead-created';

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const percent = (bps: number) => bps / 100;
const toBps = (value: number) => Math.round(value * 100);

@Injectable()
export class SellService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly site: SiteSettingsService,
  ) {}

  /** Live rates from /admin > Business settings. */
  private async rates(): Promise<FeeRates & { defaultCommissionBps: number }> {
    const [rules, payments, tax] = await Promise.all([
      this.site.get('business-rules'),
      this.site.get('payments'),
      this.site.get('tax'),
    ]);
    return {
      defaultCommissionBps: toBps(rules.defaultCommissionPercent),
      paymentFeeBps: toBps(payments.paymentFeePercent),
      gstOnFeesBps: toBps(tax.gstOnFeesPercent),
      tcsBps: toBps(tax.tcsPercent),
      tdsBps: toBps(tax.tdsPercent),
    };
  }

  /** Commission per main category, for the fee table and calculator. */
  async commissionRates() {
    const rates = await this.rates();
    const categories = await this.prisma.category.findMany({
      where: { parentId: null, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, slug: true, name: true, nameHi: true, commissionBps: true },
    });
    return {
      defaultCommissionPercent: percent(rates.defaultCommissionBps),
      fees: {
        paymentFeePercent: percent(rates.paymentFeeBps),
        gstOnFeesPercent: percent(rates.gstOnFeesBps),
        tcsPercent: percent(rates.tcsBps),
        tdsPercent: percent(rates.tdsBps),
      },
      gstRates: PRODUCT_GST_RATES_BPS.map(percent),
      categories: categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        name: category.name,
        nameHi: category.nameHi,
        commissionPercent: percent(category.commissionBps ?? rates.defaultCommissionBps),
      })),
    };
  }

  async calculate(dto: FeeCalculatorDto) {
    const rates = await this.rates();
    let commissionBps = rates.defaultCommissionBps;
    let categoryName: string | null = null;
    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, isActive: true },
        select: { name: true, commissionBps: true, parent: { select: { commissionBps: true } } },
      });
      if (!category) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Choose a category',
          field: 'categoryId',
        });
      }
      categoryName = category.name;
      commissionBps =
        category.commissionBps ?? category.parent?.commissionBps ?? rates.defaultCommissionBps;
    }
    return {
      categoryName,
      ...calculateFees(
        {
          pricePaise: dto.pricePaise,
          commissionBps,
          gstRateBps: dto.gstRateBps ?? 1800,
          shippingPaise: dto.shippingPaise,
        },
        rates,
      ),
    };
  }

  async createLead(dto: VendorLeadDto, ip?: string) {
    if (!(await this.site.get('features')).sellPage) {
      throw new BadRequestException('Seller sign-up is closed right now. Please check back soon.');
    }
    if (dto.gstin) {
      const check = checkGstin(dto.gstin);
      if (!check.valid) {
        throw new BadRequestException({ statusCode: 400, message: check.reason, field: 'gstin' });
      }
    }
    if (dto.categoryId) {
      const exists = await this.prisma.category.count({ where: { id: dto.categoryId } });
      if (!exists) dto.categoryId = undefined;
    }
    const { sellerCallbackDays: days } = await this.site.get('business-rules');
    const message = `Thanks! Our seller team will call you within ${days} working day${days > 1 ? 's' : ''} to help you get started.`;

    // A second request from the same number within a day is treated as the same lead.
    const recent = await this.prisma.vendorLead.findFirst({
      where: {
        mobile: dto.mobile,
        status: VendorLeadStatus.NEW,
        createdAt: { gt: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (recent) return { message };

    const lead = await this.prisma.vendorLead.create({
      data: {
        contactName: dto.contactName,
        businessName: dto.businessName,
        mobile: dto.mobile,
        email: dto.email,
        city: dto.city,
        categoryId: dto.categoryId ?? null,
        gstin: dto.gstin ?? null,
        ip: ip?.slice(0, 45),
      },
    });
    this.events.emit(VENDOR_LEAD_CREATED, { leadId: lead.id });
    return { message };
  }
}
