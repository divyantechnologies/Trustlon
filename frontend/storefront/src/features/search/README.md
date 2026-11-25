# Search results

`/search?q=wireless+headphones` uses the existing storefront shell, design system,
`ProductCard`, and the category page's `CategoryFilters`. The latter is the existing
filter sidebar implementation (there is no component named `FilterSidebar`). Its
optional category/availability props leave the category page's fields unchanged.
Legacy `/browse/search` links redirect here with their query parameters preserved.

## Behavior

- The shared header `SearchBar` provides 250ms debounced, abortable suggestions for
  products, categories, brands and stores. Arrow keys/Enter select suggestions;
  Escape dismisses them. Six deduplicated recent searches are stored locally and
  can be cleared. Storage failures do not prevent search.
- Query, category, vendor, price bounds, availability, sort, page, and correction
  preference live in the URL. Intentional changes push history; malformed URL
  normalization and out-of-range page clamping replace it. Pages contain 24 items.
- Prices use the existing integer-paise API and pre-offer filter/sort semantics.
  The desktop sidebar applies after 400ms; mobile uses the existing modal drawer
  with explicit Apply. Clear all retains the query and sort.
- Requests abort on navigation and stale results are hidden. Loading, retry,
  empty-query, no-results, corrected-query and original-spelling states are handled.
- Empty results reuse actual category and popular-product data from HomeProvider.
  No fabricated products, brands, counts, or fallback catalog are used.
- Brand matching and suggestions use the existing Product.brand field. There is
  no separate brand API or brand filter in the existing filter contract.

## Backend

Existing `GET /api/v1/search`, `/products` and `/search/suggest` are extended.
Product responses retain pagination and add optional
`search: { originalQuery, query, corrected }`. Suggestions add `brands` and an
optional `correctedQuery`. `autocorrect=false` requests the original spelling.
Category/store APIs and product presenters remain in use.

Search reads current product names, descriptions, brands, category/parent names
and seller names, rather than relying on manually populated `search_text`.
PostgreSQL's built-in `to_tsvector`, `plainto_tsquery`, `setweight` and `ts_rank`
provide full-text matching and weighted relevance. Case-insensitive literal
substring matching also permits partial autocomplete and non-English words.
All terms must match; user input is parameterized. Sorting uses a stable ID tie
breaker, and PostgreSQL filters/counts/pages results before product hydration.

Spelling correction runs only when the original search has no catalog matches,
never just because filters exclude them. It uses a 60-second cached vocabulary
from live catalog fields and edit distance with adjacent transpositions (one edit
for 3–6 characters; two for longer words). A corrected combination must itself
match products before being offered. Short/unrelated words stay unchanged.
This is a conservative catalog-based spelling helper, not a general spellchecker.

No database model, migration, extension, dependency or infrastructure changes.
Vectors are computed at query time. Large-catalog performance has not been load
tested; profile it before adding a persisted search document/index. Function
reference: https://www.postgresql.org/docs/18/functions-textsearch.html

## Validation

From the repository root:

```sh
npm run typecheck -w frontend/storefront
npm run typecheck -w backend/api
npm run test:category -w frontend/storefront
npm run test:search -w frontend/storefront
npm run test -w backend/api -- --runInBand
npm run build -w frontend/storefront
npm run build -w backend/api
```

Search tests cover URL/price/sort contracts, original spelling serialization,
history normalization, corrupt local storage, Unicode tokenization, correction
distance, SQL parameterization and filter/correction orchestration.

Read-only live checks against the existing seeded catalog verified name,
description, category/parent, brand, case-insensitive and stemmed matching;
`wirless headphnoes` correction and original spelling; every sort; page counts
and distinct pages; price/category/vendor/availability filters; suggestions;
empty input/results; and the unchanged category listing API through the Next proxy.

Headless Chrome checks verified desktop correction/original-query navigation,
brand autocomplete and keyboard selection, the 390px mobile filter drawer and
Apply action, URL back/forward and refresh restoration, 768px tablet layout,
and navigation to the existing electronics category listing. Desktop (1440px),
tablet and the mobile drawer had no horizontal overflow. Desktop and mobile
screenshots were inspected against the existing design system. No reference
screenshot was present in the request, so pixel matching to it was not possible.

The existing backend unit suite has two unrelated failures in identifier.spec.ts:
`5876543210` returns `+915876543210` instead of null and `+447911123456` resolves
to GG instead of GB. Search tests pass. Do not run the existing database e2e suite
against development data: its setup truncates tables. It was not run here.
