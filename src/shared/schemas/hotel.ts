import { z } from 'zod';
import { listingBaseSchema, timeSchema } from './common.js';

// Faqat mehmonxonaga tegishli maydonlar — narx alohida xonalarda (HotelRoom)
export const hotelInputSchema = listingBaseSchema.extend({
  starRating: z.number().int().min(1).max(5),
  breakfastIncluded: z.boolean().default(false),
  hasConference: z.boolean().default(false),
  checkInTime: timeSchema.default('14:00'),
  checkOutTime: timeSchema.default('12:00'),
});
export type HotelInput = z.infer<typeof hotelInputSchema>;

export const hotelUpdateSchema = hotelInputSchema.partial();
export type HotelUpdateInput = z.infer<typeof hotelUpdateSchema>;

// Xona turi: narx/sig'im shu yerda; totalRooms — shu turdagi xonalar soni
export const hotelRoomInputSchema = z.object({
  nameUz: z.string().trim().min(2),
  nameRu: z.string().trim().min(2),
  nameEn: z.string().trim().min(2),
  capacity: z.number().int().positive().max(50),
  pricePerNight: z.number().int().positive(),
  priceWeekend: z.number().int().positive().optional().nullable(),
  totalRooms: z.number().int().positive().max(500).default(1),
  area: z.number().int().positive().optional().nullable(),
});
export type HotelRoomInput = z.infer<typeof hotelRoomInputSchema>;

export const hotelRoomUpdateSchema = hotelRoomInputSchema.partial();
export type HotelRoomUpdateInput = z.infer<typeof hotelRoomUpdateSchema>;
