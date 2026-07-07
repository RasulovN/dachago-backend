import type { FastifyInstance } from 'fastify';
import { hotelBookingInputSchema } from '@dacha/shared';
import { prisma } from '../../common/prisma.js';
import { hotelDTO } from './hotel.mapper.js';
import { bookingDTO, bookingInclude, paymentInfo } from '../booking/booking.shared.js';
import { rangeFromQuery } from '../dacha/dacha.routes.public.js';
import {
  listPublicHotels,
  getPublicHotelBySlug,
  getRoomBusyRanges,
  createHotelBooking,
  type HotelListQuery,
} from './hotel.service.js';

export default async function hotelPublicRoutes(app: FastifyInstance) {
  // --- Mehmonxonalar ro'yxati (filter, sort, pagination) ---
  app.get('/hotels', async (req) => {
    const result = await listPublicHotels(req.query as HotelListQuery);
    return { ...result, items: result.items.map((h) => hotelDTO(h)) };
  });

  // --- Bitta mehmonxona (slug bo'yicha) ---
  app.get('/hotels/:slug', async (req) => {
    const { slug } = req.params as { slug: string };
    const hotel = await getPublicHotelBySlug(slug);
    return hotelDTO(hotel, { includeSeller: true });
  });

  // --- Xona bandlik kalendari ---
  app.get('/hotels/rooms/:roomId/availability', async (req) => {
    const { roomId } = req.params as { roomId: string };
    const q = req.query as { from?: string; to?: string; month?: string; rooms?: string };
    const { from, to } = rangeFromQuery(q);
    const busy = await getRoomBusyRanges(roomId, from, to, Math.max(1, Number(q.rooms ?? 1)));
    return { listingId: roomId, busy };
  });

  // --- Xona broni yaratish (ro'yxatsiz) ---
  app.post(
    '/hotels/rooms/:roomId/bookings',
    { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } },
    async (req) => {
      const { roomId } = req.params as { roomId: string };
      const data = hotelBookingInputSchema.parse(req.body);
      const booking = await createHotelBooking(roomId, data);
      const full = await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: bookingInclude,
      });
      return { booking: bookingDTO(full), payment: paymentInfo(booking.depositAmount) };
    },
  );
}
