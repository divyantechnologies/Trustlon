import { z } from 'zod';

const text = z.string().trim().min(1);
const amount = z.number().finite().nonnegative();
const safeUrl = z
  .string()
  .refine((v) => /^(https?:\/\/|\/(?!\/))/.test(v), 'Expected an HTTP or local URL');
const image = z.object({ url: safeUrl, alt: z.string() });
const stock = z.object({
  status: z.enum(['in_stock', 'low', 'out']),
  quantity: amount.int().optional(),
});
const rows = z.array(z.object({ label: text, value: text }));
export const reviewSchema = z.object({
  id: text,
  author: text,
  title: text,
  text: text,
  rating: z.number().min(1).max(5),
  date: z.string().datetime({ offset: true }),
  verified: z.boolean().default(false),
  photos: z.array(image).default([]),
  helpful: amount.int().default(0),
  sellerReply: text.optional(),
});
export const questionSchema = z.object({
  id: text,
  question: text,
  answer: text.optional(),
  answeredBy: text.optional(),
  upvotes: amount.int().default(0),
});
export const productSchema = z.object({
  id: text,
  slug: text,
  title: text,
  brand: z.string(),
  category: z.object({ id: text, name: text, path: z.array(text) }),
  images: z.array(image),
  video: safeUrl.optional(),
  price: z.object({
    current: amount,
    mrp: amount.optional(),
    currency: z.literal('INR'),
    taxInclusive: z.boolean(),
  }),
  stock,
  // Purchase limits are distinct from actual inventory; never use a cart cap as scarcity copy.
  purchaseLimit: amount.int().optional(),
  rating: z
    .object({
      average: z.number().min(0).max(5),
      count: amount.int(),
      distribution: z.record(z.enum(['1', '2', '3', '4', '5']), amount.int()).optional(),
      featureRatings: z
        .array(z.object({ label: text, value: z.number().min(0).max(5) }))
        .optional(),
    })
    .optional(),
  variants: z
    .array(
      z.object({
        type: text,
        label: text,
        options: z.array(
          z.object({
            value: text,
            available: z.boolean(),
            image: safeUrl.optional(),
            priceDelta: z.number().finite().optional(),
            stock: stock.optional(),
          }),
        ),
      }),
    )
    .optional(),
  // Combination-level records prevent adding an ambiguous option combination to the cart.
  skus: z
    .array(
      z.object({
        id: text,
        selections: z.record(text),
        price: amount,
        stock,
        image: safeUrl.optional(),
      }),
    )
    .optional(),
  highlights: z
    .array(z.object({ icon: text.optional(), label: text, value: text.optional() }))
    .optional(),
  keyFeatures: z.array(text).optional(),
  description: z
    .object({
      overview: text.optional(),
      blocks: z.array(z.object({ title: text, text, image: safeUrl.optional() })).optional(),
      inTheBox: z.array(text).optional(),
    })
    .optional(),
  specs: z.array(z.object({ group: text, items: rows })).optional(),
  offers: z
    .array(
      z.object({
        type: z.enum(['bank', 'coupon', 'cashback', 'emi', 'coins', 'other']),
        title: text,
        description: text,
        code: text.optional(),
        terms: text.optional(),
      }),
    )
    .optional(),
  seller: z.object({
    name: text,
    verified: z.boolean(),
    rating: z.number().min(0).max(5).optional(),
    slug: text.optional(),
  }),
  policies: z
    .object({
      returns: text.optional(),
      warranty: text.optional(),
      cod: z.boolean().optional(),
      freeDelivery: z.boolean().optional(),
      authenticity: z.boolean().optional(),
      escrow: z.boolean().optional(),
      securePayments: z.boolean().optional(),
    })
    .optional(),
  reviews: z.array(reviewSchema).optional(),
  qna: z.array(questionSchema).optional(),
  priceHistory: z
    .array(
      z.object({ date: z.string().refine((v) => Number.isFinite(Date.parse(v))), price: amount }),
    )
    .optional(),
  related: z
    .object({ similar: z.array(text).optional(), boughtTogether: z.array(text).optional() })
    .optional(),
  // Config selects presentation; facts always come from the product.
  widgets: z
    .record(
      z.object({
        text: text.optional(),
        rows: rows.optional(),
        columns: z.array(text).optional(),
        table: z.array(z.array(text)).optional(),
        url: safeUrl.optional(),
      }),
    )
    .optional(),
});
export type Product = z.infer<typeof productSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type QnA = z.infer<typeof questionSchema>;
export type Selection = Record<string, string>;
export type Purchase = {
  product: Product;
  skuId?: string;
  selections: Selection;
  quantity: number;
};
export type ProductActions = {
  addToCart: (purchase: Purchase) => Promise<void>;
  buyNow: (purchase: Purchase) => Promise<void>;
  wishlist: (product: Product) => Promise<void>;
  checkDelivery: (pin: string) => Promise<string>;
  setAlert: (product: Product, price: number) => Promise<void>;
  notify?: (product: Product) => Promise<void>;
  askQuestion?: (product: Product, question: string) => Promise<void>;
  vote?: (kind: 'review' | 'question', id: string) => Promise<void>;
};
