-- CreateEnum
CREATE TYPE "HygieneCertificateLevel" AS ENUM ('LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4');

-- CreateEnum
CREATE TYPE "HygieneCertificateStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN "hygieneCertificateLevel" "HygieneCertificateLevel",
ADD COLUMN "hygieneCertificateDocumentUrl" TEXT,
ADD COLUMN "hygieneCertificateDocumentPublicId" TEXT,
ADD COLUMN "hygieneCertificateStatus" "HygieneCertificateStatus",
ADD COLUMN "hygieneCertificateSubmittedAt" TIMESTAMP(3),
ADD COLUMN "hygieneCertificateVerifiedAt" TIMESTAMP(3),
ADD COLUMN "hygieneCertificateRejectionReason" TEXT;
