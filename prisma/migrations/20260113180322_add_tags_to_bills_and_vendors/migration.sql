-- AlterTable
ALTER TABLE "bills" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
