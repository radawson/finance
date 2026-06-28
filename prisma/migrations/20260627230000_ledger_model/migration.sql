-- Ledger-model refactor.
-- Adds the Expense ledger + BudgetEnvelope tables and Category.kind; removes the
-- prediction feature (PREDICTED bill status + templateBillId/predictionConfidence/
-- predictionMethod columns).
--
-- Data cleanup: synthetic PREDICTED bills have no representation in the new model and
-- would block the BillStatus enum swap below (the USING cast can't map 'PREDICTED').
-- Remove them first. The real PENDING/PAID bills are untouched.
DELETE FROM "bills" WHERE "status" = 'PREDICTED';

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('FIXED', 'VARIABLE');

-- CreateEnum
CREATE TYPE "EnvelopePeriod" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');

-- AlterEnum
BEGIN;
CREATE TYPE "BillStatus_new" AS ENUM ('PENDING', 'DUE_SOON', 'OVERDUE', 'PAID', 'SKIPPED');
ALTER TABLE "bills" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "bills" ALTER COLUMN "status" TYPE "BillStatus_new" USING ("status"::text::"BillStatus_new");
ALTER TYPE "BillStatus" RENAME TO "BillStatus_old";
ALTER TYPE "BillStatus_new" RENAME TO "BillStatus";
DROP TYPE "BillStatus_old";
ALTER TABLE "bills" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "bills" DROP CONSTRAINT "bills_templateBillId_fkey";

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "kind" "CategoryKind" NOT NULL DEFAULT 'VARIABLE';

-- AlterTable
ALTER TABLE "bills" DROP COLUMN "predictionConfidence",
DROP COLUMN "predictionMethod",
DROP COLUMN "templateBillId";

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "categoryId" TEXT NOT NULL,
    "payee" TEXT,
    "note" TEXT,
    "vendorId" TEXT,
    "billId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_envelopes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "period" "EnvelopePeriod" NOT NULL DEFAULT 'MONTHLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_envelopes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expenses_billId_key" ON "expenses"("billId");

-- CreateIndex
CREATE INDEX "expenses_createdById_date_idx" ON "expenses"("createdById", "date");

-- CreateIndex
CREATE INDEX "expenses_categoryId_date_idx" ON "expenses"("categoryId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "budget_envelopes_userId_categoryId_key" ON "budget_envelopes"("userId", "categoryId");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_envelopes" ADD CONSTRAINT "budget_envelopes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_envelopes" ADD CONSTRAINT "budget_envelopes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
