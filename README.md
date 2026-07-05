# DachaGo Backend 🔧

Fastify 5 + Prisma + PostgreSQL asosidagi REST API. Dachalar, bronlar, sotuvchilar, admin moderatsiyasi, Payme to'lovlari va tarjima xizmatini boshqaradi.

## Texnologiyalar

| Texnologiya | Vazifasi |
|---|---|
| **Fastify 5** | HTTP server (CORS, rate-limit, multipart, static plaginlari bilan) |
| **Prisma 6** | ORM — PostgreSQL 18 bilan ishlaydi |
| **TypeScript** | `tsx` (dev) / `tsc + tsc-alias` (build) |
| **Zod** | So'rovlarni validatsiya qilish (sxemalar `src/shared/schemas.ts`) |
| **@fastify/jwt** | Access + Refresh token autentifikatsiya |
| **argon2** | Parollarni xeshlash |
| **sharp** | Rasmlarni siqish va thumbnail yaratish |
| **@vitalets/google-translate-api** | Uz→Ru/En avtomatik tarjima (bepul) |

## Talablar

- **Node.js 20+**
- **PostgreSQL 18** (lokal, Docker emas) — parol `postgres`, baza `dachago`

## O'rnatish va ishga tushirish

```bash
# 1. Bog'liqliklarni o'rnatish
npm install

# 2. Muhit faylini yaratish
cp .env.example .env
#    .env dagi DATABASE_URL ni o'z parolingiz bilan to'ldiring

# 3. Bazani yaratish/migratsiya + boshlang'ich ma'lumotlar
npm run db:migrate
npm run db:seed

# 4. Dev rejimda ishga tushirish (http://localhost:3000)
npm run dev
```

## NPM skriptlari

| Buyruq | Vazifasi |
|---|---|
| `npm run dev` | Dev server (`tsx watch`, hot-reload) |
| `npm run build` | Production build (`tsc` + `tsc-alias` → `dist/`) |
| `npm start` | Production'da ishga tushirish (`node dist/server.js`) |
| `npm run db:generate` | Prisma Client generatsiya |
| `npm run db:migrate` | Yangi migratsiya yaratish/qo'llash (dev) |
| `npm run db:deploy` | Migratsiyalarni qo'llash (production) |
| `npm run db:seed` | Boshlang'ich ma'lumotlar (admin, seller, zonalar, qulayliklar) |
| `npm run db:studio` | Prisma Studio (bazani brauzerda ko'rish) |
| `npm run db:reset` | ⚠️ Bazani to'liq o'chirib qayta yaratish |

## Muhit o'zgaruvchilari (`.env`)

```env
# Ma'lumotlar bazasi
DATABASE_URL="postgresql://postgres:PAROL@localhost:5432/dachago?schema=public"

# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# JWT (production'da albatta o'zgartiring!)
JWT_ACCESS_SECRET="..."      # access token kaliti
JWT_REFRESH_SECRET="..."     # refresh token kaliti
JWT_ACCESS_TTL="15m"         # access token muddati
JWT_REFRESH_TTL="30d"        # refresh token muddati

# CORS — frontend manzillari
WEB_ORIGIN="http://localhost:5173"      # client
ADMIN_ORIGIN="http://localhost:5174"
LANDING_ORIGIN="http://localhost:5175"  # landing

# Fayllar
UPLOAD_DIR="../../uploads"              # rasm/video saqlanadigan papka
PUBLIC_BASE_URL="http://localhost:3000" # fayl URL'lari uchun bazaviy manzil

# Payme Merchant API
PAYME_MERCHANT_ID="sizning_merchant_id"
PAYME_KEY="sizning_kassa_kaliti"
PAYME_CHECKOUT_URL="https://checkout.paycom.uz"  # sandbox: checkout.test.paycom.uz
```

## Papka tuzilishi

```
backend/
├── prisma/
│   ├── schema.prisma      # Baza modellari
│   ├── migrations/        # SQL migratsiyalar
│   └── seed.ts            # Boshlang'ich ma'lumotlar
├── src/
│   ├── server.ts          # Kirish nuqtasi
│   ├── app.ts             # Fastify ilova: plaginlar + routelar
│   ├── config/env.ts      # .env o'qish va validatsiya
│   ├── lib/
│   │   ├── prisma.ts      # Prisma client (singleton)
│   │   ├── errors.ts      # Xatolik klasslari va handler
│   │   ├── mappers.ts     # Prisma → DTO konvertatsiya
│   │   ├── slug.ts        # Slug generatsiya
│   │   └── storage.ts     # Fayl saqlash (sharp bilan siqish)
│   ├── plugins/auth.ts    # JWT plagin: authenticate/requireRole
│   ├── routes/
│   │   ├── public.ts      # Ochiq endpointlar (auth talab qilmaydi)
│   │   ├── auth.ts        # Ro'yxatdan o'tish / kirish
│   │   ├── seller.ts      # Sotuvchi paneli API
│   │   ├── admin.ts       # Super-admin API
│   │   ├── payme.ts       # Payme JSON-RPC webhook
│   │   └── translate.ts   # Tarjima xizmati
│   ├── services/
│   │   ├── availability.ts # Bandlik kalendari hisoblash
│   │   ├── payme.ts        # Payme Merchant API logikasi
│   │   └── cron.ts         # Muddati o'tgan bronlarni EXPIRED qilish
│   └── shared/            # Umumiy tiplar/sxemalar (@dacha/shared alias)
└── tsconfig.json
```

## Baza modellari (Prisma)

`User` (SUPER_ADMIN / SELLER) → `SellerProfile` → `Dacha` → `DachaImage` / `DachaVideo` / `DachaAmenity` → `Booking` → `PaymeTransaction`. Qo'shimcha: `Zone` (turizm zonalari), `Amenity` (qulayliklar), `RefreshToken`.

Statuslar:
- **DachaStatus:** `DRAFT → PENDING → ACTIVE / REJECTED / ARCHIVED`
- **BookingStatus:** `PENDING → CONFIRMED → COMPLETED / CANCELLED / EXPIRED`
- **PaymentStatus:** `PENDING / AWAITING / PAID / NOT_REQUIRED / REFUNDED`

## API Endpointlar

### Ochiq (`/api`) — auth talab qilinmaydi

| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/api/zones` | Barcha zonalar (dacha soni bilan) |
| GET | `/api/zones/:slug` | Bitta zona |
| GET | `/api/amenities` | Qulayliklar ro'yxati |
| GET | `/api/dachas` | Katalog: `?zone=&minPrice=&maxPrice=&capacity=&amenities=&sort=&page=&pageSize=` |
| GET | `/api/dachas/:slug` | Dacha tafsilotlari (ko'rishlar sonini oshiradi) |
| GET | `/api/dachas/:id/availability?month=YYYY-MM` | Oylik bandlik kalendari |
| POST | `/api/bookings` | Bron yaratish (rate-limit: 10 ta / 10 daqiqa) |
| GET | `/api/bookings/:code` | Bron holatini kod bo'yicha tekshirish (`DG-XXXXXX`) |

### Auth (`/api/auth`)

| Metod | Yo'l | Tavsif |
|---|---|---|
| POST | `/api/auth/register` | Sotuvchi ro'yxatdan o'tishi (admin tasdig'ini kutadi) |
| POST | `/api/auth/login` | Kirish → `{ accessToken, refreshToken, user }` |
| POST | `/api/auth/refresh` | Tokenni yangilash |
| POST | `/api/auth/logout` | Chiqish (refresh tokenni bekor qiladi) |
| GET | `/api/auth/me` | Joriy foydalanuvchi 🔒 |

### Sotuvchi (`/api/seller`) — 🔒 SELLER roli

| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/api/seller/dashboard` | Statistika (bronlar, daromad, ko'rishlar) |
| GET | `/api/seller/finance` | Daromadlar: jami, kutilayotgan zakalat, tarix |
| GET/POST | `/api/seller/dachas` | O'z dachalari / yangi qo'shish |
| GET/PATCH/DELETE | `/api/seller/dachas/:id` | Ko'rish / tahrirlash / o'chirish |
| POST | `/api/seller/dachas/:id/images` | Rasm yuklash (multipart, sharp siqadi) |
| POST | `/api/seller/dachas/:id/videos` | Video yuklash |
| DELETE | `/api/seller/images/:imageId`, `/videos/:videoId` | Media o'chirish |
| GET | `/api/seller/bookings` | O'z bronlari |
| PATCH | `/api/seller/bookings/:id` | Bron statusini o'zgartirish (tasdiqlash/bekor) |
| PATCH | `/api/seller/settings` | Profil sozlamalari |

### Admin (`/api/admin`) — 🔒 SUPER_ADMIN roli

| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/api/admin/dashboard` | Umumiy statistika + chartlar |
| GET/PATCH | `/api/admin/sellers`, `/sellers/:id` | Sotuvchilar / tasdiqlash-bloklash |
| GET/POST/PATCH/DELETE | `/api/admin/zones`, `/zones/:id` | Zonalar CRUD |
| GET/POST/PATCH/DELETE | `/api/admin/amenities`, `/amenities/:id` | Qulayliklar CRUD |
| GET/PATCH | `/api/admin/dachas`, `/dachas/:id` | Moderatsiya (ACTIVE/REJECTED) |
| GET | `/api/admin/bookings` | Barcha bronlar |
| GET | `/api/admin/finance`, `/finance/bookings` | Moliya: zakalat tushumlari |
| PATCH | `/api/admin/bookings/:id/payout` | Sellerga payout belgilash |
| POST | `/api/admin/upload` | Fayl yuklash (zona rasmlari uchun) |

### Boshqa

| Metod | Yo'l | Tavsif |
|---|---|---|
| POST | `/api/payme` | Payme JSON-RPC webhook (Basic auth, PAYME_KEY bilan) |
| POST | `/api/translate` | Uz→Ru/En tarjima 🔒 (rate-limit: 60 ta/daqiqa) |
| GET | `/uploads/*` | Yuklangan fayllar (static) |

## Muhim tafsilotlar

- **Bron konflikti:** `POST /api/bookings` tranzaksiya ichida sana kesishuvini tekshiradi — ikki karra bron mumkin emas (`datesBusy` xatosi qaytadi).
- **Cron:** har daqiqada muddati o'tgan `PENDING` bronlar avtomatik `EXPIRED` bo'ladi va sanalar bo'shaydi (`src/services/cron.ts`).
- **Zakalat:** dacha sozlamasiga qarab foiz (`PERCENT`) yoki qat'iy summa (`FIXED`). To'lov Payme orqali: `CreateTransaction → PerformTransaction` webhook zanjiri bronni `AWAITING → PAID` qiladi.
- **Rasmlar:** sharp bilan siqiladi, `url` + `thumbUrl` yaratiladi, `UPLOAD_DIR`ga yoziladi.
- **Shared kod:** `src/shared/` — client bilan bir xil tiplar/Zod sxemalar. Import: `@dacha/shared` (tsconfig `paths` + build'da `tsc-alias`).

## Seed akkauntlar

| Rol | Telefon | Parol |
|---|---|---|
| Super admin | `+998901112233` | `admin123` |
| Demo seller | `+998907778899` | `seller123` |

## Production deploy

```bash
npm run build          # dist/ yaratadi
npm run db:deploy      # migratsiyalarni qo'llaydi
NODE_ENV=production npm start
```

Eslatmalar: `JWT_*_SECRET`larni almashtiring, `PAYME_*` real kalitlarni qo'ying, `WEB_ORIGIN`/`LANDING_ORIGIN`ga real domenlarni yozing, `UPLOAD_DIR` uchun doimiy disk ajrating.
