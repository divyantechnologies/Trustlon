# Category listing

`/c/[categorySlug]` uses the same App Router server-shell/Suspense/client-fetch
pattern as `/browse/[slug]`. Next.js is 15.5.29 in the installed workspace;
TypeScript is strict. No dependency or provider changes are required.

## Discovery and contract

- Design tokens: `../../design-system/tokens/*`, shared patterns in
  `../../design-system/styles/index.ts`, and `../../../tailwind.config.ts`.
  Use Inter/Noto typography, navy/teal/cream, Tailwind spacing and default
  breakpoints (sm 640, md 768, lg 1024, xl 1280). See the design-system README.
- Existing `Button`, `TextField`, `Checkbox`, `Alert`, `Dialog` fit. Dialog now
  has an optional drawer variant; its default modal behavior is unchanged.
  `SectionSkeleton` now accepts grid columns. `ProductCard` retains its existing
  image fallback, pricing, seller verification, wishlist and cart behavior;
  the optional `showUnrated` prop shows “No ratings yet” on this page.
- There is no shared Breadcrumb, Chip, Badge, Select, EmptyState or Pagination.
  `CategoryBreadcrumb` is feature-local API-driven navigation. Chips use Link
  and Button; sorting uses the native select/shared input pattern. The empty
  state is inline. `CategoryFilters` shares the actual fields across sidebar
  and drawer; these feature components do not introduce a new design system.
- `../home/api.ts` and `../home/types/index.ts` own the existing API services and
  response types. `../../lib/http.ts` owns credentials, token refresh and
  `ApiError`. Catalog requests are public; authenticated actions still use
  the existing home/auth implementation. No React Query or SWR is installed.
- Backend evidence (relative to repository root):
  `backend/api/src/modules/catalog/{categories.service.ts,products.service.ts,product.presenter.ts,dto/product-query.dto.ts}`,
  `backend/api/src/common/http/pagination.ts`, and
  `backend/api/src/modules/stores/{stores.controller.ts,stores.service.ts}`.

`GET /api/v1/categories/:slug` returns:
`{ slug, name, nameHi, image, parent, children, breadcrumb }`.
Parent is a category reference or null; children are category references
(`slug`, `name`, nullable `nameHi`); breadcrumbs contain `slug` and `name`.
Missing categories return 404. There is no description or attribute schema.

`GET /api/v1/products` accepts `q`, `category`, a single `store`, `originals`,
`bundle`, `deals`, `inStock`, `minPricePaise`, `maxPricePaise`, `sort`, `page`,
`pageSize`. Boolean true can be `true` or `1`. Prices are non-negative integer
paise. Page starts at 1; pageSize defaults to 24 and is limited to 48.
There is no multi-value filter encoding. Unknown API fields are rejected by
the global ValidationPipe (`backend/api/src/app.setup.ts`).

Response: `{ items: Product[], page, pageSize, total, totalPages }`.
`Product` matches `ProductSummary` in `product.presenter.ts`: identity, image,
category, seller, currency, pricePaise, mrpPaise, discountPercent, rating,
ratingCount, badge, inStock, codAvailable, and nullable deal. TotalPages is at
least 1, including an empty result. Category filtering includes its immediate
active children. All six displayed sort values are supported. Price filtering
and sorting use the base price, while presented prices can include active deals.

## Explicit backend gaps

- No category description: omit it instead of generating marketing copy.
- No brand facets/filter, rating threshold, percentage discount threshold,
  verified toggle, COD filter, or Size/Colour/Material schema/filter: hide them.
  `deals=true` is an active-deal flag, not a discount percentage substitute.
- Local endpoints exist, but do not offer compatible category filtering,
  pagination and sorting; do not mix their partial results into this listing.
- Vendor is single-select. `/stores` returns up to 100 verified active stores,
  not all vendors or category-specific facets. Label this limitation in the
  picker; shared `store` values outside that directory remain selectable and
  removable. Never invent multi-vendor support or filter loaded pages locally.
- No sponsored boolean/placement contract exists. A generic product `badge`
  string is not proof of paid placement. Do not fabricate labels or drop
  products to implement a sponsored cap. The supplied specification also ends
  mid-sentence at “Max 2 spon”; full placement rules remain outstanding.
- Empty filtered results cannot prove the unfiltered category is nonempty.
  Say “No products match these filters”; with no filters say “No products in
  this category yet”.

## URL and interaction behavior

Example:
`/c/clothing?sort=price_asc&minPricePaise=50000&maxPricePaise=200000&store=trustlon&page=2`

Supported UI keys are `sort`, `minPricePaise`, `maxPricePaise`, `store`, `page`.
Category comes from the path, pageSize is fixed at 24, and all omitted values
use defaults. Relevance/page 1 are omitted from canonical URLs. Unknown keys
are removed; invalid sorts/pages/prices/slugs are ignored. Repeated keys use
their first value. An inverted shared range retains its lower bound and drops
the upper bound. Interactive ranges show an error and are not applied.
Inputs display rupees with up to two decimal places, converted to integer paise.

URL state is authoritative. Desktop fields apply after 400ms; the drawer uses
an explicit Apply and discards edits on dismissal. Removing a chip, clearing
filters, or changing sort resets page to 1 and scrolls to the list. Sort is
retained by Clear all filters. Subcategory and category navigation use Link
(intentional push). Filters, sort, normalization, and scroll-driven pagination
use router.replace with scroll:false, avoiding a history entry for every
keystroke or page. No URL writes occur when a normalized user action changes
nothing. Back/forward restores the URL of existing history entries, not each
intermediate filter change that replace intentionally supersedes.

Page N means pages 1 through N are displayed. Deep links fetch page 1 to learn
the real total, then restore successive pages; out-of-range pages clamp to the
actual last page. Requests share promises and a five-minute bounded in-memory
cache. Navigation ignores stale completions; it does not cancel a promise
another mounted consumer may share. Failed requests are evicted for retry.
Already-loaded products remain visible after a later-page error. IDs are
deduplicated without reordering the API results. The sentinel advances only
when the current URL page has finished; an in-flight URL guard prevents double
advancement. A Load more button also supports keyboard access/no observer.

Scroll snapshots are bounded to 50 canonical URLs for same-tab navigation.
Back/forward restores snapshots after data is ready; a newly opened deep link
scrolls to its last loaded page. Refresh restores filters and pages from the
URL but does not promise the exact previous pixel offset.

## Verification

From the repository root:

```sh
npm run test:category -w frontend/storefront
npm run typecheck -w frontend/storefront
npm run build -w frontend/storefront
```

The dependency-free Node tests exercise URL canonicalization, all sorts,
invalid/overflow prices and pages, money conversion, cache deduplication,
expiry/eviction, page-specific retries and duplicate products. Test doubles
are confined to the test file; production always calls the existing API.

With the real API running, additionally check: category/parent/child navigation,
direct filtered page-2 links, rapid input changes, sort resets, mobile Apply
and Escape/cancel, wishlist/cart dialogs, missing categories, initial and
later-page network failures, end/empty states, back/forward scroll restoration,
and widths below/above the sidebar breakpoint. No sponsored or unsupported
filter behavior should appear.
