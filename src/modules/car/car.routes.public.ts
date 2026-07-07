import type { FastifyInstance } from 'fastify';
import { carBookingInputSchema } from '@dacha/shared';
import { prisma } from '../../common/prisma.js';
import { carDTO } from './car.mapper.js';
import { carRepository } from './car.repository.js';
import { bookingDTO, bookingInclude, paymentInfo } from '../booking/booking.shared.js';
import { rangeFromQuery } from '../dacha/dacha.routes.public.js';
import {
  listPublicCars,
  getPublicCarBySlug,
  getCarBusyRanges,
  assertCarVisible,
  createCarBooking,
  type CarListQuery,
} from './car.service.js';

export default async function carPublicRoutes(app: FastifyInstance) {
  // --- Avtomobillar ro'yxati (filter, sort, pagination) ---
  app.get('/cars', async (req) => {
    const result = await listPublicCars(req.query as CarListQuery);
    return { ...result, items: result.items.map((c) => carDTO(c)) };
  });

  // --- Brendlar ro'yxati (filtr uchun) ---
  app.get('/cars/brands', async () => {
    return carRepository.distinctBrands();
  });

  // --- Bitta avtomobil (slug bo'yicha) ---
  app.get('/cars/:slug', async (req) => {
    const { slug } = req.params as { slug: string };
    const car = await getPublicCarBySlug(slug);
    return carDTO(car, { includeSeller: true });
  });

  // --- Bandlik kalendari ---
  app.get('/cars/:id/availability', async (req) => {
    const { id } = req.params as { id: string };
    await assertCarVisible(id);
    const { from, to } = rangeFromQuery(req.query as { from?: string; to?: string; month?: string });
    const busy = await getCarBusyRanges(id, from, to);
    return { listingId: id, busy };
  });

  // --- Bron yaratish (ro'yxatsiz) ---
  app.post(
    '/cars/:id/bookings',
    { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } },
    async (req) => {
      const { id } = req.params as { id: string };
      const data = carBookingInputSchema.parse(req.body);
      const booking = await createCarBooking(id, data);
      const full = await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: bookingInclude,
      });
      return { booking: bookingDTO(full), payment: paymentInfo(booking.depositAmount) };
    },
  );
}
