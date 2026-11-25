# Universal product detail page

The existing `/p/[productSlug]` route uses one template for every category. Prices in the universal model are **rupees**, while the existing catalog/cart API uses **paise**. `adaptProduct(unknown)` validates both shapes with Zod and isolates malformed optional sections. UI components never read the raw API response.

```text
src/app/p/[productSlug]/
  page.tsx                 Server fetch, metadata and escaped Product JSON-LD
  loading.tsx              Route skeleton
src/features/product/
  types.ts                 Product, Review, QnA, Purchase, ProductActions + runtime schemas
  categoryConfig.ts        Category aliases, selector order, icons, widgets, section order
  adapter.ts               API normalization and existing catalog bridge
  helpers.ts               INR formatting, variant/SKU resolution, 90-day history, schema
  data.ts / server.ts       Payload parsing and request-deduplicated server fetch
  ProductDetailsPage.tsx   Existing storefront/API integration
  ProductView.tsx          Provider-independent, props-driven template
  mock/products.ts         Headphones, t-shirt, smartphone, rice, sofa
  components/
    ProductGallery.tsx     Images, video, zoom dialog
    BuyBox.tsx             Shared purchase state, delivery, wishlist, mobile bar
    VariantSelector.tsx    Generic dynamic selectors
    HighlightsGrid.tsx
    OffersTabs.tsx
    DescriptionBlocks.tsx
    SpecsAccordion.tsx    Semantic grouped tables, stable data-spec-key for comparisons
    CategoryWidgets.tsx   Data-driven tables, text, rows and external experiences
    ReviewSummary.tsx
    ReviewList.tsx         Filters, sort, pagination, photos, votes via callback
    QnA.tsx
    PolicyCards.tsx
    PriceHistoryChart.tsx  SVG chart with accessible data table
    ProductCarousel.tsx   Related rails and selected bundle totals
    SectionRenderer.tsx   Conditional sections and matching navigation
    ProductSkeleton.tsx
    primitives.tsx        Dialog, icons, styles, images
tests/product.test.cjs     Real React server render and model/adapter tests
```

## Preview and checks

From the monorepo root:

```sh
npm run dev:storefront
npm run test:product -w storefront
npm run typecheck -w storefront
npm run build -w storefront
```

Development routes: `/p/demo-headphones`, `/p/demo-t-shirt`, `/p/demo-smartphone`, `/p/demo-rice`, `/p/demo-sofa`. Samples are explicitly marked and never used as a production API fallback. They cannot write demo purchases or alerts to real accounts. Images and example nutritional/product facts are illustrative, not catalog claims.

## Add a category

Add an entry to `categoryConfig` with optional aliases. Lookup checks category ID, name, then ancestors. Unknown categories use defaults, and unknown variant types still render. `variantOrder`, `specGroups`, `featureLabels` only order existing product data; they never create factual claims or scores. Widget keys must also exist under `product.widgets`. Generic table/text/URL presentation supports size charts, nutrition, ingredients, care, energy rating, diet/expiry/FSSAI and warranty. Virtual try-on renders only with a supplied product experience URL.

Additional backwards-compatible fields: `purchaseLimit` (cart cap, distinct from inventory), per-option `stock`, `skus` for exact combination inventory/pricing, `widgets`, policy `escrow`/`securePayments`, seller `slug`. For exact combinations, pass each SKU's selections, price and stock; missing combinations cannot be bought. MRP is the base MRP unless the upstream product supplies another value. Price-history charts describe the base product, not a selected variant. EMI is an explicitly indicative 12-month calculation and appears only when an EMI offer exists.

## Backend integration status

Connected: existing cart, wishlist, pincode serviceability, authenticated price alerts, recently viewed, review-writing account flow. A bounded `GET /products/by-ids?ids=...` endpoint uses the existing live-product lookup for related IDs. Unavailable/deleted related products are omitted.

The repository has no checkout endpoint or variant-aware cart contract. `Buy now` explains checkout availability and links to the cart; it does not create an order. Products with variants must connect a SKU-aware `ProductActions.addToCart` implementation before live purchasing; sending only the parent product ID would silently lose the chosen options. Both mobile and desktop purchases use the same quantity/selection state.

Public Q&A submission, helpful votes, and back-in-stock subscription endpoints are also absent. Optional `askQuestion`, `vote`, and `notify` callbacks are ready for those services; absent capabilities use support/wishlist fallbacks and read-only vote counts. Review submission links to the existing verified-purchase account flow. These controls do not fabricate successful writes. External virtual try-on must be supplied as a product URL; no camera processing is implemented here.

The current basic API does not yet provide the richer catalog sections. Until it does, sections are hidden or use review/question invitation states. The adapter is the only place to map a changed product response. Authentication, moderation and deduplication for future mutations belong in the backend callbacks; the display model is never an authority for checkout pricing.

Malformed variant, SKU or purchase-limit data disables purchasing while leaving the product readable. Zero option inventory cannot be overridden by a stocked SKU. Option-level low-stock status is preserved, and the legacy catalog bridge treats zero inventory as unavailable. Render/model coverage includes all five sample categories and these purchase-constraint regressions.
