import 'dotenv/config';
import path from 'node:path';

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Muhit o'zgaruvchisi topilmadi: ${name}`);
  return v;
}

// apps/api/ ichidan ishga tushadi; standart yuklamalar papkasi repo ildizida
const uploadDirRaw = process.env.UPLOAD_DIR ?? '../../uploads';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',

  databaseUrl: req('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/dachago?schema=public'),

  jwt: {
    accessSecret: req('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
    refreshSecret: req('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  },

  cors: {
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    adminOrigin: process.env.ADMIN_ORIGIN ?? 'http://localhost:5174',
    landingOrigin: process.env.LANDING_ORIGIN ?? 'http://localhost:5175',
  },

  // Absolyut yo'lga aylantiramiz (process.cwd() = backend/ ishga tushganda)
  uploadDir: path.isAbsolute(uploadDirRaw)
    ? uploadDirRaw
    : path.resolve(process.cwd(), uploadDirRaw),

  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000',

  payme: {
    merchantId: process.env.PAYME_MERCHANT_ID ?? '',
    key: process.env.PAYME_KEY ?? '',
    checkoutUrl: process.env.PAYME_CHECKOUT_URL ?? 'https://checkout.paycom.uz',
  },
};

export const isDev = env.nodeEnv !== 'production';
