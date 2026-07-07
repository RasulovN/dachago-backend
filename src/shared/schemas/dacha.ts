import { z } from 'zod';
import { listingBaseSchema, timeSchema } from './common.js';

// Faqat dachaga tegishli maydonlar — hech qanday tur diskriminatori yo'q
export const dachaInputSchema = listingBaseSchema.extend({
  pricePerDay: z.number().int().positive(),
  priceWeekend: z.number().int().positive().optional().nullable(),
  capacity: z.number().int().positive().max(500),
  rooms: z.number().int().positive().max(100),
  area: z.number().int().positive().optional().nullable(),
  checkInTime: timeSchema.default('14:00'),
  checkOutTime: timeSchema.default('12:00'),
});
export type DachaInput = z.infer<typeof dachaInputSchema>;

export const dachaUpdateSchema = dachaInputSchema.partial();
export type DachaUpdateInput = z.infer<typeof dachaUpdateSchema>;
