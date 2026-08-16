-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN "foodSafetyDocumentUrl" TEXT,
ADD COLUMN "foodSafetyDocumentPublicId" TEXT,
ADD COLUMN "foodSafetyAcknowledgedAt" TIMESTAMP(3);
