/** Isolated, repeatable development fixtures. Coordinates are illustrative, not geocoding data. */
import { PrismaClient, VendorStatus } from '@prisma/client';
import { buildSearchText, computeDiscountPercent } from '../src/modules/catalog/catalog.queries';

const LAT = 28.8386;
const LNG = 78.7733;
const north = (km: number) => LAT + ((km / 6371) * 180) / Math.PI;

export const LOCAL_DEMO_SELLERS = [
  { slug: 'local-demo-central', name: 'Moradabad Central', km: 0, enabled: true },
  { slug: 'local-demo-craft', name: 'Neighbourhood Crafts', km: 3, enabled: true },
  { slug: 'local-demo-pantry', name: 'Nearby Pantry', km: 8, enabled: true },
  { slug: 'local-demo-home', name: 'Local Home', km: 15, enabled: true },
  { slug: 'local-demo-farm', name: 'Farm Favourites', km: 23, enabled: true },
  { slug: 'local-demo-distant', name: 'Distant Market', km: 30, enabled: true },
  { slug: 'local-demo-disabled', name: 'Standard Delivery Only', km: 2, enabled: false },
  { slug: 'local-demo-pending', name: 'Awaiting Approval', km: 1, enabled: true, pending: true },
  {
    slug: 'local-demo-next-day',
    name: 'Tomorrow Market',
    km: 4,
    enabled: true,
    cutoff: '00:00',
    nextDay: true,
  },
  { slug: 'local-demo-cutoff', name: 'Closed for Today', km: 1.5, enabled: true, cutoff: '00:00' },
] as const;

export async function seedLocal(prisma: PrismaClient, ownerEmail?: string) {
  const owner = ownerEmail ? await prisma.user.findUnique({ where: { email: ownerEmail } }) : null;
  if (ownerEmail && (!owner || owner.role !== 'VENDOR_OWNER')) {
    throw new Error('LOCAL_SELLER_OWNER_EMAIL must identify an existing VENDOR_OWNER account');
  }
  const pins = [
    {
      pincode: '244001',
      city: 'Moradabad',
      state: 'Uttar Pradesh',
      latitude: LAT,
      longitude: LNG,
      serviceable: true,
    },
    {
      pincode: '244102',
      city: 'Moradabad',
      state: 'Uttar Pradesh',
      latitude: north(15),
      longitude: LNG,
      serviceable: true,
    },
    {
      pincode: '244104',
      city: 'Moradabad',
      state: 'Uttar Pradesh',
      latitude: north(23),
      longitude: LNG,
      serviceable: true,
    },
    {
      pincode: '244901',
      city: 'Rampur',
      state: 'Uttar Pradesh',
      latitude: 28.8,
      longitude: 79.02,
      serviceable: true,
    },
    {
      pincode: '110001',
      city: 'New Delhi',
      state: 'Delhi',
      latitude: 28.6304,
      longitude: 77.2177,
      serviceable: true,
    },
    {
      pincode: '400001',
      city: 'Mumbai',
      state: 'Maharashtra',
      latitude: 18.9388,
      longitude: 72.8354,
      serviceable: true,
    },
    {
      pincode: '560001',
      city: 'Bengaluru',
      state: 'Karnataka',
      latitude: 12.9757,
      longitude: 77.6055,
      serviceable: true,
    },
  ];
  for (const pin of pins) {
    // Keep existing operations-managed serviceability and coordinates intact.
    await prisma.pincode.upsert({ where: { pincode: pin.pincode }, create: pin, update: {} });
  }
  const category = await prisma.category.upsert({
    where: { slug: 'local-demo-essentials' },
    create: { slug: 'local-demo-essentials', name: 'Local essentials' },
    update: {},
  });
  for (const fixture of LOCAL_DEMO_SELLERS) {
    const pending = 'pending' in fixture && fixture.pending;
    const data = {
      displayName: fixture.name,
      initials: 'LM',
      status: pending ? VendorStatus.PENDING : VendorStatus.ACTIVE,
      kycApprovedAt: pending ? null : new Date('2026-01-01T00:00:00Z'),
      isVerified: !pending,
      pickupPincode: '244001',
      pickupAddress: `${fixture.name}, demo pickup street`,
      pickupLat: north(fixture.km),
      pickupLng: LNG,
      sameDayDelivery: fixture.enabled,
      nextDayDelivery: 'nextDay' in fixture && fixture.nextDay,
      deliveryCutoffTime: 'cutoff' in fixture ? fixture.cutoff : null,
      deletedAt: null,
      ...(owner ? { ownerId: owner.id } : {}),
    };
    const vendor = await prisma.vendor.upsert({
      where: { slug: fixture.slug },
      create: { slug: fixture.slug, ...data },
      update: data,
    });
    const items = [
      ['Coffee', '/images/home/coffee.jpg'],
      ['Desk lamp', '/images/home/lamp.jpg'],
      ['Backpack', '/images/home/backpack.jpg'],
      ['Chair', '/images/home/chair.jpg'],
      ['Draft product', '/images/home/coffee.jpg'],
      ['Sold-out product', '/images/home/lamp.jpg'],
    ];
    for (const [index, [label, imageUrl]] of items.entries()) {
      const name = `${fixture.name} ${label}`;
      const pricePaise = (199 + index * 100) * 100;
      const mrpPaise = pricePaise + 10000;
      const product = {
        name,
        imageUrl,
        pricePaise,
        mrpPaise,
        vendorId: vendor.id,
        categoryId: category.id,
        status: index === 4 ? ('DRAFT' as const) : ('LIVE' as const),
        stock: index === 5 ? 0 : 20,
        discountPercent: computeDiscountPercent(pricePaise, mrpPaise),
        deletedAt: null,
        searchText: buildSearchText([name, fixture.name, category.name]),
        salesCount: 10 - index,
      };
      await prisma.product.upsert({
        where: { slug: `${fixture.slug}-${index + 1}` },
        create: { slug: `${fixture.slug}-${index + 1}`, ...product },
        update: product,
      });
    }
  }
}

if (require.main === module) {
  if (process.env.NODE_ENV === 'production') throw new Error('Local demo seed is development-only');
  const prisma = new PrismaClient();
  seedLocal(prisma, process.env.LOCAL_SELLER_OWNER_EMAIL)
    .then(() => process.stdout.write('Local demo: 10 sellers and 60 products ready.\n'))
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : 'Local seed failed'}\n`);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
