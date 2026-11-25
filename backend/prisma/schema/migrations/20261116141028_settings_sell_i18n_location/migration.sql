-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Language" ADD VALUE 'BN';
ALTER TYPE "Language" ADD VALUE 'MR';
ALTER TYPE "Language" ADD VALUE 'TA';
ALTER TYPE "Language" ADD VALUE 'TE';
ALTER TYPE "Language" ADD VALUE 'KN';
ALTER TYPE "Language" ADD VALUE 'ML';

-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "country" CHAR(2) NOT NULL DEFAULT 'IN',
ALTER COLUMN "pincode" SET DATA TYPE VARCHAR(12);

-- CreateTable
CREATE TABLE "cities" (
    "id" INTEGER NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "search_name" VARCHAR(120) NOT NULL,
    "region_code" VARCHAR(20),
    "population" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cities_country_code_search_name_idx" ON "cities"("country_code", "search_name");

-- CreateIndex
CREATE INDEX "pincodes_city_idx" ON "pincodes"("city");
