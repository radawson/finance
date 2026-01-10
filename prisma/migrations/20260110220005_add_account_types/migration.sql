-- AlterTable
ALTER TABLE "vendor_accounts" ADD COLUMN     "accountTypeId" TEXT;

-- CreateTable
CREATE TABLE "account_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_types_name_key" ON "account_types"("name");

-- AddForeignKey
ALTER TABLE "vendor_accounts" ADD CONSTRAINT "vendor_accounts_accountTypeId_fkey" FOREIGN KEY ("accountTypeId") REFERENCES "account_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
