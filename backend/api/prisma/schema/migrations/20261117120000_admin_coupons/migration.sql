-- Admin › Marketing › Coupons (spec 5.7) and the cart share one coupons table.
-- Existing coupons keep working: they become PERCENT coupons for everyone.

CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FLAT', 'FREE_DELIVERY');
CREATE TYPE "CouponAudience" AS ENUM ('ALL', 'NEW_USERS', 'PRIME_MEMBERS');

-- FLAT coupons store paise and FREE_DELIVERY stores 0, so the old 1–10000 check no longer fits.
ALTER TABLE "coupons" DROP CONSTRAINT IF EXISTS "coupons_discount_bps_check";
ALTER TABLE "coupons" DROP CONSTRAINT "coupons_pkey";

ALTER TABLE "coupons"
  ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN "description" VARCHAR(200) NOT NULL DEFAULT '',
  ADD COLUMN "type" "CouponType" NOT NULL DEFAULT 'PERCENT',
  ADD COLUMN "audience" "CouponAudience" NOT NULL DEFAULT 'ALL',
  ADD COLUMN "category_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "usage_limit" INTEGER,
  ADD COLUMN "per_user_limit" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "used_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "discount_bps" SET DEFAULT 0;

ALTER TABLE "coupons" ADD CONSTRAINT "coupons_pkey" PRIMARY KEY ("id");
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_discount_bps_check" CHECK ("discount_bps" >= 0);
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");
CREATE INDEX "coupons_active_starts_at_ends_at_idx" ON "coupons"("active", "starts_at", "ends_at");
