-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "phone" TEXT NOT NULL DEFAULT '+998 78 113 00 13',
    "email" TEXT NOT NULL DEFAULT 'info@dachago.uz',
    "telegram" TEXT NOT NULL DEFAULT 'https://t.me/dachago_uz',
    "instagram" TEXT NOT NULL DEFAULT 'https://instagram.com/dachago.uz',
    "youtube" TEXT NOT NULL DEFAULT 'https://youtube.com/@dachago',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);
