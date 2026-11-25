# Local Sellers (2.6)

Routes: `/local?pincode=244001&radius=10` and `/account/seller`.

## Existing architecture and decisions

- Next.js App Router, React context/hooks, `apiFetch`, NestJS, class-validator, Prisma and PostgreSQL.
- Existing design-system controls, tokens, account panels/empty states, storefront header/footer,
  product cards, image fallbacks and section skeletons are reused. No dependencies were added.
- The repository has seller onboarding, but no vendor dashboard source. Delivery settings live in
  the authenticated account layout and are visible only to `VENDOR_OWNER` users. The API additionally
  checks the store's `ownerId`; customer/staff tokens cannot edit stores.
- `Vendor.pickupPincode`, `sameDayDelivery`, `Pincode.latitude/longitude` and its primary/coordinate
  indexes already existed. The migration adds pickup street address, coordinate snapshots, optional
  cutoff and next-day support. Existing coordinates are backfilled. PostgreSQL uses a B-tree bounding
  box index; this implementation does not introduce a PostGIS extension or another geocoding service.
- `PincodeService.find` is the existing offline lookup boundary. A future provider can supply
  coordinates there without changing either local endpoint. Sellers without coordinates are excluded;
  settings reject unsupported pickup pincodes rather than invent coordinates.
- `ACTIVE` plus a non-null `kycApprovedAt` means approved. Deleted, suspended, unapproved or
  same-day-disabled vendors are excluded. Exact Haversine distance is checked before rounding.
- Cutoffs use Asia/Kolkata (UTC+05:30). At the cutoff minute, same-day ends. A null cutoff means
  availability throughout the day. Next-day support defaults to false and must be enabled explicitly.
  After cutoff, next-day sellers remain in the seller list, but never in the same-day product grid.
- Products must be `LIVE`, not deleted, and have stock greater than zero. Existing pricing presenters
  apply active deal prices. Vendor ratings do not exist in the schema, so `rating` is null.
- URL pincode takes precedence over `tl_pincode` localStorage, then the signed-in customer's default
  Indian address, then the existing storefront fallback. Opening a shared URL does not edit an address.
  Explicit location changes update the existing default Indian address's pincode/city/state when the
  new pincode is serviceable, preserving its other fields. No address is created if none exists.
- Radius defaults to 10 km. Both lists remount for each location/radius and abort old requests;
  aborted responses are ignored even if a transport resolves late. Pagination follows “Show more”.

## Run locally

Run from the repository root (`Trustlon`, containing the workspace `package.json`). Use the existing
`backend/api/.env` and `frontend/storefront/.env.example` configuration. Keep `DATABASE_URL` pointed at
your development database. With PostgreSQL running:

```sh
npm run prisma:generate -w backend/api
npm run prisma:deploy -w backend/api
npm run prisma:seed:local -w backend/api
```

`prisma:deploy` applies all pending migrations, including `20261117090000_local_sellers`.
The local seed is independent of the full home/account seed, repeatable, and adds 10 demo vendors
with 6 products each (4 live/in-stock, 1 draft, 1 sold out). It does not delete existing data or replace
existing pincode master entries. It refuses `NODE_ENV=production`. If a running Windows API locks
Prisma's engine DLL, stop that API before running the ordinary generate command, then restart it.

Start these in separate terminals:

```sh
npm run dev:api
npm run dev:storefront
```

The default URLs are `http://localhost:4000/api/v1` and `http://localhost:3000`. The existing Next.js
proxy uses server-side `API_URL`; the frontend has no new hardcoded service URL.

## Browser checks

1. Open `http://localhost:3000/local?pincode=244001&radius=5` or choose **Local** in navigation.
2. With the demo fixture unchanged, verify these totals (load more to see all products):

   | Radius | Sellers | Same-day products | Sellers included                                         |
   | ------ | ------: | ----------------: | -------------------------------------------------------- |
   | 5 km   |       3 |                 8 | Moradabad Central, Neighbourhood Crafts, Tomorrow Market |
   | 10 km  |       4 |                12 | Above, plus Nearby Pantry                                |
   | 25 km  |       6 |                20 | Above, plus Local Home and Farm Favourites               |

   Tomorrow Market has a midnight cutoff and explicit next-day support. Its badge is always
   **Next-day delivery**, and its products never appear in the same-day grid. Standard Delivery Only,
   Awaiting Approval, Closed for Today and Distant Market must not appear for these radii.
   Draft and sold-out products must never appear, including in seller previews.

3. Select another radius. Confirm the URL changes, both lists refresh, and refresh/back/forward retain
   the selected location and radius. Rapid changes must not show an older response's cards.
4. Choose **Change**. `024001`, `12345` and `24400a` show inline errors. `999999` shows unavailable
   delivery. `400001` is a serviceable empty demo location (unless your existing data adds local sellers).
   At 5 or 10 km, the empty state offers a larger-radius button; at 25 km choose another pincode.
5. Change to `244001`, reload `/local` without parameters, and verify the saved pincode is restored.
   With a signed-in account/default Indian address, explicitly change to another supported pincode
   such as `244102`; verify the default address's pincode/city/state update. Shared URL visits do not
   change that address. Existing address validation errors are shown rather than silently ignored.
6. Click **View store** and product thumbnails/cards. They open the existing `/browse/<slug>` and
   `/p/<slug>` pages. Cart/wishlist/quick-view actions keep their existing behavior.
7. Test narrow/mobile widths, Tab navigation, Space/arrow-key radius selection, modal Escape/focus,
   loading states, and Retry with an API request blocked in browser developer tools.

The seed's Moradabad/nearby coordinates and pickup offsets are illustrative fixtures, not verified
street geocodes. Other sample lookup pincodes include `244102`, `244104`, `244901`, `110001`, `400001`
and `560001`. Existing pincode data is preserved; counts above assume the supplied `244001` centroid
and unchanged demo settings. An existing operational dataset can add more matching sellers.

## Seller settings check

Use an existing `VENDOR_OWNER` account. For a development-only test account, register normally, then
use Prisma Studio (`npx prisma studio --schema backend/api/prisma/schema`) to assign its role to
`VENDOR_OWNER`. No hardcoded account or password is seeded. Link demo stores to that account by
setting `LOCAL_SELLER_OWNER_EMAIL` to its email when running the local seed. For example, PowerShell:

```powershell
$env:LOCAL_SELLER_OWNER_EMAIL = 'your-existing-owner-email'
npm run prisma:seed:local -w backend/api
Remove-Item Env:LOCAL_SELLER_OWNER_EMAIL
```

Sign out/in after a role change, open `/account/seller` and choose a store. Save a pickup street and
supported pincode; coordinates are resolved on the server. Disable same-day and verify the seller and
all its products disappear from `/local`. Enable it and set a cutoff before the current India time:
with next-day enabled the seller remains with a next-day badge; without next-day it disappears.
Saving a pickup pincode resolves its centroid, replacing the synthetic demo offset; rerun the seed
to restore the radius fixtures. Pending stores remain hidden even if their owner enables delivery.

## API contract

- `GET /api/v1/local/sellers?pincode=244001&radius=10&page=1&pageSize=6`
- `GET /api/v1/local/products?pincode=244001&radius=10&page=1&pageSize=8`
- `GET /api/v1/me/stores/delivery` (owner JWT)
- `PUT /api/v1/me/stores/<uuid>/delivery` (owner JWT)

Both local endpoints accept 5/10/25 km, default 10, and the existing `page`/`pageSize` rules (max 48).
The legacy `radiusKm` alias remains supported; conflicting aliases return 400. Responses contain
`items`, `total`, `page`, `pageSize`, `totalPages`, `pincode`, `radiusKm`, and `serviceable`. The sellers
response also retains `sellers` for the home strip. Existing store summary fields are preserved;
`id`, `storeName`, `pickupPincode`, `deliveryPromise`, `rating`, and up to four `topProducts` are added.
Top-product `price` and `pricePaise` are both integer paise. Product responses use the existing
ProductCard shape. Unknown/unserviceable/ungeocoded pincodes return empty arrays with
`serviceable: false`, not an HTTP error. Malformed input returns the existing Nest validation errors.

Local routes use the existing global rate limiter plus a 60 requests/minute endpoint limit. Cache
responses must revalidate (`max-age=0, must-revalidate`) so cutoff/stock/settings changes are not
served from a stale public cache. Private seller settings are not cached.

## Validation

```sh
npm run typecheck
npm run build
npm run test
npm run test:local -w frontend/storefront
```

Use a dedicated PostgreSQL database with a name ending in `_test` for the existing destructive E2E
fixtures. Set both `DATABASE_URL` and `DATABASE_URL_TEST` to that test database, migrate it, then run:

```sh
npm run prisma:deploy -w backend/api
node -r ./realpath-patch.cjs ./node_modules/jest/bin/jest.js --config ./backend/api/test/jest-e2e.json --runInBand
```

Append `--testPathPattern=local.e2e-spec` for the new database-backed local API tests only. Local rule
tests cover Haversine boundaries, approval, same-day exclusion, fallback coordinates and IST cutoff.
Frontend tests cover LocationBar validation/submission failures, radio behavior, URL parsing and
ignoring late aborted responses using the existing Node runner. No browser automation dependency
was added. No dedicated lint script/config exists; use the repository's Prettier checks and compiler.

Verification on this checkout:

- Workspace type-check and production builds pass (including `/local` and `/account/seller`).
- All 54 storefront tests pass; the 11 new database-backed HTTP tests pass.
- Backend unit run: 91 pass, 2 fail. Full HTTP run: 94 pass, 5 fail.
- The seven failures were reproduced with the unchanged `HEAD` source in an isolated baseline copy:
  phone normalization/region expectations (`identifier.spec.ts`); suggestion count and out-of-stock
  status expectations (`home.e2e-spec.ts`); saved-for-later behavior (`checkout.e2e-spec.ts`);
  address state correction (`customer.e2e-spec.ts`); seeded referral reward count (`settings.e2e-spec.ts`).
  Those unrelated files were not changed or tests weakened to make this feature appear green.
- Prettier and `git diff --check` pass. There is no configured lint task to run.
- API checks use a dedicated test database; development data is not truncated. No interactive browser
  automation was available, so the browser checklist above still needs a visual/manual pass.

## Changed-file inventory

All paths below are relative to the repository root.

```text
backend/api/package.json
backend/api/prisma/schema/vendors.prisma
backend/api/prisma/schema/migrations/20261117090000_local_sellers/migration.sql
backend/api/prisma/seed-local.ts
backend/api/src/modules/stores/dto.ts
backend/api/src/modules/stores/local-rules.ts
backend/api/src/modules/stores/local-rules.spec.ts
backend/api/src/modules/stores/seller-delivery.controller.ts
backend/api/src/modules/stores/seller-delivery.service.ts
backend/api/src/modules/stores/store.presenter.ts
backend/api/src/modules/stores/stores.controller.ts
backend/api/src/modules/stores/stores.module.ts
backend/api/src/modules/stores/stores.service.ts
backend/api/test/local.e2e-spec.ts
frontend/storefront/package.json
frontend/storefront/src/app/account/seller/page.tsx
frontend/storefront/src/app/local/page.tsx
frontend/storefront/src/features/account/components/AccountShell.tsx
frontend/storefront/src/features/home/components/CategoryNav.tsx
frontend/storefront/src/features/home/components/HomeHeader.tsx
frontend/storefront/src/features/home/components/LocalSellersStrip.tsx
frontend/storefront/src/features/home/types/index.ts
frontend/storefront/src/features/local/README.md
frontend/storefront/src/features/local/LocalPage.tsx
frontend/storefront/src/features/local/SellerDeliveryPage.tsx
frontend/storefront/src/features/local/api.ts
frontend/storefront/src/features/local/query.ts
frontend/storefront/src/features/local/seller-api.ts
frontend/storefront/src/features/local/use-local-page.ts
frontend/storefront/src/features/local/components/DeliveryBadge.tsx
frontend/storefront/src/features/local/components/DistanceFilter.tsx
frontend/storefront/src/features/local/components/LocalSellerList.tsx
frontend/storefront/src/features/local/components/LocationBar.tsx
frontend/storefront/src/features/local/components/ProductGrid.tsx
frontend/storefront/tests/local.test.cjs
```
