-- AlterTable
ALTER TABLE "vendor_accounts" ADD COLUMN     "balance" DECIMAL(65,30),
ADD COLUMN     "interestRate" DECIMAL(65,30);

-- CreateTable
CREATE TABLE "vendor_account_balance_snapshots" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_account_balance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_account_balance_snapshots_accountId_recordedAt_idx" ON "vendor_account_balance_snapshots"("accountId", "recordedAt");

-- AddForeignKey
ALTER TABLE "vendor_account_balance_snapshots" ADD CONSTRAINT "vendor_account_balance_snapshots_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "vendor_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
