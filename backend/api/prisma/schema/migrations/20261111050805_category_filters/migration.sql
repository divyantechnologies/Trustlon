-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "description" VARCHAR(500);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "discount_percent" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "products_category_id_brand_idx" ON "products"("category_id", "brand");
