-- AlterTable
ALTER TABLE "Amenity" ADD COLUMN     "types" "ListingType"[] DEFAULT ARRAY['DACHA', 'HOTEL']::"ListingType"[];

-- AlterTable
ALTER TABLE "SiteSettings" ALTER COLUMN "email" SET DEFAULT 'info@sayohatgo.uz',
ALTER COLUMN "telegram" SET DEFAULT 'https://t.me/sayohatgo_uz',
ALTER COLUMN "instagram" SET DEFAULT 'https://instagram.com/sayohatgo.uz',
ALTER COLUMN "youtube" SET DEFAULT 'https://youtube.com/@sayohatgo';
