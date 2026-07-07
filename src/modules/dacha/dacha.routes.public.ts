import type { FastifyInstance } from 'fastify';
import { dachaBookingInputSchema } from '@dacha/shared';
import { dachaDTO } from './dacha.mapper.js';
import { paymentInfo } from '../booking/booking.shared.js';
import { bookingDTO, bookingInclude } from '../booking/booking.shared.js';
import { prisma } from '../../common/prisma.js';
import {
  listPublicDachas,
  getPublicDachaBySlug,
  getDachaBusyRanges,
  assertDachaVisible,
  createDachaBooking,
  type DachaListQuery,
} from './dacha.service.js';

/** month="2026-07" yoki from/to querysidan sana oralig'ini hisoblaydi */
export function rangeFromQuery(q: { from?: string; to?: string; month?: string }) {
  if (q.month) {
    const [y, m] = q.month.split('-').map(Number);
    return {
      from: new Date(Date.UTC(y, m - 1, 1)),
      to: new Date(Date.UTC(y, m + 1, 1)), // 2 oy oldinga zaxira bilan
    };
  }
  return {
    from: q.from ? new Date(q.from) : new Date(),
    to: q.to ? new Date(q.to) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  };
}

export default async function dachaPublicRoutes(app: FastifyInstance) {
  // --- Dachalar ro'yxati (filter, sort, pagination) ---
  app.get('/dachas', async (req) => {
    const result = await listPublicDachas(req.query as DachaListQuery);
    return { ...result, items: result.items.map((d) => dachaDTO(d)) };
  });

  // --- Bitta dacha (slug bo'yicha) ---
  app.get('/dachas/:slug', async (req) => {
    const { slug } = req.params as { slug: string };
    const dacha = await getPublicDachaBySlug(slug);
    return dachaDTO(dacha, { includeSeller: true });
  });

  // --- Bandlik kalendari ---
  app.get('/dachas/:id/availability', async (req) => {
    const { id } = req.params as { id: string };
    await assertDachaVisible(id);
    const { from, to } = rangeFromQuery(req.query as { from?: string; to?: string; month?: string });
    const busy = await getDachaBusyRanges(id, from, to);
    return { listingId: id, busy };
  });

  // --- Bron yaratish (ro'yxatsiz) ---
  app.post(
    '/dachas/:id/bookings',
    { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } },
    async (req) => {
      const { id } = req.params as { id: string };
      const data = dachaBookingInputSchema.parse(req.body);
      const booking = await createDachaBooking(id, data);
      const full = await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: bookingInclude,
      });
      return { booking: bookingDTO(full), payment: paymentInfo(booking.depositAmount) };
    },
  );
}
