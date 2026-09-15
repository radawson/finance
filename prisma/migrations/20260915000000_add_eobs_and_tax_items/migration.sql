-- AlterTable
ALTER TABLE "bills" ADD COLUMN "isTaxItem" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "eobs" (
    "id" TEXT NOT NULL,
    "payerName" TEXT NOT NULL,
    "vendorId" TEXT,
    "providerName" TEXT NOT NULL,
    "claimNumber" TEXT,
    "memberId" TEXT,
    "eobDate" TIMESTAMP(3) NOT NULL,
    "serviceStart" TIMESTAMP(3),
    "serviceEnd" TIMESTAMP(3),
    "billedAmount" DECIMAL(10,2) NOT NULL,
    "insurancePaid" DECIMAL(10,2) NOT NULL,
    "adjustmentAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "patientResponsibility" DECIMAL(10,2) NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isTaxItem" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eob_procedures" (
    "id" TEXT NOT NULL,
    "eobId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dateOfService" TIMESTAMP(3) NOT NULL,
    "procedureCode" TEXT,
    "description" TEXT NOT NULL,
    "billedAmount" DECIMAL(10,2) NOT NULL,
    "allowedAmount" DECIMAL(10,2),
    "insurancePaid" DECIMAL(10,2) NOT NULL,
    "patientResponsibility" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "eob_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eob_attachments" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "eobId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eob_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eobs_createdById_eobDate_idx" ON "eobs"("createdById", "eobDate");

-- CreateIndex
CREATE INDEX "eob_procedures_eobId_sortOrder_idx" ON "eob_procedures"("eobId", "sortOrder");

-- AddForeignKey
ALTER TABLE "eobs" ADD CONSTRAINT "eobs_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eobs" ADD CONSTRAINT "eobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eob_procedures" ADD CONSTRAINT "eob_procedures_eobId_fkey" FOREIGN KEY ("eobId") REFERENCES "eobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eob_attachments" ADD CONSTRAINT "eob_attachments_eobId_fkey" FOREIGN KEY ("eobId") REFERENCES "eobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eob_attachments" ADD CONSTRAINT "eob_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
