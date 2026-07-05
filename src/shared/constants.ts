export const LOCALES = ['uz', 'ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'uz';

export const USER_ROLES = ['SUPER_ADMIN', 'SELLER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'BLOCKED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const DACHA_STATUSES = ['DRAFT', 'PENDING', 'ACTIVE', 'REJECTED', 'ARCHIVED'] as const;
export type DachaStatus = (typeof DACHA_STATUSES)[number];

export const BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = ['NOT_REQUIRED', 'AWAITING', 'PAID', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DEPOSIT_TYPES = ['FIXED', 'PERCENT'] as const;
export type DepositType = (typeof DEPOSIT_TYPES)[number];

// Media limitlari
export const MAX_IMAGES_PER_DACHA = 15;
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEOS_PER_DACHA = 2;
export const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

// Bron: tasdiqlanmagan bron amal qilish muddati (soat)
export const BOOKING_PENDING_TTL_HOURS = 24;

// Narx: so'mda saqlanadi (butun son)
export const CURRENCY = 'UZS';

// Payme tranzaksiya holatlari (Merchant API protokoli)
export const PAYME_STATE = {
  CREATED: 1,
  PERFORMED: 2,
  CANCELLED: -1,
  CANCELLED_AFTER_PERFORM: -2,
} as const;
