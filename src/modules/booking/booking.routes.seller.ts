import type { FastifyInstance } from 'fastify';
import { LISTING_TYPES } from '@dacha/shared';
import { prisma } from '../../common/prisma.js';
import { bookingInclude, bookingDTO, bookingSellerWhere } from './booking.shared.js';
import { applySellerBookingAction, type BookingAction } from './booking.service.js';

export default async function bookingSellerRoutes(app: FastifyInstance) {
  // --- Sellerning bronlari (modul bo'yicha filtrlash mumkin) ---
  app.get('/bookings', async (req) => {
    const sellerId = req.authUser!.id;
    const q = req.query as { status?: string; type?: string; listingId?: string };
    const type = q.type && (LISTING_TYPES as readonly string[]).includes(q.type) ? q.type : undefined;

    const bookings = await prisma.booking.findMany({
      where: {
        ...bookingSellerWhere(sellerId),
        ...(type ? { listingType: type as never } : {}),
        ...(q.status ? { status: q.status as never } : {}),
        // Muayyan e'lon bo'yicha filtr (kalendar/detal ko'rinishlari uchun)
        ...(q.listingId
          ? { OR: [{ dachaId: q.listingId }, { hotelRoom: { hotelId: q.listingId } }, { carId: q.listingId }] }
          : {}),
      },
      include: bookingInclude,
      orderBy: { createdAt: 'desc' },
    });
    return bookings.map(bookingDTO);
  });

  // --- Bronni tasdiqlash / bekor qilish / yakunlash ---
  app.patch('/bookings/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { action: BookingAction };
    const updated = await applySellerBookingAction(id, req.authUser!.id, body.action);
    return bookingDTO(updated);
  });
}
