import { z } from 'zod';
import { phoneSchema } from './common.js';

/**
 * Mehmon ma'lumotlari — barcha bron turlari uchun umumiy qism.
 * E'lon ID'si URL'dan olinadi (POST /api/dachas/:id/bookings kabi),
 * shuning uchun body'da e'lon identifikatori yo'q.
 */
export const bookingGuestSchema = z.object({
  guestFirstName: z.string().trim().min(2),
  guestLastName: z.string().trim().min(2),
  guestPhone: phoneSchema,
  checkIn: z.string().datetime({ offset: true }).or(z.string().min(10)),
  checkOut: z.string().datetime({ offset: true }).or(z.string().min(10)),
  guestsCount: z.number().int().positive().max(500),
  note: z.string().trim().max(500).optional(),
});
export type BookingGuestInput = z.infer<typeof bookingGuestSchema>;

export const dachaBookingInputSchema = bookingGuestSchema;
export type DachaBookingInput = z.infer<typeof dachaBookingInputSchema>;

export const carBookingInputSchema = bookingGuestSchema;
export type CarBookingInput = z.infer<typeof carBookingInputSchema>;

// Mehmonxona: nechta xona band qilinishi ham kiritiladi
export const hotelBookingInputSchema = bookingGuestSchema.extend({
  roomsCount: z.number().int().min(1).max(50).default(1),
});
export type HotelBookingInput = z.infer<typeof hotelBookingInputSchema>;
