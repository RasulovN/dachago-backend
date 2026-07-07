import type { FastifyInstance } from 'fastify';
import { LISTING_TYPES } from '@dacha/shared';
import { prisma } from '../../common/prisma.js';
import { bookingInclude, bookingDTO } from './booking.shared.js';

export default async function bookingAdminRoutes(app: FastifyInstance) {
  // --- Barcha bronlar (tur va status bo'yicha filtr) ---
  app.get('/bookings', async (req) => {
    const q = req.query as { status?: string; type?: string };
    const type = q.type && (LISTING_TYPES as readonly string[]).includes(q.type) ? q.type : undefined;
    const bookings = await prisma.booking.findMany({
      where: {
        ...(q.status ? { status: q.status as never } : {}),
        ...(type ? { listingType: type as never } : {}),
      },
      include: bookingInclude,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return bookings.map(bookingDTO);
  });
}
