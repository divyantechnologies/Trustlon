-- CreateEnum
CREATE TYPE "AddressLabel" AS ENUM ('HOME', 'WORK', 'OTHER');

-- CreateEnum
CREATE TYPE "PriceAlertStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PICKED_UP', 'RECEIVED', 'REFUNDED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('DAMAGED', 'DEFECTIVE', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'SIZE_OR_FIT', 'MISSING_PARTS', 'NO_LONGER_NEEDED', 'OTHER');

-- CreateEnum
CREATE TYPE "ReturnRefundMethod" AS ENUM ('ORIGINAL_PAYMENT', 'WALLET');

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "label" "AddressLabel" NOT NULL DEFAULT 'HOME',
    "label_name" VARCHAR(30),
    "full_name" VARCHAR(100) NOT NULL,
    "mobile" VARCHAR(16) NOT NULL,
    "line1" VARCHAR(120) NOT NULL,
    "line2" VARCHAR(120),
    "landmark" VARCHAR(80),
    "city" VARCHAR(80) NOT NULL,
    "state" VARCHAR(60) NOT NULL,
    "pincode" CHAR(6) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_alerts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "target_price_paise" INTEGER NOT NULL,
    "price_at_creation_paise" INTEGER NOT NULL,
    "status" "PriceAlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_requests" (
    "id" UUID NOT NULL,
    "return_number" VARCHAR(24) NOT NULL,
    "user_id" UUID NOT NULL,
    "sub_order_id" UUID NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" "ReturnReason" NOT NULL,
    "comments" VARCHAR(500),
    "pickup_address" JSONB NOT NULL,
    "refund_method" "ReturnRefundMethod" NOT NULL,
    "refund_amount_paise" INTEGER NOT NULL,
    "refund_reference" VARCHAR(80),
    "rejection_reason" VARCHAR(300),
    "pickup_scheduled_for" TIMESTAMP(3),
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "picked_up_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_items" (
    "id" UUID NOT NULL,
    "return_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_paise" INTEGER NOT NULL,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_photos" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "return_id" UUID,
    "storage_key" VARCHAR(200) NOT NULL,
    "content_type" VARCHAR(40) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_events" (
    "id" UUID NOT NULL,
    "return_id" UUID NOT NULL,
    "status" "ReturnStatus" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "note" VARCHAR(300),
    "occurred_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "addresses_user_id_is_default_idx" ON "addresses"("user_id", "is_default");

-- CreateIndex
CREATE INDEX "price_alerts_product_id_status_idx" ON "price_alerts"("product_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "price_alerts_user_id_product_id_key" ON "price_alerts"("user_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_requests_return_number_key" ON "return_requests"("return_number");

-- CreateIndex
CREATE INDEX "return_requests_user_id_requested_at_idx" ON "return_requests"("user_id", "requested_at");

-- CreateIndex
CREATE INDEX "return_requests_sub_order_id_idx" ON "return_requests"("sub_order_id");

-- CreateIndex
CREATE INDEX "return_requests_status_idx" ON "return_requests"("status");

-- CreateIndex
CREATE INDEX "return_items_order_item_id_idx" ON "return_items"("order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_items_return_id_order_item_id_key" ON "return_items"("return_id", "order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_photos_storage_key_key" ON "return_photos"("storage_key");

-- CreateIndex
CREATE INDEX "return_photos_user_id_created_at_idx" ON "return_photos"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "return_photos_return_id_idx" ON "return_photos"("return_id");

-- CreateIndex
CREATE INDEX "return_events_return_id_occurred_at_idx" ON "return_events"("return_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_sub_order_id_fkey" FOREIGN KEY ("sub_order_id") REFERENCES "sub_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_photos" ADD CONSTRAINT "return_photos_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_events" ADD CONSTRAINT "return_events_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
