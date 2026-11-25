import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pincode, Prisma } from '@prisma/client';
import { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { SiteSettingsService } from '../site/site-settings.service';
import { INDIAN_STATES } from './address-rules';

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

export interface PincodeSuggestion {
  pincode: string;
  area: string | null;
  city: string;
  state: string;
}

const SUGGESTION_LIMIT = 8;
const LOOKUP_TIMEOUT_MS = 4000;

/** India Post names a few states differently from our address list. */
const STATE_ALIASES: Record<string, string> = {
  'andaman & nicobar islands': 'Andaman and Nicobar Islands',
  'jammu & kashmir': 'Jammu and Kashmir',
  'dadra & nagar haveli': 'Dadra and Nagar Haveli and Daman and Diu',
  'daman & diu': 'Dadra and Nagar Haveli and Daman and Diu',
  'the dadra and nagar haveli and daman and diu': 'Dadra and Nagar Haveli and Daman and Diu',
  pondicherry: 'Puducherry',
  orissa: 'Odisha',
  uttaranchal: 'Uttarakhand',
  'nct of delhi': 'Delhi',
  'new delhi': 'Delhi',
  chattisgarh: 'Chhattisgarh',
};

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .replace(
      /(^|[\s(-])([a-z])/g,
      (_, before: string, letter: string) => before + letter.toUpperCase(),
    )
    .trim();

/** Maps a state as written by India Post to the name used on our addresses. */
export function canonicalState(raw: string): string | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (STATE_ALIASES[key]) return STATE_ALIASES[key];
  const match = INDIAN_STATES.find((state) => state.toLowerCase() === key.replace(/&/g, 'and'));
  return match ?? null;
}

const toSuggestion = (
  row: Pick<Pincode, 'pincode' | 'area' | 'city' | 'state'>,
): PincodeSuggestion => ({
  pincode: row.pincode,
  area: row.area,
  city: row.city,
  state: row.state,
});

@Injectable()
export class PincodeService {
  private readonly logger = new Logger(PincodeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly site: SiteSettingsService,
  ) {}

  /**
   * Suggestions while typing: digits match the start of the pincode, words match the area or
   * city (e.g. "kora" finds Koramangala, Bengaluru).
   */
  async search(query: string): Promise<PincodeSuggestion[]> {
    const q = query.trim();
    if (/^\d{1,6}$/.test(q)) {
      if (q.length === 6) {
        const exact = await this.lookup(q);
        if (exact) return [exact];
      }
      if (q.length < 2) return [];
      const rows = await this.prisma.pincode.findMany({
        where: { pincode: { startsWith: q } },
        orderBy: { pincode: 'asc' },
        take: SUGGESTION_LIMIT,
      });
      return rows.map(toSuggestion);
    }
    if (q.length < 2) return [];
    const rows = await this.prisma.pincode.findMany({
      where: {
        OR: [
          { area: { startsWith: q, mode: 'insensitive' } },
          { city: { startsWith: q, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ city: 'asc' }, { pincode: 'asc' }],
      take: SUGGESTION_LIMIT,
    });
    return rows.map(toSuggestion);
  }

  /** One pincode with its area, city and state. Asks India Post when we don't have it yet. */
  async lookup(pincode: string): Promise<PincodeSuggestion | null> {
    if (!PINCODE_PATTERN.test(pincode)) return null;
    const row = await this.prisma.pincode.findUnique({ where: { pincode } });
    if (row) return toSuggestion(row);
    return this.lookupIndiaPost(pincode);
  }

  /** Indian cities (districts) for the city field. */
  async indianCities(query: string): Promise<string[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const rows = await this.prisma.pincode.findMany({
      where: { city: { startsWith: q, mode: 'insensitive' } },
      distinct: ['city'],
      select: { city: true },
      orderBy: { city: 'asc' },
      take: SUGGESTION_LIMIT,
    });
    return rows.map((row) => row.city);
  }

  private async lookupIndiaPost(pincode: string): Promise<PincodeSuggestion | null> {
    const base = this.config.get('PINCODE_LOOKUP_URL', { infer: true });
    if (!base || this.config.get('NODE_ENV', { infer: true }) === 'test') return null;
    if (!(await this.site.get('features')).pincodeLookup) return null;
    try {
      const response = await fetch(`${base.replace(/\/$/, '')}/${pincode}`, {
        signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return null;
      const body = (await response.json()) as Array<{
        Status?: string;
        PostOffice?: Array<{
          Name?: string;
          District?: string;
          State?: string;
          DeliveryStatus?: string;
        }> | null;
      }>;
      const offices = body?.[0]?.Status === 'Success' ? (body[0].PostOffice ?? []) : [];
      const office = offices.find((o) => o.DeliveryStatus === 'Delivery') ?? offices[0];
      const state = office?.State ? canonicalState(office.State) : null;
      if (!office?.District || !state) return null;
      const data = {
        pincode,
        area: office.Name ? titleCase(office.Name).slice(0, 120) : null,
        city: titleCase(office.District).slice(0, 80),
        state,
        // Delivery is confirmed by the logistics team; until then the pincode is address data only.
        serviceable: false,
        codAvailable: false,
      };
      const saved = await this.prisma.pincode.create({ data }).catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return this.prisma.pincode.findUniqueOrThrow({ where: { pincode } });
        }
        throw error;
      });
      return toSuggestion(saved);
    } catch (error) {
      this.logger.warn(`India Post lookup failed for ${pincode}: ${(error as Error).message}`);
      return null;
    }
  }

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
