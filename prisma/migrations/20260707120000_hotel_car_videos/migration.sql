-- Mehmonxona va avtomobil e'lonlari uchun video (dacha bilan bir xil imkoniyat)
CREATE TABLE "HotelVideo" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HotelVideo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CarVideo" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CarVideo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HotelVideo_hotelId_idx" ON "HotelVideo"("hotelId");
CREATE INDEX "CarVideo_carId_idx" ON "CarVideo"("carId");

ALTER TABLE "HotelVideo" ADD CONSTRAINT "HotelVideo_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CarVideo" ADD CONSTRAINT "CarVideo_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;
