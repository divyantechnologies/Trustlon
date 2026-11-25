import { z } from 'zod';

/**
 * Everything staff can change from Admin > Settings without a deploy (spec 5.9), grouped the
 * way the admin panel shows it. Today's values are the defaults; saved values are merged over
 * them, so adding a field later never breaks old rows.
 */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #13233F');
const percent = (max: number) => z.number().min(0).max(max);
const rupees = (max: number) => z.number().min(0).max(max);
const text = (max: number) => z.string().trim().max(max);

export const FONT_CHOICES = [
  'Inter',
  'Poppins',
  'Roboto',
  'Open Sans',
  'Lato',
  'Nunito',
  'Montserrat',
  'Noto Sans',
] as const;

export const RADIUS_CHOICES = ['none', 'small', 'medium', 'large'] as const;

export const RADIUS_PX: Record<(typeof RADIUS_CHOICES)[number], number> = {
  none: 0,
  small: 4,
  medium: 8,
  large: 14,
};

/* Theme: colours, font, corners and logo of the storefront. */
export const themeSchema = z.object({
  colors: z
    .object({
      /** Main brand colour: header text, primary buttons, dark panels. */
      navy: hex.default('#13233F'),
      navyDark: hex.default('#1C3157'),
      navyLight: hex.default('#EEF2F8'),
      /** Accent: links, success states, highlights. */
      teal: hex.default('#1F9E8C'),
      tealDark: hex.default('#178374'),
      tealLight: hex.default('#E6F6F3'),
      /** Page background. */
      cream: hex.default('#F5F3EE'),
      /** Logo mark and icons on dark panels. */
      logoAccent: hex.default('#3CCBB4'),
    })
    .default({}),
  font: z.enum(FONT_CHOICES).default('Inter'),
  radius: z.enum(RADIUS_CHOICES).default('medium'),
  logoText: z.string().trim().min(1).max(40).default('Trustlon'),
  /** Path of an uploaded logo image, served from /api/v1/site/assets. Null shows the text logo. */
  logoUrl: z.string().max(200).nullable().default(null),
});

/* Business rules (Super Admin only). */
export const businessRulesSchema = z.object({
  /** Applies when neither the vendor nor the category has its own rate (5.3). */
  defaultCommissionPercent: percent(50).default(10),
  /** Days after the return window closes before a vendor's money leaves escrow. */
  escrowReleaseDays: z.number().int().min(0).max(60).default(7),
  /** For categories without their own return window. */
  returnWindowDays: z.number().int().min(0).max(90).default(7),
  /** Orders above this can't be paid by cash on delivery. */
  codValueCapRupees: rupees(1_000_000).default(50_000),
  /** Fee for a vendor asking to be paid before the normal payout date. */
  instantPayoutFeePercent: percent(10).default(1),
  trustScore: z
    .object({
      /** At or above: eligible for the Trustlon Verified badge. */
      verifiedMin: z.number().int().min(0).max(100).default(85),
      /** Below: the vendor gets a performance warning. */
      warningBelow: z.number().int().min(0).max(100).default(60),
      /** Below: a suspension review opens in Trust and safety. */
      suspensionReviewBelow: z.number().int().min(0).max(100).default(40),
    })
    .default({}),
  /** Listings priced at or above this are flagged for an authenticity check (5.4). */
  authenticityCheckAboveRupees: rupees(10_000_000).default(20_000),
  /** Edits to live listings go back to moderation. */
  moderateEdits: z.boolean().default(true),
  maxQuantityPerItem: z.number().int().min(1).max(1000).default(10),
  /** Years order and tax records are kept after an account is deleted. */
  recordRetentionYears: z.number().int().min(1).max(20).default(8),
  /** Working days the seller team takes to call back a /sell lead. */
  sellerCallbackDays: z.number().int().min(1).max(30).default(2),
});

/* Payments (Super Admin only). Gateway secrets are stored encrypted and never sent back. */
export const paymentsSchema = z.object({
  gateway: z
    .object({
      provider: z.enum(['RAZORPAY']).default('RAZORPAY'),
      mode: z.enum(['test', 'live']).default('test'),
      keyId: text(80).default(''),
      /** Encrypted. */
      keySecret: z.string().max(400).nullable().default(null),
      /** Encrypted. */
      webhookSecret: z.string().max(400).nullable().default(null),
    })
    .default({}),
  methods: z
    .object({
      upi: z.boolean().default(true),
      card: z.boolean().default(true),
      netbanking: z.boolean().default(true),
      wallet: z.boolean().default(true),
      cod: z.boolean().default(true),
    })
    .default({}),
  emi: z
    .object({
      enabled: z.boolean().default(true),
      minOrderRupees: rupees(1_000_000).default(3000),
      tenures: z.array(z.number().int().min(1).max(48)).max(10).default([3, 6, 9, 12]),
      noCostTenures: z.array(z.number().int().min(1).max(48)).max(10).default([3]),
    })
    .default({}),
  /** Gateway fee charged to the vendor, as a share of the order value. */
  paymentFeePercent: percent(10).default(2),
});

/* Shipping. Serviceable pincodes live in the pincode master (Settings > Shipping > Pincodes). */
const courierSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_]{2,20}$/, 'Use capitals, digits and _'),
  name: z.string().trim().min(2).max(60),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(1).max(99).default(1),
  /** {awb} is replaced with the tracking number. */
  trackingUrl: text(300).default(''),
});

export const shippingSchema = z.object({
  couriers: z
    .array(courierSchema)
    .max(20)
    .default([
      {
        code: 'DELHIVERY',
        name: 'Delhivery',
        enabled: true,
        priority: 1,
        trackingUrl: 'https://www.delhivery.com/track/package/{awb}',
      },
      {
        code: 'BLUEDART',
        name: 'Blue Dart',
        enabled: true,
        priority: 2,
        trackingUrl: 'https://www.bluedart.com/tracking?awb={awb}',
      },
      {
        code: 'XPRESSBEES',
        name: 'Xpressbees',
        enabled: true,
        priority: 3,
        trackingUrl: 'https://www.xpressbees.com/track?awb={awb}',
      },
      { code: 'SHADOWFAX', name: 'Shadowfax', enabled: false, priority: 4, trackingUrl: '' },
    ]),
  fees: z
    .object({
      freeDeliveryAboveRupees: rupees(100_000).default(499),
      standardRupees: rupees(10_000).default(40),
      expressRupees: rupees(10_000).default(99),
      codFeeRupees: rupees(10_000).default(0),
    })
    .default({}),
  weightSlabs: z
    .array(z.object({ upToGrams: z.number().int().min(1).max(100_000), rupees: rupees(100_000) }))
    .max(20)
    .default([
      { upToGrams: 500, rupees: 40 },
      { upToGrams: 1000, rupees: 60 },
      { upToGrams: 2000, rupees: 90 },
      { upToGrams: 5000, rupees: 140 },
    ]),
  /** Above the last slab, per extra kilogram. */
  extraPerKgRupees: rupees(10_000).default(30),
});

/* Tax (Super Admin only). */
const STATE_CODE = /^(0[1-9]|[1-3][0-9])$/;
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const taxSchema = z.object({
  /** Trustlon's own GST registration in each state it operates from. */
  operatorGstins: z
    .array(
      z.object({
        stateCode: z.string().regex(STATE_CODE, 'Use a 2-digit GST state code'),
        gstin: z.string().trim().toUpperCase().regex(GSTIN, 'Enter a valid GSTIN'),
      }),
    )
    .max(40)
    .default([])
    .refine(
      (list) => list.every((row) => row.gstin.startsWith(row.stateCode)),
      'GSTIN must start with its state code',
    ),
  gstOnFeesPercent: percent(40).default(18),
  /** Tax collected at source by the marketplace (Section 52, CGST Act). */
  tcsPercent: percent(5).default(0.5),
  /** Tax deducted at source by the marketplace (Section 194-O, Income Tax Act). */
  tdsPercent: percent(5).default(0.1),
  /** Vendors above this turnover must issue e-invoices (IRN). */
  eInvoiceThresholdCrore: z.number().min(0).max(1000).default(5),
});

/* Notification templates (spec 8): SMS, email and WhatsApp, in English and Hindi. */
export const NOTIFICATION_EVENTS = [
  'ORDER_PLACED',
  'ORDER_SHIPPED',
  'OUT_FOR_DELIVERY',
  'ORDER_DELIVERED',
  'ORDER_CANCELLED',
  'RETURN_APPROVED',
  'REFUND_PROCESSED',
  'PRICE_DROP',
  'KYC_APPROVED',
  'KYC_REJECTED',
  'PAYOUT_SENT',
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

const template = (en: string, hi: string, subject: string, subjectHi: string) =>
  z
    .object({
      sms: z
        .object({
          enabled: z.boolean().default(true),
          en: text(320).default(en),
          hi: text(320).default(hi),
        })
        .default({}),
      email: z
        .object({
          enabled: z.boolean().default(true),
          subjectEn: text(150).default(subject),
          subjectHi: text(150).default(subjectHi),
          en: text(5000).default(en),
          hi: text(5000).default(hi),
        })
        .default({}),
      whatsapp: z
        .object({
          enabled: z.boolean().default(false),
          /** Template name approved in WhatsApp Business Manager. */
          templateName: text(60).default(''),
          en: text(1000).default(en),
          hi: text(1000).default(hi),
        })
        .default({}),
    })
    .default({});

export const notificationsSchema = z.object({
  templates: z
    .object({
      ORDER_PLACED: template(
        'Hi {name}, your Trustlon order {order} for {amount} is confirmed.',
        'नमस्ते {name}, आपका Trustlon ऑर्डर {order} ({amount}) कन्फ़र्म हो गया है।',
        'Order {order} confirmed',
        'ऑर्डर {order} कन्फ़र्म',
      ),
      ORDER_SHIPPED: template(
        'Your order {order} has shipped with {courier}. Track: {link}',
        'आपका ऑर्डर {order} {courier} से भेज दिया गया है। ट्रैक करें: {link}',
        'Order {order} has shipped',
        'ऑर्डर {order} भेज दिया गया',
      ),
      OUT_FOR_DELIVERY: template(
        'Your order {order} is out for delivery today.',
        'आपका ऑर्डर {order} आज डिलीवरी के लिए निकल चुका है।',
        'Out for delivery today',
        'आज डिलीवरी होगी',
      ),
      ORDER_DELIVERED: template(
        'Your order {order} was delivered. Tell us how it went: {link}',
        'आपका ऑर्डर {order} डिलीवर हो गया। अपना अनुभव बताएं: {link}',
        'Order {order} delivered',
        'ऑर्डर {order} डिलीवर हुआ',
      ),
      ORDER_CANCELLED: template(
        'Your order {order} was cancelled. Any payment will be refunded in 5-7 working days.',
        'आपका ऑर्डर {order} रद्द हो गया। भुगतान 5-7 कार्य दिवसों में वापस होगा।',
        'Order {order} cancelled',
        'ऑर्डर {order} रद्द',
      ),
      RETURN_APPROVED: template(
        'Your return {return} is approved. Pickup on {date}.',
        'आपकी वापसी {return} स्वीकृत है। पिकअप {date} को होगा।',
        'Return {return} approved',
        'वापसी {return} स्वीकृत',
      ),
      REFUND_PROCESSED: template(
        'We have refunded {amount} for {order}.',
        '{order} के लिए {amount} वापस कर दिए गए हैं।',
        'Refund of {amount} processed',
        '{amount} का रिफ़ंड हो गया',
      ),
      PRICE_DROP: template(
        '{product} is now {price}. Buy now: {link}',
        '{product} अब {price} में उपलब्ध है। अभी खरीदें: {link}',
        'Price drop on {product}',
        '{product} की कीमत घटी',
      ),
      KYC_APPROVED: template(
        'Your Trustlon seller account is approved. Start listing: {link}',
        'आपका Trustlon सेलर अकाउंट स्वीकृत हो गया है। लिस्टिंग शुरू करें: {link}',
        'Your seller account is approved',
        'सेलर अकाउंट स्वीकृत',
      ),
      KYC_REJECTED: template(
        'We could not approve your seller account: {reason}. Update details: {link}',
        'आपका सेलर अकाउंट स्वीकृत नहीं हो सका: {reason}। विवरण अपडेट करें: {link}',
        'Action needed on your seller account',
        'सेलर अकाउंट पर कार्रवाई ज़रूरी',
      ),
      PAYOUT_SENT: template(
        'Payout of {amount} sent to your bank account ending {last4}.',
        '{amount} का भुगतान आपके खाते ({last4}) में भेज दिया गया है।',
        'Payout of {amount} sent',
        '{amount} का भुगतान भेजा गया',
      ),
    })
    .default({}),
});

/* Rewards: referrals, affiliates and Trustlon Coins. */
export const rewardsSchema = z.object({
  referral: z
    .object({ rewardRupees: z.number().int().min(0).max(10_000).default(100) })
    .default({}),
  affiliate: z
    .object({
      commissionPercent: percent(50).default(5),
      attributionDays: z.number().int().min(1).max(365).default(30),
    })
    .default({}),
  coins: z
    .object({
      coinValuePaise: z.number().int().min(1).max(10_000).default(100),
      maxRedeemPercent: percent(100).default(10),
      earnPerHundredRupees: z.number().min(0).max(100).default(1),
      expiryMonths: z.number().int().min(1).max(120).default(12),
    })
    .default({}),
});

/* Features: parts of the storefront that can be turned on and off. */
export const featuresSchema = z.object({
  sellPage: z.boolean().default(true),
  referralProgram: z.boolean().default(true),
  internationalAddresses: z.boolean().default(true),
  pincodeLookup: z.boolean().default(true),
  deleteReasons: z
    .array(z.string().trim().min(2).max(80))
    .min(1)
    .max(12)
    .default([
      'I have another account',
      'I don’t shop here any more',
      'Privacy concerns',
      'Too many messages',
      'Something else',
    ]),
});

/* Trustlon Prime (managed from Marketing, 5.7). */
export const primeSchema = z.object({
  enabled: z.boolean().default(false),
  plans: z
    .array(
      z.object({
        code: z.string().regex(/^[A-Z0-9_]{2,20}$/),
        name: z.string().trim().min(2).max(40),
        months: z.number().int().min(1).max(36),
        priceRupees: rupees(100_000),
      }),
    )
    .max(6)
    .default([
      { code: 'MONTHLY', name: 'Monthly', months: 1, priceRupees: 149 },
      { code: 'YEARLY', name: 'Yearly', months: 12, priceRupees: 999 },
    ]),
  benefits: z
    .array(z.string().trim().min(2).max(120))
    .max(12)
    .default([
      'Free delivery on every order',
      'Early access to deals',
      'Double Trustlon Coins',
      'Priority customer support',
    ]),
  /** Prime members get free delivery above this order value (0 = always free). */
  freeDeliveryThresholdRupees: rupees(100_000).default(0),
  coinsMultiplier: z.number().min(1).max(10).default(2),
});

export const SETTING_SCHEMAS = {
  theme: themeSchema,
  'business-rules': businessRulesSchema,
  payments: paymentsSchema,
  shipping: shippingSchema,
  tax: taxSchema,
  notifications: notificationsSchema,
  rewards: rewardsSchema,
  features: featuresSchema,
  prime: primeSchema,
} as const;

export type SettingGroup = keyof typeof SETTING_SCHEMAS;
export const SETTING_GROUPS = Object.keys(SETTING_SCHEMAS) as SettingGroup[];
export type SettingValue<G extends SettingGroup> = z.infer<(typeof SETTING_SCHEMAS)[G]>;

export type ThemeSettings = SettingValue<'theme'>;

/** Fields kept encrypted; the API shows them masked and keeps them when left empty. */
export const SECRET_FIELDS: Partial<Record<SettingGroup, string[][]>> = {
  payments: [
    ['gateway', 'keySecret'],
    ['gateway', 'webhookSecret'],
  ],
};

export const isSettingGroup = (value: string): value is SettingGroup => value in SETTING_SCHEMAS;

/** Merges saved JSON over defaults; if the saved value no longer fits, defaults are used. */
export function readSettings<T extends z.ZodTypeAny>(schema: T, saved: unknown): z.infer<T> {
  const parsed = schema.safeParse(saved ?? {});
  if (parsed.success) return parsed.data;
  return schema.parse({});
}

/** Deep-merges a partial update into the current object (arrays replace). */
export function deepMerge<T>(base: T, patch: unknown): T {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    const current = out[key];
    out[key] =
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current &&
      typeof current === 'object' &&
      !Array.isArray(current)
        ? deepMerge(current, value)
        : value;
  }
  return out as T;
}
