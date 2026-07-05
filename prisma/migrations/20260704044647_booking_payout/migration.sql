-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "paidOutAt" TIMESTAMP(3),
ADD COLUMN     "sellerPaidOut" BOOLEAN NOT NULL DEFAULT false;
