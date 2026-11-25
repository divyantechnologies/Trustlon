import type { Product } from '../types';
const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1000&q=80`;
const images = {
  audio: photo('photo-1505740420928-5e560c06d30e'),
  shirt: photo('photo-1521572163474-6864f9cf17ab'),
  phone: photo('photo-1511707171634-5f897ff02aa9'),
  rice: photo('photo-1586201375761-83865001e31c'),
  sofa: photo('photo-1555041469-a586c61ea9bc'),
};
function base(id: string, title: string, category: string, price: number, image: string): Product {
  return {
    id,
    slug: `demo-${id}`,
    title,
    brand: 'Trustlon Studio',
    category: {
      id: category,
      name: category[0].toUpperCase() + category.slice(1),
      path: [category],
    },
    images: [{ url: image, alt: title }],
    price: { current: price, mrp: Math.round(price * 1.25), currency: 'INR', taxInclusive: true },
    stock: { status: 'in_stock', quantity: 18 },
    seller: { name: 'Trustlon Studio', verified: true, rating: 4.8 },
    policies: {
      returns: '7-day returns on eligible unused products',
      cod: true,
      freeDelivery: true,
      authenticity: true,
      escrow: true,
      securePayments: true,
    },
    offers: [
      {
        type: 'coupon',
        title: 'A little extra, on us',
        description: 'Save 5% with this demo offer.',
        code: 'WELCOME5',
        terms: 'Demo offer for preview only. Cannot be redeemed.',
      },
      {
        type: 'bank',
        title: 'Bank savings',
        description: 'Explore eligible card offers at checkout.',
        terms: 'Illustrative offer; bank eligibility applies.',
      },
    ],
    rating: { average: 4.4, count: 10, distribution: { 5: 6, 4: 3, 3: 0, 2: 1, 1: 0 } },
    reviews: [
      {
        id: `${id}-r1`,
        author: 'Ananya',
        title: 'Matches the description',
        text: 'Arrived carefully packed and the quality met my expectations.',
        rating: 5,
        date: '2026-10-10T12:00:00Z',
        verified: true,
        photos: [{ url: image, alt: 'Sample customer photo' }],
        helpful: 12,
        sellerReply: 'Thank you for sharing your experience.',
      },
      {
        id: `${id}-r2`,
        author: 'Rohan',
        title: 'Good overall',
        text: 'Happy with the product. Delivery took an extra day.',
        rating: 4,
        date: '2026-10-12T12:00:00Z',
        verified: true,
        photos: [],
        helpful: 3,
      },
      {
        id: `${id}-r3`,
        author: 'Dev',
        title: 'Packaging could improve',
        text: 'The outer box arrived damaged.',
        rating: 2,
        date: '2026-10-14T12:00:00Z',
        verified: false,
        photos: [],
        helpful: 1,
      },
      {
        id: `${id}-r4`,
        author: 'Mira',
        title: 'Useful purchase',
        text: 'The product was exactly as pictured.',
        rating: 5,
        date: '2026-10-15T12:00:00Z',
        verified: true,
        photos: [],
        helpful: 0,
      },
    ],
    qna: [
      {
        id: `${id}-q1`,
        question: 'Does this arrive in the original packaging?',
        answer: 'Yes, it ships in the original product packaging.',
        answeredBy: 'Trustlon Studio · Seller',
        upvotes: 4,
      },
    ],
    priceHistory: [60, 40, 20, 0].map((days, i) => ({
      date: new Date(Date.now() - days * 86400000).toISOString().slice(0, 10),
      price: price + [250, 100, -50, 0][i],
    })),
  };
}
const options = (values: string[]) =>
  values.map((value, i) => ({ value, available: i !== values.length - 1 || values.length < 3 }));
const headphones: Product = {
  ...base('headphones', 'Studio over-ear wireless headphones', 'headphones', 2499, images.audio),
  stock: { status: 'low', quantity: 3 },
  variants: [{ type: 'color', label: 'Color', options: options(['Sand', 'Black', 'Blue']) }],
  highlights: [
    { label: 'Sound', value: '40 mm drivers' },
    { label: 'Battery', value: 'Up to 30 hours' },
  ],
  keyFeatures: ['Foldable design for easy storage', 'Soft, replaceable ear cushions'],
  description: {
    overview: 'Your everyday listening companion, designed for long sessions and easy travel.',
    blocks: [
      {
        title: 'Room to unwind',
        text: 'A cushioned fit and adjustable headband help you settle into your favourite music.',
        image: images.audio,
      },
    ],
    inTheBox: ['Headphones', 'Charging cable', 'Quick start guide'],
  },
  specs: [
    { group: 'Audio', items: [{ label: 'Driver size', value: '40 mm' }] },
    { group: 'Connectivity', items: [{ label: 'Wireless', value: 'Bluetooth 5.3' }] },
  ],
  widgets: { warranty: { text: '1-year limited manufacturer warranty' } },
  related: { similar: ['smartphone'], boughtTogether: ['t-shirt'] },
};
const shirt: Product = {
  ...base('t-shirt', 'Everyday organic cotton crew-neck tee', 'fashion', 799, images.shirt),
  variants: [
    { type: 'size', label: 'Size', options: options(['S', 'M', 'L', 'XL']) },
    {
      type: 'color',
      label: 'Color',
      options: [
        { value: 'White', available: true },
        { value: 'Navy', available: true, priceDelta: 100 },
      ],
    },
  ],
  highlights: [
    { label: 'Fabric', value: '100% organic cotton' },
    { label: 'Fit', value: 'Relaxed' },
  ],
  keyFeatures: ['Breathable jersey fabric', 'Reinforced neckline'],
  description: {
    overview: 'An easy everyday staple in soft organic cotton.',
    inTheBox: ['Machine wash cold', 'Dry in shade', 'Do not bleach'],
  },
  specs: [
    {
      group: 'Material',
      items: [
        { label: 'Composition', value: '100% organic cotton' },
        { label: 'Fabric weight', value: '180 GSM' },
      ],
    },
  ],
  widgets: {
    sizeChart: {
      columns: ['Size', 'Chest (cm)', 'Length (cm)'],
      table: [
        ['S', '96', '66'],
        ['M', '102', '69'],
        ['L', '108', '72'],
      ],
    },
    care: { text: 'Wash with similar colours.' },
  },
  related: { similar: ['headphones'] },
};
const phone: Product = {
  ...base('smartphone', 'Nova 5G smartphone', 'mobile', 24999, images.phone),
  variants: [
    {
      type: 'storage',
      label: 'Storage',
      options: [
        { value: '128 GB', available: true },
        { value: '256 GB', available: true, priceDelta: 3000 },
      ],
    },
    { type: 'ram', label: 'RAM', options: options(['8 GB', '12 GB']) },
    { type: 'color', label: 'Color', options: options(['Graphite', 'Silver']) },
  ],
  highlights: [
    { label: 'Display', value: '6.5-inch AMOLED' },
    { label: 'Battery', value: '5000 mAh', icon: 'battery' },
  ],
  description: {
    overview: 'A bright display and room for your everyday essentials.',
    inTheBox: ['Phone', 'USB-C cable', 'SIM tool'],
  },
  specs: [
    { group: 'Display', items: [{ label: 'Refresh rate', value: '120 Hz' }] },
    { group: 'Camera', items: [{ label: 'Main camera', value: '50 MP' }] },
  ],
  offers: [
    {
      type: 'emi',
      title: 'Monthly instalments',
      description: 'Explore 12-month instalments with eligible providers.',
      terms: 'Illustrative estimate only; interest and fees vary.',
    },
  ],
  policies: { warranty: '1-year manufacturer warranty', freeDelivery: true, authenticity: true },
  widgets: { warranty: { text: '1 year for manufacturing defects' } },
};
const rice: Product = {
  ...base('rice', 'Aged basmati rice', 'grocery', 649, images.rice),
  variants: [
    {
      type: 'weight',
      label: 'Weight',
      options: [
        { value: '5 kg', available: true },
        { value: '10 kg', available: true, priceDelta: 600 },
      ],
    },
    { type: 'pack-size', label: 'Pack size', options: [{ value: '1 bag', available: true }] },
  ],
  highlights: [
    { label: 'Grain', value: 'Extra long' },
    { label: 'Aged', value: '12 months' },
  ],
  description: {
    overview: 'Aromatic long-grain rice for everyday meals and special occasions.',
    inTheBox: ['100% basmati rice'],
  },
  specs: [
    {
      group: 'Food information',
      items: [
        { label: 'Origin', value: 'India' },
        { label: 'Storage', value: 'Cool, dry place' },
      ],
    },
  ],
  policies: { freeDelivery: true, cod: true },
  widgets: {
    diet: { text: '🟩 Vegetarian' },
    expiry: { text: 'Best before 24 months from packing. See pack for batch date.' },
    fssai: { text: 'Demo pack — verify the licence printed on the delivered label.' },
    nutrition: {
      columns: ['Per 100 g (uncooked)', 'Amount'],
      table: [
        ['Energy', '350 kcal'],
        ['Carbohydrate', '78 g'],
        ['Protein', '7 g'],
      ],
    },
  },
};
const sofa: Product = {
  ...base('sofa', 'Linen three-seater sofa', 'home', 34999, images.sofa),
  stock: { status: 'out', quantity: 0 },
  variants: [
    { type: 'material', label: 'Material', options: options(['Linen', 'Velvet']) },
    {
      type: 'dimension',
      label: 'Dimension',
      options: [{ value: '210 × 90 × 85 cm', available: true }],
    },
  ],
  highlights: [
    { label: 'Seating', value: '3 people' },
    { label: 'Frame', value: 'Solid wood' },
  ],
  description: {
    overview: 'A generous, welcoming seat with clean lines and a solid wood frame.',
    blocks: [
      {
        title: 'Make room for everyday living',
        text: 'Deep seats and supportive cushions bring comfort to shared moments.',
        image: images.sofa,
      },
    ],
  },
  specs: [
    {
      group: 'Dimensions',
      items: [
        { label: 'Width', value: '210 cm' },
        { label: 'Depth', value: '90 cm' },
      ],
    },
  ],
  widgets: {
    care: { text: 'Vacuum regularly. Spot-clean with a damp cloth.' },
    warranty: { text: '3-year frame warranty' },
  },
  policies: { warranty: '3-year frame warranty', freeDelivery: true },
  rating: undefined,
  reviews: [],
  qna: [],
};
export const mockProducts: Product[] = [headphones, shirt, phone, rice, sofa];
for (const p of mockProducts) {
  // Actual feature scores are supplied by data; config only orders their labels.
  const labels: Record<string, string[]> = {
    headphones: ['Sound', 'Battery', 'Comfort'],
    fashion: ['Fit', 'Comfort', 'Quality'],
    mobile: ['Performance', 'Camera', 'Battery'],
    grocery: ['Freshness', 'Taste', 'Packaging'],
  };
  if (p.rating)
    p.rating.featureRatings = (labels[p.category.id] ?? []).map((label, i) => ({
      label,
      value: [4.5, 4.2, 4.4][i],
    }));
}
export function getMockProduct(id: string) {
  return mockProducts.find((p) => p.id === id || p.slug === id);
}
