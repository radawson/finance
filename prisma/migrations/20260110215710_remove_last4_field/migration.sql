/*
  Warnings:

  - You are about to drop the column `last4` on the `vendor_accounts` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "bills_vendorAccountId_idx";

-- DropIndex
DROP INDEX "vendor_accounts_vendorId_idx";

-- AlterTable
ALTER TABLE "vendor_accounts" DROP COLUMN "last4";
