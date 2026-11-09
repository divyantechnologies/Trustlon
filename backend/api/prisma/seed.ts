/**
 * Development seed for the storefront home page. Safe to run many times: rows are upserted.
 * Run with `npm run db:seed` from the repository root. Never run against production.
 */
import { BannerPlacement, HomeSectionKey, PrismaClient, ProductStatus, VendorStatus } from '@prisma/client';

const rupees = (value: number) => Math.round(value * 100);

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const PINCODES = [
  { pincode: '560001', area: 'MG Road', city: 'Bengaluru', state: 'Karnataka', latitude: 12.9757, longitude: 77.6055, sameDayAvailable: true, deliveryDays: 2 },
  { pincode: '560034', area: 'Koramangala', city: 'Bengaluru', state: 'Karnataka', latitude: 12.9352, longitude: 77.6245, sameDayAvailable: true, deliveryDays: 2 },
  { pincode: '560038', area: 'Indiranagar', city: 'Bengaluru', state: 'Karnataka', latitude: 12.9719, longitude: 77.6412, sameDayAvailable: true, deliveryDays: 2 },
  { pincode: '400001', area: 'Fort', city: 'Mumbai', state: 'Maharashtra', latitude: 18.9388, longitude: 72.8354, sameDayAvailable: false, deliveryDays: 3 },
  { pincode: '110001', area: 'Connaught Place', city: 'New Delhi', state: 'Delhi', latitude: 28.6304, longitude: 77.2177, sameDayAvailable: false, deliveryDays: 3 },
  { pincode: '600001', area: 'Parrys', city: 'Chennai', state: 'Tamil Nadu', latitude: 13.0878, longitude: 80.2785, sameDayAvailable: false, deliveryDays: 4 },
  { pincode: '700001', area: 'BBD Bagh', city: 'Kolkata', state: 'West Bengal', latitude: 22.5726, longitude: 88.3639, sameDayAvailable: false, deliveryDays: 5 },
];

const CATEGORIES = [
  { slug: 'electronics', name: 'Electronics', nameHi: 'इलेक्ट्रॉनिक्स', image: '/images/home/headphones.jpg', hsn: '8518', children: ['Headphones & audio', 'Smart watches', 'Computers & accessories', 'Cameras'] },
  { slug: 'fashion', name: 'Fashion', nameHi: 'फ़ैशन', image: '/images/home/sneakers.jpg', hsn: '6404', children: ['Women’s clothing', 'Men’s clothing', 'Footwear', 'Bags & accessories'] },
  { slug: 'home', name: 'Home & Living', nameHi: 'घर और जीवनशैली', image: '/images/home/chair.jpg', hsn: '9403', children: ['Furniture', 'Kitchen & dining', 'Lighting', 'Home décor'] },
  { slug: 'beauty', name: 'Beauty', nameHi: 'ब्यूटी', image: '/images/home/skincare.jpg', hsn: '3304', children: ['Skincare', 'Haircare', 'Bath & body', 'Beauty essentials'] },
  { slug: 'grocery', name: 'Grocery', nameHi: 'किराना', image: '/images/home/coffee.jpg', hsn: '0901', children: ['Tea & coffee', 'Pantry staples', 'Healthy snacks', 'Fresh picks'] },
  { slug: 'sports', name: 'Sports & Outdoors', nameHi: 'खेल और आउटडोर', image: '/images/home/backpack.jpg', hsn: '4202', children: ['Fitness', 'Travel essentials', 'Outdoor gear', 'Activewear'] },
];

const VENDORS = [
  { slug: 'trustlon', displayName: 'Trustlon', initials: 'tl', tagline: 'Everyday essentials, designed by Trustlon', bannerUrl: '/images/home/interior.jpg', trustScore: 100, isPlatformOwned: true, isFeatured: false, featuredOrder: 0, pickupPincode: '560001', sameDayDelivery: false },
  { slug: 'soundspace', displayName: 'SoundSpace', initials: 'ss.', tagline: 'Sound that moves you', bannerUrl: '/images/home/audio.jpg', trustScore: 98, isPlatformOwned: false, isFeatured: true, featuredOrder: 1, pickupPincode: '400001', sameDayDelivery: false },
  { slug: 'urban-thread', displayName: 'Urban Thread', initials: 'ut', tagline: 'Your everyday, elevated', bannerUrl: '/images/home/sneakers.jpg', trustScore: 96, isPlatformOwned: false, isFeatured: true, featuredOrder: 2, pickupPincode: '110001', sameDayDelivery: false },
  { slug: 'pure-and-kind', displayName: 'Pure & Kind', initials: 'p&k', tagline: 'Feel good in your skin', bannerUrl: '/images/home/skincare.jpg', trustScore: 99, isPlatformOwned: false, isFeatured: true, featuredOrder: 3, pickupPincode: '600001', sameDayDelivery: false },
  { slug: 'the-daily-pantry', displayName: 'The Daily Pantry', initials: 'dp', tagline: 'Goodness, every day', bannerUrl: '/images/home/coffee.jpg', trustScore: 97, isPlatformOwned: false, isFeatured: true, featuredOrder: 4, pickupPincode: '560034', sameDayDelivery: true, localArea: 'Neighbourhood market', localCategory: 'Artisan pantry favourites' },
  { slug: 'green-basket', displayName: 'Green Basket', initials: 'gb', tagline: 'Fresh from the neighbourhood', bannerUrl: '/images/home/coffee.jpg', trustScore: 94, isPlatformOwned: false, isFeatured: false, featuredOrder: 0, pickupPincode: '560001', sameDayDelivery: true, localArea: 'Your neighbourhood', localCategory: 'Fresh groceries & essentials' },
  { slug: 'the-living-room', displayName: 'The Living Room', initials: 'lr', tagline: 'Pieces for every corner', bannerUrl: '/images/home/interior.jpg', trustScore: 95, isPlatformOwned: false, isFeatured: false, featuredOrder: 0, pickupPincode: '560038', sameDayDelivery: true, localArea: 'Local shopping district', localCategory: 'Home & lifestyle' },
];

/** price = what the customer pays today. Deal items get a higher list price and a deal at `price`. */
const PRODUCTS = [
  { slug: 'soundspace-wireless-headphones', name: 'SoundSpace wireless headphones', vendor: 'soundspace', category: 'headphones-and-audio', image: '/images/home/headphones.jpg', price: 2499, mrp: 4999, rating: 4.8, ratingCount: 2140, salesCount: 980, badge: 'Bestseller', deal: true, brand: 'SoundSpace' },
  { slug: 'everyday-classic-sneakers', name: 'Everyday classic sneakers', vendor: 'urban-thread', category: 'footwear', image: '/images/home/sneakers.jpg', price: 1799, mrp: 2999, rating: 4.6, ratingCount: 860, salesCount: 640, deal: true, brand: 'Urban Thread' },
  { slug: 'trustlon-studio-desk-lamp', name: 'Trustlon Studio desk lamp', vendor: 'trustlon', category: 'lighting', image: '/images/home/lamp.jpg', price: 1299, mrp: 2199, rating: 4.7, ratingCount: 530, salesCount: 720, deal: true, brand: 'Trustlon Studio' },
  { slug: 'daily-glow-skincare-essentials', name: 'Daily glow skincare essentials', vendor: 'pure-and-kind', category: 'skincare', image: '/images/home/skincare.jpg', price: 899, mrp: 1499, rating: 4.9, ratingCount: 1890, salesCount: 900, badge: 'Popular pick', deal: true, brand: 'Pure & Kind' },
  { slug: 'trustlon-go-everyday-backpack', name: 'Trustlon Go everyday backpack', vendor: 'trustlon', category: 'travel-essentials', image: '/images/home/backpack.jpg', price: 1499, mrp: 2499, rating: 4.7, ratingCount: 410, salesCount: 610, deal: true, brand: 'Trustlon Go' },
  { slug: 'trustlon-home-accent-chair', name: 'Trustlon Home accent chair', vendor: 'trustlon', category: 'furniture', image: '/images/home/chair.jpg', price: 5999, mrp: 8999, rating: 4.8, ratingCount: 220, salesCount: 540, brand: 'Trustlon Home' },
  { slug: 'highland-artisan-coffee-250g', name: 'Highland artisan coffee · 250 g', vendor: 'the-daily-pantry', category: 'tea-and-coffee', image: '/images/home/coffee.jpg', price: 449, mrp: 599, rating: 4.8, ratingCount: 1320, salesCount: 870, brand: 'The Daily Pantry' },
  { slug: 'trustlon-move-smart-watch', name: 'Trustlon Move smart watch', vendor: 'trustlon', category: 'smart-watches', image: '/images/home/watch.jpg', price: 1999, mrp: 3499, rating: 4.5, ratingCount: 760, salesCount: 700, brand: 'Trustlon Move' },
  { slug: 'fresh-roast-filter-coffee-500g', name: 'Fresh-roast filter coffee · 500 g', vendor: 'green-basket', category: 'tea-and-coffee', image: '/images/home/coffee.jpg', price: 399, mrp: 499, rating: 4.6, ratingCount: 340, salesCount: 410, brand: 'Green Basket' },
  { slug: 'handpicked-living-room-accent-chair', name: 'Handpicked living room accent chair', vendor: 'the-living-room', category: 'furniture', image: '/images/home/interior.jpg', price: 7499, mrp: 9999, rating: 4.7, ratingCount: 95, salesCount: 120, brand: 'The Living Room' },
  // Combo / bundle products for the "Combo products" row.
  { slug: 'daily-glow-skincare-bundle', name: 'Daily glow skincare bundle · 3 pieces', vendor: 'pure-and-kind', category: 'skincare', image: '/images/home/skincare.jpg', price: 1999, mrp: 3499, rating: 4.7, ratingCount: 128, salesCount: 300, bundle: true, brand: 'Pure & Kind' },
  { slug: 'work-from-home-audio-combo', name: 'Work-from-home audio combo', vendor: 'soundspace', category: 'headphones-and-audio', image: '/images/home/headphones.jpg', price: 3999, mrp: 6999, rating: 4.6, ratingCount: 210, salesCount: 280, bundle: true, brand: 'SoundSpace' },
  { slug: 'trustlon-travel-ready-combo', name: 'Trustlon travel-ready combo', vendor: 'trustlon', category: 'travel-essentials', image: '/images/home/backpack.jpg', price: 2799, mrp: 4499, rating: 4.8, ratingCount: 96, salesCount: 260, bundle: true, brand: 'Trustlon Go' },
  { slug: 'morning-coffee-gift-set', name: 'Morning coffee gift set', vendor: 'the-daily-pantry', category: 'tea-and-coffee', image: '/images/home/coffee.jpg', price: 899, mrp: 1299, rating: 4.9, ratingCount: 175, salesCount: 240, bundle: true, brand: 'The Daily Pantry' },
  { slug: 'trustlon-reading-corner-combo', name: 'Trustlon reading corner combo', vendor: 'trustlon', category: 'lighting', image: '/images/home/lamp.jpg', price: 6799, mrp: 10999, rating: 4.7, ratingCount: 64, salesCount: 220, bundle: true, brand: 'Trustlon Studio' },
];

const BANNERS = [
  { id: '7a1f0d4e-0b1c-4a8e-9a51-6c2b1e9f0004', placement: BannerPlacement.HOME_HERO, priority: 40, eyebrow: 'ELECTRONICS & APPLIANCES', title: 'Join fellow shoppers\nand collect.', subtitle: '30% storewide voucher · No minimum spend · Free shipping', ctaLabel: 'Shop now', imageUrl: '/images/home/audio.jpg', href: '/browse/electronics', tagLabel: 'Trustlon Move smart watch · ₹1,999', highlights: [] as string[] },
  { id: '7a1f0d4e-0b1c-4a8e-9a51-6c2b1e9f0001', placement: BannerPlacement.HOME_HERO, priority: 30, eyebrow: 'THE EVERYDAY UPGRADE', title: 'Good finds.\nGreat peace of mind.', subtitle: 'Discover thoughtful essentials from brands you love. Every purchase, protected by Trustlon.', ctaLabel: 'Explore the collection', imageUrl: '/images/home/hero.jpg', href: '/browse/everyday', tagLabel: 'The Trustlon edit', highlights: [] as string[] },
  { id: '7a1f0d4e-0b1c-4a8e-9a51-6c2b1e9f0002', placement: BannerPlacement.HOME_HERO, priority: 20, eyebrow: 'MAKE ROOM FOR BETTER', title: 'A little refresh.\nA lot more home.', subtitle: 'Bring comfort to your everyday with considered pieces for every corner.', ctaLabel: 'Find your home favourites', imageUrl: '/images/home/interior.jpg', href: '/browse/home', tagLabel: 'The Trustlon edit', highlights: [] as string[] },
  { id: '7a1f0d4e-0b1c-4a8e-9a51-6c2b1e9f0003', placement: BannerPlacement.HOME_HERO, priority: 10, eyebrow: 'SMALL UPGRADES. BIG DIFFERENCE.', title: 'Tune into\nyour everyday.', subtitle: 'Great sound, smart essentials, and technology that fits your life.', ctaLabel: 'Discover electronics', imageUrl: '/images/home/audio.jpg', href: '/browse/electronics', tagLabel: 'The Trustlon edit', highlights: [] as string[] },
  { id: '7a1f0d4e-0b1c-4a8e-9a51-6c2b1e9f0011', placement: BannerPlacement.HOME_STRIP, priority: 10, eyebrow: 'SUPER SALE', title: 'Super sale', subtitle: null, ctaLabel: 'Explore now', imageUrl: '/images/home/hero.jpg', href: '/browse/deals', tagLabel: null, highlights: ['SALE 70% · CODE SAVE70', 'SALE 50% · CODE SAVE50', 'SALE 30% · CODE SAVE30', 'SALE 10% · CODE SAVE10'] },
  { id: '7a1f0d4e-0b1c-4a8e-9a51-6c2b1e9f0021', placement: BannerPlacement.HOME_WIDE, priority: 20, eyebrow: 'CYBER MONDAY', title: 'Brand week sale', subtitle: 'Up to 75% off', ctaLabel: 'Shop the sale', imageUrl: '/images/home/audio.jpg', href: '/browse/deals', tagLabel: null, highlights: [] as string[] },
  { id: '7a1f0d4e-0b1c-4a8e-9a51-6c2b1e9f0022', placement: BannerPlacement.HOME_WIDE, priority: 10, eyebrow: 'OFFICIAL LAUNCH SPECIAL', title: '30% off from retail', subtitle: 'Trustlon Home furniture', ctaLabel: 'Shop furniture', imageUrl: '/images/home/chair.jpg', href: '/browse/furniture', tagLabel: null, highlights: [] as string[] },
  { id: '7a1f0d4e-0b1c-4a8e-9a51-6c2b1e9f0031', placement: BannerPlacement.HOME_SIDE, priority: 20, eyebrow: 'BEAUTY & HEALTH', title: '#WomenCare', subtitle: 'Skincare bundles from verified brands', ctaLabel: 'Shop beauty', imageUrl: '/images/home/skincare.jpg', href: '/browse/beauty', tagLabel: null, highlights: [] as string[] },
  { id: '7a1f0d4e-0b1c-4a8e-9a51-6c2b1e9f0032', placement: BannerPlacement.HOME_SIDE, priority: 10, eyebrow: 'SPECIAL OFFER', title: 'SUMMER', subtitle: 'Up to 80% off · Buy 1 get 1', ctaLabel: 'See offers', imageUrl: '/images/home/hero.jpg', href: '/browse/deals', tagLabel: null, highlights: [] as string[] },
];

const SECTION_ORDER: Array<{ key: HomeSectionKey; title: string; subtitle?: string }> = [
  { key: HomeSectionKey.HERO_BANNERS, title: 'Featured' },
  { key: HomeSectionKey.CATEGORY_TILES, title: 'Shop by category' },
  { key: HomeSectionKey.DEALS_OF_THE_DAY, title: 'Deals of the day', subtitle: 'Great finds. Even better prices. A fresh reason to treat yourself.' },
  { key: HomeSectionKey.TRUSTLON_ORIGINALS, title: 'Trustlon Originals' },
  { key: HomeSectionKey.FEATURED_STORES, title: 'Verified brand stores' },
  { key: HomeSectionKey.LOCAL_SELLERS, title: 'Good things, closer to home' },
  { key: HomeSectionKey.RECENTLY_VIEWED, title: 'Recently viewed' },
  { key: HomeSectionKey.RECOMMENDED, title: 'Picked for you' },
  { key: HomeSectionKey.TRUST_STRIP, title: 'Shop with confidence' },
];

/** List price for deal items: about 15% above the deal price, ending in 99, never above MRP. */
const listPriceFor = (price: number, mrp: number) => Math.min(mrp, Math.ceil((price * 1.15) / 100) * 100 - 1);

export async function seedHomepage(prisma: PrismaClient): Promise<{ products: number }> {
  for (const pin of PINCODES) {
    await prisma.pincode.upsert({ where: { pincode: pin.pincode }, create: pin, update: pin });
  }

  const categoryIds = new Map<string, { id: string; name: string; parentName: string | null }>();
  for (const [rootIndex, root] of CATEGORIES.entries()) {
    const rootData = { name: root.name, nameHi: root.nameHi, imageUrl: root.image, sortOrder: rootIndex, defaultHsn: root.hsn, parentId: null };
    const parent = await prisma.category.upsert({ where: { slug: root.slug }, create: { slug: root.slug, ...rootData }, update: rootData });
    categoryIds.set(root.slug, { id: parent.id, name: parent.name, parentName: null });

    for (const [childIndex, childName] of root.children.entries()) {
      const slug = slugify(childName);
      const childData = { name: childName, sortOrder: childIndex, parentId: parent.id, defaultHsn: root.hsn };
      const child = await prisma.category.upsert({ where: { slug }, create: { slug, ...childData }, update: childData });
      categoryIds.set(slug, { id: child.id, name: child.name, parentName: parent.name });
    }
  }

  const vendorIds = new Map<string, { id: string; name: string }>();
  const kycApprovedAt = new Date('2026-10-01T00:00:00Z');
  for (const vendor of VENDORS) {
    const data = { ...vendor, status: VendorStatus.ACTIVE, isVerified: true, kycApprovedAt, deletedAt: null };
    const row = await prisma.vendor.upsert({ where: { slug: vendor.slug }, create: data, update: data });
    vendorIds.set(vendor.slug, { id: row.id, name: row.displayName });
  }

  const now = Date.now();
  const dealStart = new Date(now - 60 * 60 * 1000);
  const dealEnd = new Date(now + 24 * 60 * 60 * 1000);

  for (const item of PRODUCTS) {
    const vendor = vendorIds.get(item.vendor);
    const category = categoryIds.get(item.category);
    if (!vendor || !category) throw new Error(`Seed data error for ${item.slug}`);

    const sellingPrice = item.deal ? listPriceFor(item.price, item.mrp) : item.price;
    const data = {
      name: item.name,
      brand: item.brand,
      description: `${item.name}. Sold by ${vendor.name} and protected by Trustlon escrow.`,
      imageUrl: item.image,
      images: [item.image],
      pricePaise: rupees(sellingPrice),
      mrpPaise: rupees(item.mrp),
      stock: 50,
      status: ProductStatus.LIVE,
      badge: item.badge ?? null,
      ratingAvg: item.rating,
      ratingCount: item.ratingCount,
      salesCount: item.salesCount,
      isBundle: item.bundle ?? false,
      vendorId: vendor.id,
      categoryId: category.id,
      deletedAt: null,
      searchText: [item.name, item.brand, vendor.name, category.name, category.parentName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    };
    const product = await prisma.product.upsert({ where: { slug: item.slug }, create: { slug: item.slug, ...data }, update: data });

    await prisma.deal.deleteMany({ where: { productId: product.id } });
    if (item.deal) {
      await prisma.deal.create({
        data: { productId: product.id, dealPricePaise: rupees(item.price), startsAt: dealStart, endsAt: dealEnd, sortOrder: PRODUCTS.indexOf(item) },
      });
    }
  }

  for (const banner of BANNERS) {
    const { id, ...data } = banner;
    await prisma.banner.upsert({ where: { id }, create: { id, ...data, isActive: true }, update: { ...data, isActive: true } });
  }

  for (const [index, section] of SECTION_ORDER.entries()) {
    const data = { title: section.title, subtitle: section.subtitle ?? null, isEnabled: true, sortOrder: index };
    await prisma.homeSection.upsert({ where: { key: section.key }, create: { key: section.key, ...data }, update: data });
  }

  return { products: PRODUCTS.length };
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedHomepage(prisma)
    .then((result) => console.log(`Seeded home page data: ${result.products} products.`))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
