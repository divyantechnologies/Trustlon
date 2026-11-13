-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('UPI', 'CARD', 'NETBANKING', 'WALLET', 'COD');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SubOrderStatus" AS ENUM ('PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('NONE', 'PENDING', 'PROCESSED');

-- CreateEnum
CREATE TYPE "WalletEntryType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "WalletEntrySource" AS ENUM ('REFUND', 'CASHBACK', 'REFERRAL', 'ORDER_PAYMENT', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "gstin" VARCHAR(15);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_number" VARCHAR(20) NOT NULL,
    "user_id" UUID NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payment_reference" VARCHAR(80),
    "mrp_total_paise" INTEGER NOT NULL,
    "items_total_paise" INTEGER NOT NULL,
    "coupon_code" VARCHAR(40),
    "coupon_discount_paise" INTEGER NOT NULL DEFAULT 0,
    "delivery_paise" INTEGER NOT NULL DEFAULT 0,
    "tax_paise" INTEGER NOT NULL,
    "total_paise" INTEGER NOT NULL,
    "shipping_address" JSONB NOT NULL,
    "placed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_orders" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "sub_order_number" VARCHAR(24) NOT NULL,
    "status" "SubOrderStatus" NOT NULL DEFAULT 'PLACED',
    "items_total_paise" INTEGER NOT NULL,
    "coupon_discount_paise" INTEGER NOT NULL DEFAULT 0,
    "delivery_paise" INTEGER NOT NULL DEFAULT 0,
    "tax_paise" INTEGER NOT NULL,
    "total_paise" INTEGER NOT NULL,
    "courier_name" VARCHAR(60),
    "awb" VARCHAR(40),
    "expected_delivery_at" TIMESTAMP(3),
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "return_window_ends_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" VARCHAR(20),
    "cancel_reason" VARCHAR(300),
    "invoice_number" VARCHAR(30),
    "invoiced_at" TIMESTAMP(3),
    "refund_status" "RefundStatus" NOT NULL DEFAULT 'NONE',
    "refund_paise" INTEGER NOT NULL DEFAULT 0,
    "refund_reference" VARCHAR(80),
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sub_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "sub_order_id" UUID NOT NULL,
    "product_id" UUID,
    "product_slug" VARCHAR(160) NOT NULL,
    "product_name" VARCHAR(200) NOT NULL,
    "brand" VARCHAR(80),
    "image_url" TEXT NOT NULL,
    "hsn_code" VARCHAR(8),
    "gst_rate_bps" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_paise" INTEGER NOT NULL,
    "unit_mrp_paise" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_events" (
    "id" UUID NOT NULL,
    "sub_order_id" UUID NOT NULL,
    "status" "SubOrderStatus" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "location" VARCHAR(120),
    "occurred_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "user_id" UUID NOT NULL,
    "balance_paise" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "wallet_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "WalletEntryType" NOT NULL,
    "source" "WalletEntrySource" NOT NULL,
    "amount_paise" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "balance_after_paise" INTEGER NOT NULL,
    "description" VARCHAR(160) NOT NULL,
    "reference" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prime_memberships" (
    "user_id" UUID NOT NULL,
    "plan" VARCHAR(20) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prime_memberships_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_user_id_placed_at_idx" ON "orders"("user_id", "placed_at");

-- CreateIndex
CREATE UNIQUE INDEX "sub_orders_sub_order_number_key" ON "sub_orders"("sub_order_number");

-- CreateIndex
CREATE UNIQUE INDEX "sub_orders_awb_key" ON "sub_orders"("awb");

-- CreateIndex
CREATE UNIQUE INDEX "sub_orders_invoice_number_key" ON "sub_orders"("invoice_number");

-- CreateIndex
CREATE INDEX "sub_orders_order_id_idx" ON "sub_orders"("order_id");

-- CreateIndex
CREATE INDEX "sub_orders_vendor_id_status_idx" ON "sub_orders"("vendor_id", "status");

-- CreateIndex
CREATE INDEX "order_items_sub_order_id_idx" ON "order_items"("sub_order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE INDEX "shipment_events_sub_order_id_occurred_at_idx" ON "shipment_events"("sub_order_id", "occurred_at");

-- CreateIndex
CREATE INDEX "wallet_entries_user_id_created_at_idx" ON "wallet_entries"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_orders" ADD CONSTRAINT "sub_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_orders" ADD CONSTRAINT "sub_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_sub_order_id_fkey" FOREIGN KEY ("sub_order_id") REFERENCES "sub_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_sub_order_id_fkey" FOREIGN KEY ("sub_order_id") REFERENCES "sub_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "wallets"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prime_memberships" ADD CONSTRAINT "prime_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
