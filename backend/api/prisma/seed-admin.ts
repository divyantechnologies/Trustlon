/**
 * Development seed for the admin panel (spec section 5): KYC submissions with documents,
 * products waiting for moderation, reports, Trust Score history, HSN master, attributes,
 * sample CMS pages and a coupon. Run after `npm run db:seed`. Safe to run again.
 * Never run against production.
 *
 *   npm run admin:seed -w backend/api
 */
import {
  AttributeType,
  CheckResult,
  CouponAudience,
  CouponType,
  KycStatus,
  PrismaClient,
  ProductStatus,
  ReportReason,
  ReportTarget,
  ReporterKind,
  SubmissionKind,
  UserRole,
  VendorDocumentType,
  VendorStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, isAbsolute, join, resolve } from 'path';

const DAY = 86_400_000;

const storageRoot = () => {
  const dir = process.env.STORAGE_DIR || 'storage';
  return isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
};

/** A 1×1 PNG and a one-page PDF, enough to try the document viewer. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
const pdf = (title: string) =>
  Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 420 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length ${44 + title.length}>>stream\nBT /F1 18 Tf 30 100 Td (Sample: ${title}) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`,
  );

async function store(key: string, content: Buffer) {
  const path = join(storageRoot(), key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

const NEW_VENDORS = [
  {
    slug: 'craftnest',
    displayName: 'CraftNest',
    legalName: 'CraftNest Handicrafts LLP',
    initials: 'cn',
    gstin: '08AAJFC1234K1Z3',
    pan: 'AAJFC1234K',
    panName: 'CRAFTNEST HANDICRAFTS LLP',
    bankName: 'HDFC Bank',
    ifsc: 'HDFC0001234',
    last4: '4821',
    pennyDropName: 'CRAFTNEST HANDICRAFTS LLP',
    status: KycStatus.SUBMITTED,
    checks: [CheckResult.PASSED, CheckResult.PASSED, CheckResult.PASSED],
    daysAgo: 2,
  },
  {
    slug: 'voltedge',
    displayName: 'VoltEdge Electronics',
    legalName: 'VoltEdge Retail Private Limited',
    initials: 've',
    gstin: '27AAGCV5678M1Z9',
    pan: 'AAGCV5678M',
    panName: 'VOLTEDGE RETAIL PRIVATE LIMITED',
    bankName: 'ICICI Bank',
    ifsc: 'ICIC0004321',
    last4: '9034',
    pennyDropName: 'V EDGE TRADERS',
    status: KycStatus.SUBMITTED,
    checks: [CheckResult.PASSED, CheckResult.PASSED, CheckResult.FAILED],
    daysAgo: 1,
  },
  {
    slug: 'silk-route-sarees',
    displayName: 'Silk Route Sarees',
    legalName: 'Silk Route Textiles',
    initials: 'sr',
    gstin: '33ABCPS4321Q1Z7',
    pan: 'ABCPS4321Q',
    panName: 'MEENA SUNDARAM',
    bankName: 'State Bank of India',
    ifsc: 'SBIN0000812',
    last4: '1177',
    pennyDropName: 'MEENA SUNDARAM',
    status: KycStatus.MORE_INFO_REQUIRED,
    checks: [CheckResult.PASSED, CheckResult.PENDING, CheckResult.PASSED],
    daysAgo: 5,
  },
];

const HSN = [
  { code: '0901', description: 'Coffee, roasted or not', rate: 5 },
  { code: '3304', description: 'Beauty, make-up and skin-care preparations', rate: 18 },
  { code: '4202', description: 'Trunks, suitcases, handbags, backpacks', rate: 18 },
  { code: '6109', description: 'T-shirts and vests, knitted', rate: 5 },
  { code: '6404', description: 'Footwear with textile uppers', rate: 5 },
  { code: '8471', description: 'Computers and units thereof', rate: 18 },
  { code: '8517', description: 'Telephones, smartphones and network devices', rate: 18 },
  { code: '8518', description: 'Headphones, earphones, microphones and speakers', rate: 18 },
  { code: '9403', description: 'Other furniture and parts', rate: 18 },
  { code: '9405', description: 'Lamps and lighting fittings', rate: 18 },
];

const ATTRIBUTES = [
  {
    code: 'size',
    name: 'Size',
    type: AttributeType.SIZE,
    options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    isFilterable: true,
    isVariant: true,
    categories: ['fashion'],
  },
  {
    code: 'colour',
    name: 'Colour',
    type: AttributeType.COLOR,
    options: ['Black', 'White', 'Navy', 'Red', 'Green', 'Beige'],
    isFilterable: true,
    isVariant: true,
    categories: ['fashion', 'electronics', 'home'],
  },
  {
    code: 'material',
    name: 'Material',
    type: AttributeType.SELECT,
    options: ['Cotton', 'Linen', 'Polyester', 'Leather', 'Wood', 'Metal'],
    isFilterable: true,
    isVariant: false,
    categories: ['fashion', 'home'],
  },
  {
    code: 'battery_life',
    name: 'Battery life',
    type: AttributeType.NUMBER,
    unit: 'hours',
    options: [],
    isFilterable: true,
    isVariant: false,
    categories: ['electronics'],
  },
  {
    code: 'net_quantity',
    name: 'Net quantity',
    type: AttributeType.NUMBER,
    unit: 'g',
    options: [],
    isFilterable: false,
    isVariant: true,
    categories: ['grocery', 'beauty'],
  },
];

const PAGES = [
  {
    slug: 'about',
    title: 'About Trustlon',
    body: '# About Trustlon\n\nTrustlon is a marketplace for products from verified sellers and our own brand.\n\n## Why shop with us\n\n- Payments are held in escrow until your order is delivered and the return window closes.\n- Every seller completes identity, tax and bank checks before listing.\n- Returns are requested from your account and tracked at every step.\n\n_Sample text: replace it from Admin › Marketing › Pages._',
  },
  {
    slug: 'terms',
    title: 'Terms of use',
    body: '# Terms of use\n\n_Sample text. Have your legal team review these terms before launch._\n\n## Using Trustlon\n\nBy using Trustlon you agree to these terms.\n\n## Orders\n\nAn order is a contract between you and the seller. Trustlon operates the marketplace and holds payments in escrow.',
  },
  {
    slug: 'privacy',
    title: 'Privacy policy',
    body: '# Privacy policy\n\n_Sample text. Have your legal team review it for the DPDP Act before launch._\n\nWe collect only what we need to process your orders and keep your account safe.',
  },
  {
    slug: 'returns-policy',
    title: 'Returns and refunds policy',
    body: '# Returns and refunds\n\n_Sample text._\n\n- Most items can be returned within 7 days of delivery.\n- Refunds go to your original payment method or your Trustlon wallet.',
  },
  {
    slug: 'shipping-policy',
    title: 'Shipping policy',
    body: '# Shipping\n\n_Sample text._\n\nDelivery is free on orders above ₹499. Delivery times depend on your PIN code.',
  },
];

export async function seedAdmin(prisma: PrismaClient, now = new Date()) {
  const summary = { vendors: 0, products: 0, reports: 0 };

  // KYC for the vendors created by the home page seed: approved, with passed checks.
  const existing = await prisma.vendor.findMany({
    where: { status: VendorStatus.ACTIVE, kyc: { is: null } },
  });
  for (const vendor of existing) {
    await prisma.vendorKyc.create({
      data: {
        vendorId: vendor.id,
        status: KycStatus.APPROVED,
        gstin: vendor.gstin,
        gstinCheck: CheckResult.PASSED,
        panCheck: CheckResult.PASSED,
        pennyDropCheck: CheckResult.PASSED,
        bankAccountLast4: String(1000 + Math.floor(Math.random() * 8999)),
        submittedAt: new Date(vendor.createdAt.getTime() - 3 * DAY),
        reviewedAt: vendor.createdAt,
      },
    });
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { kycApprovedAt: vendor.kycApprovedAt ?? vendor.createdAt },
    });
  }

  // Trust Score history: the last 30 days for every active vendor.
  const active = await prisma.vendor.findMany({
    where: { status: VendorStatus.ACTIVE },
    select: { id: true, trustScore: true },
  });
  for (const vendor of active) {
    const has = await prisma.vendorTrustScore.count({ where: { vendorId: vendor.id } });
    if (has) continue;
    await prisma.vendorTrustScore.createMany({
      data: Array.from({ length: 30 }, (_, i) => {
        const day = new Date(now.getTime() - (29 - i) * DAY);
        const drift = Math.round(Math.sin(i / 4) * 2) - (29 - i > 20 ? 2 : 0);
        return {
          vendorId: vendor.id,
          score: Math.max(0, Math.min(100, vendor.trustScore + drift)),
          recordedOn: new Date(day.toISOString().slice(0, 10)),
        };
      }),
      skipDuplicates: true,
    });
  }

  // New vendors waiting for KYC review, with documents.
  for (const v of NEW_VENDORS) {
    if (await prisma.vendor.findUnique({ where: { slug: v.slug } })) continue;
    const submittedAt = new Date(now.getTime() - v.daysAgo * DAY);
    const vendor = await prisma.vendor.create({
      data: {
        slug: v.slug,
        displayName: v.displayName,
        legalName: v.legalName,
        initials: v.initials,
        gstin: v.gstin,
        status: VendorStatus.PENDING,
        createdAt: submittedAt,
        kyc: {
          create: {
            status: v.status,
            pan: v.pan,
            panName: v.panName,
            panCheck: v.checks[0],
            gstin: v.gstin,
            gstinLegalName: v.legalName.toUpperCase(),
            gstinCheck: v.checks[1],
            bankAccountLast4: v.last4,
            ifsc: v.ifsc,
            bankName: v.bankName,
            pennyDropName: v.pennyDropName,
            pennyDropCheck: v.checks[2],
            submittedAt,
            ...(v.status === KycStatus.MORE_INFO_REQUIRED
              ? {
                  requestedDocuments: [VendorDocumentType.GST_CERTIFICATE],
                  reviewNote: 'The GST certificate is unreadable. Please upload a clear copy.',
                }
              : {}),
          },
        },
      },
    });
    const docs: Array<[VendorDocumentType, string, Buffer, string]> = [
      [VendorDocumentType.PAN_CARD, 'pdf', pdf(`PAN card - ${v.legalName}`), 'pan-card.pdf'],
      [
        VendorDocumentType.GST_CERTIFICATE,
        'pdf',
        pdf(`GST certificate - ${v.gstin}`),
        'gst-certificate.pdf',
      ],
      [VendorDocumentType.CANCELLED_CHEQUE, 'png', PNG, 'cancelled-cheque.png'],
    ];
    for (const [type, ext, content, fileName] of docs) {
      const key = `vendors/${vendor.id}/${randomUUID()}.${ext}`;
      await store(key, content);
      await prisma.vendorDocument.create({
        data: {
          vendorId: vendor.id,
          type,
          storageKey: key,
          contentType: ext === 'pdf' ? 'application/pdf' : 'image/png',
          sizeBytes: content.length,
          fileName,
        },
      });
    }
    summary.vendors += 1;
  }

  // HSN master (rates from 22 September 2025).
  for (const row of HSN) {
    await prisma.hsnRate.upsert({
      where: { code_effectiveFrom: { code: row.code, effectiveFrom: new Date('2025-09-22') } },
      create: {
        code: row.code,
        description: row.description,
        gstRateBps: row.rate * 100,
        effectiveFrom: new Date('2025-09-22'),
      },
      update: {},
    });
  }

  // Attributes and category attribute sets.
  for (const a of ATTRIBUTES) {
    const attribute = await prisma.attribute.upsert({
      where: { code: a.code },
      create: {
        code: a.code,
        name: a.name,
        type: a.type,
        unit: 'unit' in a ? a.unit : null,
        options: a.options,
        isFilterable: a.isFilterable,
        isVariant: a.isVariant,
      },
      update: {},
    });
    const categories = await prisma.category.findMany({
      where: { slug: { in: a.categories } },
      select: { id: true },
    });
    for (const [index, category] of categories.entries()) {
      await prisma.categoryAttribute.upsert({
        where: { categoryId_attributeId: { categoryId: category.id, attributeId: attribute.id } },
        create: {
          categoryId: category.id,
          attributeId: attribute.id,
          isRequired: a.isVariant,
          sortOrder: index,
        },
        update: {},
      });
    }
  }

  // Products waiting for moderation: two new listings and one edit to a live product.
  const soundspace = await prisma.vendor.findUnique({ where: { slug: 'soundspace' } });
  const urban = await prisma.vendor.findUnique({ where: { slug: 'urban-thread' } });
  const audio = await prisma.category.findUnique({ where: { slug: 'headphones-and-audio' } });
  const clothing = await prisma.category.findFirst({
    where: { slug: { in: ['mens-clothing', 'men-s-clothing', 'footwear'] } },
  });
  const newListings = [
    soundspace &&
      audio && {
        slug: 'soundspace-studio-pro-anc-headphones',
        name: 'SoundSpace Studio Pro ANC headphones',
        vendorId: soundspace.id,
        categoryId: audio.id,
        brand: 'SoundSpace',
        imageUrl: '/images/home/headphones.jpg',
        pricePaise: 2_499_900,
        mrpPaise: 3_299_900,
        hsnCode: '8518',
        description:
          'Flagship over-ear headphones with adaptive noise cancelling and 40-hour battery.',
      },
    urban &&
      clothing && {
        slug: 'urban-thread-linen-overshirt',
        name: 'Urban Thread linen overshirt',
        vendorId: urban.id,
        categoryId: clothing.id,
        brand: 'Urban Thread',
        imageUrl: '/images/home/sneakers.jpg',
        pricePaise: 189_900,
        mrpPaise: 249_900,
        hsnCode: '6109',
        description: 'Relaxed-fit overshirt in breathable linen.',
      },
  ].filter(Boolean) as Array<{
    slug: string;
    name: string;
    vendorId: string;
    categoryId: string;
    brand: string;
    imageUrl: string;
    pricePaise: number;
    mrpPaise: number;
    hsnCode: string;
    description: string;
  }>;
  for (const [index, p] of newListings.entries()) {
    if (await prisma.product.findUnique({ where: { slug: p.slug } })) continue;
    const submittedAt = new Date(now.getTime() - (index + 1) * 5 * 3_600_000);
    await prisma.product.create({
      data: {
        ...p,
        discountPercent: Math.round(((p.mrpPaise - p.pricePaise) / p.mrpPaise) * 100),
        stock: 40,
        status: ProductStatus.PENDING_APPROVAL,
        submittedAt,
        searchText: `${p.name} ${p.brand}`.toLowerCase(),
        submissions: { create: { kind: SubmissionKind.NEW, submittedAt } },
      },
    });
    summary.products += 1;
  }
  const live = await prisma.product.findUnique({ where: { slug: 'everyday-classic-sneakers' } });
  if (live && !(await prisma.productSubmission.count({ where: { productId: live.id } }))) {
    await prisma.productSubmission.create({
      data: {
        productId: live.id,
        kind: SubmissionKind.EDIT,
        changes: [
          { field: 'name', before: live.name, after: 'Everyday classic canvas sneakers' },
          { field: 'pricePaise', before: live.pricePaise, after: 159_900 },
        ],
        submittedAt: new Date(now.getTime() - 3 * 3_600_000),
      },
    });
    summary.products += 1;
  }

  // Reports from a customer about a listing and a review.
  const customer = await prisma.user.findFirst({
    where: { role: UserRole.CUSTOMER, deletedAt: null },
  });
  const reported = await prisma.product.findUnique({
    where: { slug: 'soundspace-wireless-headphones' },
  });
  if (customer && reported && !(await prisma.contentReport.count())) {
    await prisma.contentReport.create({
      data: {
        targetType: ReportTarget.PRODUCT,
        targetId: reported.id,
        reason: ReportReason.COUNTERFEIT,
        details: 'The box looked different from the photos and had no serial number.',
        reporterId: customer.id,
        reporterKind: ReporterKind.CUSTOMER,
      },
    });
    summary.reports += 1;
    const review = await prisma.review.findFirst({ where: { status: 'PUBLISHED' } });
    if (review) {
      await prisma.contentReport.create({
        data: {
          targetType: ReportTarget.REVIEW,
          targetId: review.id,
          reason: ReportReason.FAKE_REVIEW,
          details: 'Looks copied from another product.',
          reporterKind: ReporterKind.VENDOR,
        },
      });
      summary.reports += 1;
    }
  }

  // CMS pages (sample text, published) and a welcome coupon.
  for (const page of PAGES) {
    await prisma.cmsPage.upsert({
      where: { slug: page.slug },
      create: { ...page, isPublished: true, publishedAt: now },
      update: {},
    });
  }
  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    create: {
      code: 'WELCOME10',
      description: '10% off your first order, up to ₹200',
      type: CouponType.PERCENT,
      value: 1000,
      maxDiscountPaise: 20_000,
      minOrderPaise: 49_900,
      audience: CouponAudience.NEW_USERS,
      startsAt: now,
      endsAt: new Date(now.getTime() + 60 * DAY),
    },
    update: {},
  });

  return summary;
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedAdmin(prisma)
    .then((s) =>
      console.log(
        `Admin sample data ready: ${s.vendors} vendor(s) waiting for KYC, ${s.products} product(s) waiting for moderation, ${s.reports} report(s).`,
      ),
    )
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
