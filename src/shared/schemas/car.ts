import { z } from 'zod';
import { TRANSMISSIONS, FUEL_TYPES } from '../constants.js';
import { listingBaseSchema } from './common.js';

// Faqat avtomobilga tegishli maydonlar
export const carInputSchema = listingBaseSchema.extend({
  brand: z.string().trim().min(2).max(60),
  carModel: z.string().trim().min(1).max(120),
  year: z.number().int().min(1980).max(2035),
  seats: z.number().int().positive().max(60),
  transmission: z.enum(TRANSMISSIONS).default('AUTOMATIC'),
  fuelType: z.enum(FUEL_TYPES).default('PETROL'),
  driverIncluded: z.boolean().default(true),
  routeInfo: z.string().trim().max(200).optional().nullable(),
  pricePerDay: z.number().int().positive(),
  priceWeekend: z.number().int().positive().optional().nullable(),
});
export type CarInput = z.infer<typeof carInputSchema>;

export const carUpdateSchema = carInputSchema.partial();
export type CarUpdateInput = z.infer<typeof carUpdateSchema>;
