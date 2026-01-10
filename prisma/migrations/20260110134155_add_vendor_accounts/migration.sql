-- CreateTable
CREATE TABLE "vendor_accounts" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountType" TEXT,
    "nickname" TEXT,
    "last4" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_accounts_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "bills" ADD COLUMN "vendorAccountId" TEXT;

-- AddForeignKey
ALTER TABLE "vendor_accounts" ADD CONSTRAINT "vendor_accounts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_vendorAccountId_fkey" FOREIGN KEY ("vendorAccountId") REFERENCES "vendor_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "vendor_accounts_vendorId_idx" ON "vendor_accounts"("vendorId");

-- CreateIndex
CREATE INDEX "bills_vendorAccountId_idx" ON "bills"("vendorAccountId");
