-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('DACHA', 'HOTEL', 'AUTO_SERVICE');

-- AlterTable
ALTER TABLE "Dacha" ADD COLUMN     "carModel" TEXT,
ADD COLUMN     "carSeats" INTEGER,
ADD COLUMN     "driverIncluded" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "routeInfo" TEXT,
ADD COLUMN     "starRating" INTEGER,
ADD COLUMN     "type" "ListingType" NOT NULL DEFAULT 'DACHA',
ALTER COLUMN "rooms" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Dacha_type_idx" ON "Dacha"("type");
