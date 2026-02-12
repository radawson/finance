-- AlterEnum
ALTER TYPE "BillStatus" ADD VALUE 'PREDICTED';

-- AlterTable
ALTER TABLE "bills" ADD COLUMN     "predictionConfidence" DECIMAL(3,2),
ADD COLUMN     "predictionMethod" TEXT,
ADD COLUMN     "templateBillId" TEXT;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_templateBillId_fkey" FOREIGN KEY ("templateBillId") REFERENCES "bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
