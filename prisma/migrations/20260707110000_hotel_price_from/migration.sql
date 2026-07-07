-- Mehmonxona: eng arzon xona narxi (ro'yxatda ko'rsatish va saralash uchun)
ALTER TABLE "Hotel" ADD COLUMN "priceFrom" INTEGER NOT NULL DEFAULT 0;
UPDATE "Hotel" h SET "priceFrom" = COALESCE(
  (SELECT MIN(r."pricePerNight") FROM "HotelRoom" r WHERE r."hotelId" = h."id"), 0);
