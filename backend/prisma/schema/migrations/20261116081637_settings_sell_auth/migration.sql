-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "VendorLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'ONBOARDED', 'REJECTED');

-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'CHANGE_CONTACT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "date_of_birth" DATE,
ADD COLUMN     "gender" "Gender";

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "channels" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "account_deletions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" VARCHAR(300),
    "retain_until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_deletions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_leads" (
    "id" UUID NOT NULL,
    "contact_name" VARCHAR(100) NOT NULL,
    "business_name" VARCHAR(160) NOT NULL,
    "mobile" VARCHAR(16) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "city" VARCHAR(80) NOT NULL,
    "category_id" UUID,
    "gstin" VARCHAR(15),
    "status" "VendorLeadStatus" NOT NULL DEFAULT 'NEW',
    "ip" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_deletions_user_id_key" ON "account_deletions"("user_id");

-- CreateIndex
CREATE INDEX "vendor_leads_status_created_at_idx" ON "vendor_leads"("status", "created_at");

-- CreateIndex
CREATE INDEX "vendor_leads_mobile_idx" ON "vendor_leads"("mobile");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_deletions" ADD CONSTRAINT "account_deletions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
