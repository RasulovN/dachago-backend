import type { FastifyInstance } from 'fastify';
import { prisma } from '../../common/prisma.js';
import { notFound } from '../../common/errors.js';
import { bookingInclude, bookingDTO } from './booking.shared.js';

export default async function bookingPublicRoutes(app: FastifyInstance) {
  // --- Bron holatini tekshirish (kod bilan) ---
  app.get('/bookings/:code', async (req) => {
    const { code } = req.params as { code: string };
    const booking = await prisma.booking.findUnique({
      where: { code },
      include: bookingInclude,
    });
    if (!booking) throw notFound('Bron topilmadi');
    return bookingDTO(booking);
  });
}
