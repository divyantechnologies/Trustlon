-- CreateEnum
CREATE TYPE "ReportTarget" AS ENUM ('PRODUCT', 'REVIEW', 'VENDOR');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('COUNTERFEIT', 'PROHIBITED', 'MISLEADING', 'ABUSIVE', 'FAKE_REVIEW', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReporterKind" AS ENUM ('CUSTOMER', 'VENDOR', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuthenticityStatus" AS ENUM ('NOT_REQUIRED', 'FLAGGED', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'COLOR', 'SIZE', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "SubmissionKind" AS ENUM ('NEW', 'EDIT');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "SeoEntity" AS ENUM ('HOME', 'CATEGORY', 'PAGE');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NOT_STARTED', 'SUBMITTED', 'MORE_INFO_REQUIRED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CheckResult" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "VendorDocumentType" AS ENUM ('PAN_CARD', 'GST_CERTIFICATE', 'CANCELLED_CHEQUE', 'ADDRESS_PROOF', 'BRAND_AUTHORISATION', 'OTHER');

-- CreateEnum
CREATE TYPE "VendorNoteKind" AS ENUM ('NOTE', 'WARNING');

-- AlterEnum
ALTER TYPE "ProductStatus" ADD VALUE 'CHANGES_REQUESTED';

-- AlterTable
ALTER TABLE "carts" ALTER COLUMN "expires_at" SET DEFAULT (CURRENT_TIMESTAMP + interval '30 days');

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "cod_allowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "moderation_required" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "authenticity" "AuthenticityStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "authenticity_note" VARCHAR(300),
ADD COLUMN     "rejection_reason" VARCHAR(500),
ADD COLUMN     "submitted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "device_hash" VARCHAR(64),
ADD COLUMN     "ip" VARCHAR(45);

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "mfa_verified_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "blocked_reason" VARCHAR(300),
ADD COLUMN     "cod_disabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "commission_bps" INTEGER,
ADD COLUMN     "payout_hold_reason" VARCHAR(300),
ADD COLUMN     "payouts_on_hold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "plan" VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "suspended_at" TIMESTAMP(3),
ADD COLUMN     "suspension_reason" VARCHAR(500),
ADD COLUMN     "under_review" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_name" VARCHAR(100),
    "actor_role" "UserRole",
    "action" VARCHAR(60) NOT NULL,
    "entity" VARCHAR(40) NOT NULL,
    "entity_id" VARCHAR(120),
    "summary" VARCHAR(300),
    "reason" VARCHAR(500),
    "before" JSONB,
    "after" JSONB,
    "ip" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role" "UserRole" NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updated_by_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role")
);

-- CreateTable
CREATE TABLE "staff_mfa" (
    "user_id" UUID NOT NULL,
    "secret" VARCHAR(200) NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "last_used_step" INTEGER NOT NULL DEFAULT 0,
    "recovery_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_mfa_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "content_reports" (
    "id" UUID NOT NULL,
    "target_type" "ReportTarget" NOT NULL,
    "target_id" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" VARCHAR(1000),
    "reporter_id" UUID,
    "reporter_kind" "ReporterKind" NOT NULL DEFAULT 'CUSTOMER',
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "action" VARCHAR(40),
    "resolution_note" VARCHAR(500),
    "handled_by_id" UUID,
    "handled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_notes" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "author_id" UUID,
    "author_name" VARCHAR(100) NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attributes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "type" "AttributeType" NOT NULL DEFAULT 'TEXT',
    "unit" VARCHAR(16),
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_filterable" BOOLEAN NOT NULL DEFAULT false,
    "is_variant" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_attributes" (
    "category_id" UUID NOT NULL,
    "attribute_id" UUID NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "category_attributes_pkey" PRIMARY KEY ("category_id","attribute_id")
);

-- CreateTable
CREATE TABLE "hsn_rates" (
    "id" UUID NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "gst_rate_bps" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hsn_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_submissions" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "kind" "SubmissionKind" NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "changes" JSONB NOT NULL DEFAULT '[]',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "decided_by_id" UUID,
    "reason" VARCHAR(500),

    CONSTRAINT "product_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "key" VARCHAR(40) NOT NULL,
    "value" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "setting_versions" (
    "id" UUID NOT NULL,
    "group" VARCHAR(40) NOT NULL,
    "version" INTEGER NOT NULL,
    "value" JSONB NOT NULL,
    "changed_by_id" UUID,
    "changed_by_name" VARCHAR(100),
    "reason" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "setting_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_entries" (
    "id" UUID NOT NULL,
    "language" "Language" NOT NULL,
    "key" VARCHAR(200) NOT NULL,
    "value" VARCHAR(5000) NOT NULL,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_pages" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" TEXT NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_meta" (
    "id" UUID NOT NULL,
    "entity" "SeoEntity" NOT NULL,
    "entity_key" VARCHAR(160) NOT NULL,
    "title" VARCHAR(70),
    "description" VARCHAR(170),
    "keywords" VARCHAR(255),
    "og_image_url" VARCHAR(300),
    "no_index" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redirects" (
    "id" UUID NOT NULL,
    "from_path" VARCHAR(300) NOT NULL,
    "to_path" VARCHAR(500) NOT NULL,
    "permanent" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_kyc" (
    "vendor_id" UUID NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "pan" VARCHAR(10),
    "pan_name" VARCHAR(120),
    "pan_check" "CheckResult" NOT NULL DEFAULT 'PENDING',
    "gstin" VARCHAR(15),
    "gstin_legal_name" VARCHAR(200),
    "gstin_check" "CheckResult" NOT NULL DEFAULT 'PENDING',
    "bank_account_last4" VARCHAR(4),
    "bank_account_enc" VARCHAR(200),
    "ifsc" VARCHAR(11),
    "bank_name" VARCHAR(120),
    "penny_drop_name" VARCHAR(120),
    "penny_drop_check" "CheckResult" NOT NULL DEFAULT 'PENDING',
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" UUID,
    "rejection_reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requested_documents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "review_note" VARCHAR(500),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_kyc_pkey" PRIMARY KEY ("vendor_id")
);

-- CreateTable
CREATE TABLE "vendor_documents" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "type" "VendorDocumentType" NOT NULL,
    "storage_key" VARCHAR(200) NOT NULL,
    "content_type" VARCHAR(40) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "file_name" VARCHAR(160),
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_notes" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "kind" "VendorNoteKind" NOT NULL DEFAULT 'NOTE',
    "author_id" UUID,
    "author_name" VARCHAR(100) NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_trust_scores" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "recorded_on" DATE NOT NULL,

    CONSTRAINT "vendor_trust_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_created_at_idx" ON "audit_logs"("entity", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "content_reports_status_created_at_idx" ON "content_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "content_reports_target_type_target_id_idx" ON "content_reports"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "order_notes_order_id_created_at_idx" ON "order_notes"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "attributes_code_key" ON "attributes"("code");

-- CreateIndex
CREATE INDEX "category_attributes_attribute_id_idx" ON "category_attributes"("attribute_id");

-- CreateIndex
CREATE UNIQUE INDEX "hsn_rates_code_effective_from_key" ON "hsn_rates"("code", "effective_from");

-- CreateIndex
CREATE INDEX "product_submissions_status_submitted_at_idx" ON "product_submissions"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "product_submissions_product_id_idx" ON "product_submissions"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "setting_versions_group_version_key" ON "setting_versions"("group", "version");

-- CreateIndex
CREATE UNIQUE INDEX "content_entries_language_key_key" ON "content_entries"("language", "key");

-- CreateIndex
CREATE UNIQUE INDEX "cms_pages_slug_key" ON "cms_pages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "seo_meta_entity_entity_key_key" ON "seo_meta"("entity", "entity_key");

-- CreateIndex
CREATE UNIQUE INDEX "redirects_from_path_key" ON "redirects"("from_path");

-- CreateIndex
CREATE INDEX "vendor_kyc_status_submitted_at_idx" ON "vendor_kyc"("status", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_documents_storage_key_key" ON "vendor_documents"("storage_key");

-- CreateIndex
CREATE INDEX "vendor_documents_vendor_id_idx" ON "vendor_documents"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_notes_vendor_id_created_at_idx" ON "vendor_notes"("vendor_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_trust_scores_vendor_id_recorded_on_key" ON "vendor_trust_scores"("vendor_id", "recorded_on");

-- AddForeignKey
ALTER TABLE "staff_mfa" ADD CONSTRAINT "staff_mfa_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_submissions" ADD CONSTRAINT "product_submissions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_kyc" ADD CONSTRAINT "vendor_kyc_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_documents" ADD CONSTRAINT "vendor_documents_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_notes" ADD CONSTRAINT "vendor_notes_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_trust_scores" ADD CONSTRAINT "vendor_trust_scores_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
