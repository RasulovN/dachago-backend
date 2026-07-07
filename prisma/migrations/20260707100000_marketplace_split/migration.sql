-- =====================================================================
-- Marketplace split: yagona "Dacha" jadvalidan 3 mustaqil modulga o'tish
--  1) Enumlar: AUTO_SERVICE -> CAR, DachaStatus -> ListingStatus, yangi enumlar
--  2) Hotel/HotelRoom/HotelImage/HotelAmenity, Car/CarImage/CarAmenity jadvallari
--  3) Booking: polymorphic FK (dachaId?, hotelRoomId?, carId?) + listingType
--  4) DATA: type='HOTEL'/'CAR' qatorlar yangi jadvallarga ko'chiriladi
--  5) Dacha jadvalidan tur-maxsus ustunlar olib tashlanadi
-- =====================================================================

-- 1) Enumlar
ALTER TYPE "ListingType" RENAME VALUE 'AUTO_SERVICE' TO 'CAR';
ALTER TYPE "DachaStatus" RENAME TO "ListingStatus";
CREATE TYPE "Transmission" AS ENUM ('MANUAL', 'AUTOMATIC');
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'GAS', 'HYBRID', 'ELECTRIC');

-- 2) HOTEL moduli jadvallari
CREATE TABLE "Hotel" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "titleUz" TEXT NOT NULL,
    "titleRu" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descUz" TEXT NOT NULL,
    "descRu" TEXT NOT NULL,
    "descEn" TEXT NOT NULL,
    "starRating" INTEGER NOT NULL DEFAULT 3,
    "breakfastIncluded" BOOLEAN NOT NULL DEFAULT false,
    "hasConference" BOOLEAN NOT NULL DEFAULT false,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "address" TEXT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "depositEnabled" BOOLEAN NOT NULL DEFAULT false,
    "depositType" "DepositType" NOT NULL DEFAULT 'FIXED',
    "depositValue" INTEGER NOT NULL DEFAULT 0,
    "checkInTime" TEXT NOT NULL DEFAULT '14:00',
    "checkOutTime" TEXT NOT NULL DEFAULT '12:00',
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HotelRoom" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "nameUz" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "pricePerNight" INTEGER NOT NULL,
    "priceWeekend" INTEGER,
    "totalRooms" INTEGER NOT NULL DEFAULT 1,
    "area" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HotelImage" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbUrl" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HotelImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HotelAmenity" (
    "hotelId" TEXT NOT NULL,
    "amenityId" TEXT NOT NULL,

    CONSTRAINT "HotelAmenity_pkey" PRIMARY KEY ("hotelId", "amenityId")
);

-- CAR moduli jadvallari
CREATE TABLE "Car" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "titleUz" TEXT NOT NULL,
    "titleRu" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descUz" TEXT NOT NULL,
    "descRu" TEXT NOT NULL,
    "descEn" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "carModel" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "seats" INTEGER NOT NULL,
    "transmission" "Transmission" NOT NULL DEFAULT 'AUTOMATIC',
    "fuelType" "FuelType" NOT NULL DEFAULT 'PETROL',
    "driverIncluded" BOOLEAN NOT NULL DEFAULT true,
    "routeInfo" TEXT,
    "pricePerDay" INTEGER NOT NULL,
    "priceWeekend" INTEGER,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "address" TEXT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "depositEnabled" BOOLEAN NOT NULL DEFAULT false,
    "depositType" "DepositType" NOT NULL DEFAULT 'FIXED',
    "depositValue" INTEGER NOT NULL DEFAULT 0,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Car_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CarImage" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbUrl" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CarImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CarAmenity" (
    "carId" TEXT NOT NULL,
    "amenityId" TEXT NOT NULL,

    CONSTRAINT "CarAmenity_pkey" PRIMARY KEY ("carId", "amenityId")
);

-- Indekslar
CREATE UNIQUE INDEX "Hotel_slug_key" ON "Hotel"("slug");
CREATE INDEX "Hotel_status_idx" ON "Hotel"("status");
CREATE INDEX "Hotel_zoneId_idx" ON "Hotel"("zoneId");
CREATE INDEX "Hotel_sellerId_idx" ON "Hotel"("sellerId");
CREATE INDEX "HotelRoom_hotelId_idx" ON "HotelRoom"("hotelId");
CREATE INDEX "HotelImage_hotelId_idx" ON "HotelImage"("hotelId");
CREATE UNIQUE INDEX "Car_slug_key" ON "Car"("slug");
CREATE INDEX "Car_status_idx" ON "Car"("status");
CREATE INDEX "Car_zoneId_idx" ON "Car"("zoneId");
CREATE INDEX "Car_sellerId_idx" ON "Car"("sellerId");
CREATE INDEX "Car_brand_idx" ON "Car"("brand");
CREATE INDEX "CarImage_carId_idx" ON "CarImage"("carId");

-- FK'lar
ALTER TABLE "Hotel" ADD CONSTRAINT "Hotel_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Hotel" ADD CONSTRAINT "Hotel_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HotelRoom" ADD CONSTRAINT "HotelRoom_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelImage" ADD CONSTRAINT "HotelImage_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelAmenity" ADD CONSTRAINT "HotelAmenity_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelAmenity" ADD CONSTRAINT "HotelAmenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "Amenity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Car" ADD CONSTRAINT "Car_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Car" ADD CONSTRAINT "Car_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CarImage" ADD CONSTRAINT "CarImage_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CarAmenity" ADD CONSTRAINT "CarAmenity_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CarAmenity" ADD CONSTRAINT "CarAmenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "Amenity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) Booking: polymorphic bog'lanish
ALTER TABLE "Booking"
    ADD COLUMN "listingType" "ListingType" NOT NULL DEFAULT 'DACHA',
    ADD COLUMN "hotelRoomId" TEXT,
    ADD COLUMN "carId" TEXT,
    ADD COLUMN "roomsCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Booking" ALTER COLUMN "dachaId" DROP NOT NULL;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_hotelRoomId_fkey" FOREIGN KEY ("hotelRoomId") REFERENCES "HotelRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Booking_hotelRoomId_status_idx" ON "Booking"("hotelRoomId", "status");
CREATE INDEX "Booking_carId_status_idx" ON "Booking"("carId", "status");
CREATE INDEX "Booking_listingType_idx" ON "Booking"("listingType");

-- =====================================================================
-- 4) DATA MIGRATSIYA: mavjud HOTEL/CAR e'lonlarini yangi jadvallarga ko'chirish
-- =====================================================================

-- 4a) Mehmonxonalar (id saqlanadi)
INSERT INTO "Hotel" ("id","slug","sellerId","zoneId","titleUz","titleRu","titleEn","descUz","descRu","descEn","starRating","lat","lng","address","status","rejectionReason","depositEnabled","depositType","depositValue","checkInTime","checkOutTime","viewsCount","createdAt","updatedAt")
SELECT "id","slug","sellerId","zoneId","titleUz","titleRu","titleEn","descUz","descRu","descEn",COALESCE("starRating",3),"lat","lng","address","status","rejectionReason","depositEnabled","depositType","depositValue","checkInTime","checkOutTime","viewsCount","createdAt","updatedAt"
FROM "Dacha" WHERE "type" = 'HOTEL';

-- Har ko'chirilgan mehmonxonaga bitta standart xona (eski narx/sig'im asosida)
INSERT INTO "HotelRoom" ("id","hotelId","nameUz","nameRu","nameEn","capacity","pricePerNight","priceWeekend","totalRooms","area","createdAt","updatedAt")
SELECT 'room_' || "id", "id", 'Standart xona', E'Стандартный номер', 'Standard room', "capacity", "pricePerDay", "priceWeekend", GREATEST(COALESCE("rooms",1),1), "area", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Dacha" WHERE "type" = 'HOTEL';

INSERT INTO "HotelImage" ("id","hotelId","url","thumbUrl","order")
SELECT i."id", i."dachaId", i."url", i."thumbUrl", i."order"
FROM "DachaImage" i JOIN "Dacha" d ON d."id" = i."dachaId" WHERE d."type" = 'HOTEL';
DELETE FROM "DachaImage" i USING "Dacha" d WHERE d."id" = i."dachaId" AND d."type" = 'HOTEL';

INSERT INTO "HotelAmenity" ("hotelId","amenityId")
SELECT a."dachaId", a."amenityId"
FROM "DachaAmenity" a JOIN "Dacha" d ON d."id" = a."dachaId" WHERE d."type" = 'HOTEL';
DELETE FROM "DachaAmenity" a USING "Dacha" d WHERE d."id" = a."dachaId" AND d."type" = 'HOTEL';

UPDATE "Booking" b SET "listingType" = 'HOTEL', "hotelRoomId" = 'room_' || b."dachaId", "dachaId" = NULL
FROM "Dacha" d WHERE d."id" = b."dachaId" AND d."type" = 'HOTEL';

-- 4b) Avtomobillar (id saqlanadi; brand = model nomining birinchi so'zi)
INSERT INTO "Car" ("id","slug","sellerId","zoneId","titleUz","titleRu","titleEn","descUz","descRu","descEn","brand","carModel","year","seats","transmission","fuelType","driverIncluded","routeInfo","pricePerDay","priceWeekend","lat","lng","address","status","rejectionReason","depositEnabled","depositType","depositValue","viewsCount","createdAt","updatedAt")
SELECT "id","slug","sellerId","zoneId","titleUz","titleRu","titleEn","descUz","descRu","descEn",
       COALESCE(NULLIF(split_part("carModel", ' ', 1), ''), 'Boshqa'),
       COALESCE("carModel", ''),
       2020,
       COALESCE("carSeats", "capacity"),
       'AUTOMATIC', 'PETROL',
       "driverIncluded", "routeInfo", "pricePerDay", "priceWeekend",
       "lat","lng","address","status","rejectionReason","depositEnabled","depositType","depositValue","viewsCount","createdAt","updatedAt"
FROM "Dacha" WHERE "type" = 'CAR';

INSERT INTO "CarImage" ("id","carId","url","thumbUrl","order")
SELECT i."id", i."dachaId", i."url", i."thumbUrl", i."order"
FROM "DachaImage" i JOIN "Dacha" d ON d."id" = i."dachaId" WHERE d."type" = 'CAR';
DELETE FROM "DachaImage" i USING "Dacha" d WHERE d."id" = i."dachaId" AND d."type" = 'CAR';

INSERT INTO "CarAmenity" ("carId","amenityId")
SELECT a."dachaId", a."amenityId"
FROM "DachaAmenity" a JOIN "Dacha" d ON d."id" = a."dachaId" WHERE d."type" = 'CAR';
DELETE FROM "DachaAmenity" a USING "Dacha" d WHERE d."id" = a."dachaId" AND d."type" = 'CAR';

UPDATE "Booking" b SET "listingType" = 'CAR', "carId" = b."dachaId", "dachaId" = NULL
FROM "Dacha" d WHERE d."id" = b."dachaId" AND d."type" = 'CAR';

-- Ko'chirilgan qatorlarni Dacha jadvalidan olib tashlaymiz
DELETE FROM "Dacha" WHERE "type" IN ('HOTEL', 'CAR');

-- =====================================================================
-- 5) Dacha jadvalini tozalash: tur-maxsus ustunlar olib tashlanadi
-- =====================================================================
UPDATE "Dacha" SET "rooms" = 1 WHERE "rooms" IS NULL;
ALTER TABLE "Dacha" ALTER COLUMN "rooms" SET NOT NULL;
DROP INDEX IF EXISTS "Dacha_type_idx";
ALTER TABLE "Dacha"
    DROP COLUMN "type",
    DROP COLUMN "starRating",
    DROP COLUMN "carModel",
    DROP COLUMN "carSeats",
    DROP COLUMN "driverIncluded",
    DROP COLUMN "routeInfo";
