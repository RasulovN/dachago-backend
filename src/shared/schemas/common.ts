import { z } from 'zod';
import { LOCALES, DEPOSIT_TYPES, LISTING_TYPES } from '../constants.js';

// O'zbekiston telefon raqami: +998 XX XXX XX XX
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+998\d{9}$/, 'Telefon raqami +998XXXXXXXXX formatida bo\'lishi kerak');

export const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);

export const localizedTextSchema = z.object({
  uz: z.string().trim().min(1),
  ru: z.string().trim().min(1),
  en: z.string().trim().min(1),
});

/**
 * Barcha e'lon turlari uchun umumiy maydonlar (BaseListing).
 * Har modul o'z sxemasini shundan extend qiladi — tur-maxsus maydonlar
 * faqat o'sha modul sxemasida bo'ladi.
 */
export const listingBaseSchema = z.object({
  zoneId: z.string().min(1),
  titleUz: z.string().trim().min(3),
  titleRu: z.string().trim().min(3),
  titleEn: z.string().trim().min(3),
  descUz: z.string().trim().min(10),
  descRu: z.string().trim().min(10),
  descEn: z.string().trim().min(10),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().trim().min(3),
  depositEnabled: z.boolean().default(false),
  depositType: z.enum(DEPOSIT_TYPES).default('FIXED'),
  depositValue: z.number().int().nonnegative().default(0),
  amenityIds: z.array(z.string()).default([]),
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
  types: z.array(z.enum(LISTING_TYPES)).min(1).default(['DACHA', 'HOTEL']),
});
export type AmenityInput = z.infer<typeof amenityInputSchema>;

// ---- Seller settings ----
export const sellerSettingsSchema = z.object({
  firstName: z.string().trim().min(2).optional(),
  lastName: z.string().trim().min(2).optional(),
  companyName: z.string().trim().optional().nullable(),
  address: z.string().trim().optional(),
});

// ---- Sayt sozlamalari (super admin) ----
export const siteSettingsSchema = z.object({
  phone: z.string().trim().min(5).max(30),
  email: z.string().trim().email(),
  telegram: z.string().trim().url().or(z.literal('')),
  instagram: z.string().trim().url().or(z.literal('')),
  youtube: z.string().trim().url().or(z.literal('')),
});
export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;
