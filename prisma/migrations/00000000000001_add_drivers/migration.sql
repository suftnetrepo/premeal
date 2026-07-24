-- CreateEnum
CREATE TYPE "DriverAssociationStatus" AS ENUM ('PENDING', 'ACTIVE', 'DECLINED', 'REMOVED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'DRIVER';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "driverId" TEXT;

-- CreateTable
CREATE TABLE "RestaurantDriver" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "driverId" TEXT,
    "email" TEXT NOT NULL,
    "status" "DriverAssociationStatus" NOT NULL DEFAULT 'PENDING',
    "inviteTokenHash" TEXT,
    "inviteTokenExpiresAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "RestaurantDriver_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantDriver_inviteTokenHash_key" ON "RestaurantDriver"("inviteTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantDriver_restaurantId_email_key" ON "RestaurantDriver"("restaurantId", "email");

-- AddForeignKey
ALTER TABLE "RestaurantDriver" ADD CONSTRAINT "RestaurantDriver_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantDriver" ADD CONSTRAINT "RestaurantDriver_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

