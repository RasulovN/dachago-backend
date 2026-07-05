import { z } from 'zod';
import { LOCALES, DEPOSIT_TYPES } from './constants.js';

// O'zbekiston telefon raqami: +998 XX XXX XX XX
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+998\d{9}$/, 'Telefon raqami +998XXXXXXXXX formatida bo\'lishi kerak');

export const localizedTextSchema = z.object({
  uz: z.string().trim().min(1),
  ru: z.string().trim().min(1),
  en: z.string().trim().min(1),
});

// ---- Auth ----
export const registerSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(6, 'Parol kamida 6 belgi'),
  firstName: z.string().trim().min(2),
  lastName: z.string().trim().min(2),
  companyName: z.string().trim().optional(),
  passportInfo: z.string().trim().min(3),
  address: z.string().trim().min(3),
  email: z.string().email().optional().or(z.literal('')),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ---- Translate ----
export const translateSchema = z.object({
  text: z.string().trim().min(1),
  from: z.enum(LOCALES).default('uz'),
  to: z.array(z.enum(LOCALES)).min(1),
});
export type TranslateInput = z.infer<typeof translateSchema>;

// ---- Dacha ----
export const dachaInputSchema = z.object({
  zoneId: z.string().min(1),
  titleUz: z.string().trim().min(3),
  titleRu: z.string().trim().min(3),
  titleEn: z.string().trim().min(3),
  descUz: z.string().trim().min(10),
  descRu: z.string().trim().min(10),
  descEn: z.string().trim().min(10),
  pricePerDay: z.number().int().positive(),
  priceWeekend: z.number().int().positive().optional().nullable(),
  capacity: z.number().int().positive().max(500),
  rooms: z.number().int().positive().max(100),
  area: z.number().int().positive().optional().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().trim().min(3),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/).default('14:00'),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/).default('12:00'),
  depositEnabled: z.boolean().default(false),
  depositType: z.enum(DEPOSIT_TYPES).default('FIXED'),
  depositValue: z.number().int().nonnegative().default(0),
  amenityIds: z.array(z.string()).default([]),
});
export type DachaInput = z.infer<typeof dachaInputSchema>;

// ---- Booking ----
export const bookingInputSchema = z.object({
  dachaId: z.string().min(1),
  guestFirstName: z.string().trim().min(2),
  guestLastName: z.string().trim().min(2),
  guestPhone: phoneSchema,
  checkIn: z.string().datetime({ offset: true }).or(z.string().min(10)),
  checkOut: z.string().datetime({ offset: true }).or(z.string().min(10)),
  guestsCount: z.number().int().positive().max(500),
  note: z.string().trim().max(500).optional(),
});
export type BookingInput = z.infer<typeof bookingInputSchema>;

// ---- Zone (admin) ----
export const zoneInputSchema = z.object({
  slug: z.string().trim().min(2).regex(/^[a-z0-9-]+$/),
  nameUz: z.string().trim().min(2),
  nameRu: z.string().trim().min(2),
  nameEn: z.string().trim().min(2),
  descUz: z.string().trim().default(''),
  descRu: z.string().trim().default(''),
  descEn: z.string().trim().default(''),
  image: z.string().trim().optional().nullable(),
  isActive: z.boolean().default(true),
});
export type ZoneInput = z.infer<typeof zoneInputSchema>;

// ---- Amenity (admin) ----
export const amenityInputSchema = z.object({
  icon: z.string().trim().min(1),
  nameUz: z.string().trim().min(2),
  nameRu: z.string().trim().min(2),
  nameEn: z.string().trim().min(2),
});
export type AmenityInput = z.infer<typeof amenityInputSchema>;

// ---- Seller settings ----
export const sellerSettingsSchema = z.object({
  firstName: z.string().trim().min(2).optional(),
  lastName: z.string().trim().min(2).optional(),
  companyName: z.string().trim().optional().nullable(),
  address: z.string().trim().optional(),
});
