-- CreateEnum
CREATE TYPE "AffiliateEarningStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BusinessVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'UNDER_MODERATION', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewMediaKind" AS ENUM ('PHOTO', 'VIDEO');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('ORDER', 'DELIVERY', 'RETURN_REFUND', 'PAYMENT', 'PRODUCT', 'ACCOUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'AWAITING_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketAuthor" AS ENUM ('CUSTOMER', 'AGENT', 'SYSTEM');

-- AlterTable
ALTER TABLE "wallet_entries" ADD COLUMN     "coins_expire_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "affiliate_links" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_earnings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "link_id" UUID,
    "order_number" VARCHAR(20) NOT NULL,
    "product_name" VARCHAR(200) NOT NULL,
    "sale_amount_paise" INTEGER NOT NULL,
    "commission_paise" INTEGER NOT NULL,
    "status" "AffiliateEarningStatus" NOT NULL DEFAULT 'PENDING',
    "confirm_after" TIMESTAMP(3) NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_profiles" (
    "user_id" UUID NOT NULL,
    "business_name" VARCHAR(150) NOT NULL,
    "gstin" CHAR(15) NOT NULL,
    "pan" CHAR(10) NOT NULL,
    "billing_line1" VARCHAR(120) NOT NULL,
    "billing_line2" VARCHAR(120),
    "billing_city" VARCHAR(80) NOT NULL,
    "billing_state" VARCHAR(60) NOT NULL,
    "billing_pincode" CHAR(6) NOT NULL,
    "status" "BusinessVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" VARCHAR(300),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'UNDER_MODERATION',
    "moderation_flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rejection_reason" VARCHAR(300),
    "counted_rating" INTEGER,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_media" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "review_id" UUID,
    "kind" "ReviewMediaKind" NOT NULL,
    "storage_key" VARCHAR(200) NOT NULL,
    "content_type" VARCHAR(40) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "ticket_number" VARCHAR(20) NOT NULL,
    "user_id" UUID NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "subject" VARCHAR(120) NOT NULL,
    "order_id" UUID,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_type" "TicketAuthor" NOT NULL,
    "author_name" VARCHAR(80) NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_attachments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "ticket_id" UUID,
    "message_id" UUID,
    "file_name" VARCHAR(120) NOT NULL,
    "storage_key" VARCHAR(200) NOT NULL,
    "content_type" VARCHAR(40) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_links_code_key" ON "affiliate_links"("code");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_links_user_id_product_id_key" ON "affiliate_links"("user_id", "product_id");

-- CreateIndex
CREATE INDEX "affiliate_earnings_user_id_created_at_idx" ON "affiliate_earnings"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "affiliate_earnings_status_confirm_after_idx" ON "affiliate_earnings"("status", "confirm_after");

-- CreateIndex
CREATE UNIQUE INDEX "business_profiles_gstin_key" ON "business_profiles"("gstin");

-- CreateIndex
CREATE INDEX "business_profiles_status_submitted_at_idx" ON "business_profiles"("status", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_order_item_id_key" ON "reviews"("order_item_id");

-- CreateIndex
CREATE INDEX "reviews_product_id_status_published_at_idx" ON "reviews"("product_id", "status", "published_at");

-- CreateIndex
CREATE INDEX "reviews_user_id_created_at_idx" ON "reviews"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "review_media_storage_key_key" ON "review_media"("storage_key");

-- CreateIndex
CREATE INDEX "review_media_user_id_created_at_idx" ON "review_media"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "review_media_review_id_idx" ON "review_media"("review_id");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_number_key" ON "support_tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "support_tickets_user_id_last_message_at_idx" ON "support_tickets"("user_id", "last_message_at");

-- CreateIndex
CREATE INDEX "support_tickets_status_last_message_at_idx" ON "support_tickets"("status", "last_message_at");

-- CreateIndex
CREATE INDEX "ticket_messages_ticket_id_created_at_idx" ON "ticket_messages"("ticket_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_attachments_storage_key_key" ON "ticket_attachments"("storage_key");

-- CreateIndex
CREATE INDEX "ticket_attachments_user_id_created_at_idx" ON "ticket_attachments"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ticket_attachments_message_id_idx" ON "ticket_attachments"("message_id");

-- CreateIndex
CREATE INDEX "wallet_entries_user_id_coins_expire_at_idx" ON "wallet_entries"("user_id", "coins_expire_at");

-- AddForeignKey
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_earnings" ADD CONSTRAINT "affiliate_earnings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_earnings" ADD CONSTRAINT "affiliate_earnings_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "affiliate_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_media" ADD CONSTRAINT "review_media_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ticket_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
