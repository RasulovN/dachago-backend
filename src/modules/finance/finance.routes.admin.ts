import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../common/prisma.js';
import { notFound, badRequest } from '../../common/errors.js';
import { bookingSellerWhere } from '../booking/booking.shared.js';

/* Moliya uchun include: e'lon sarlavhasi + rasm + egasi (seller profili bilan) */
const firstImage = { orderBy: { order: 'asc' }, take: 1 } as const;
const sellerFull = { include: { sellerProfile: true } } as const;

const financeInclude = {
  dacha: { include: { images: firstImage, seller: sellerFull } },
  hotelRoom: { include: { hotel: { include: { images: firstImage, seller: sellerFull } } } },
  car: { include: { images: firstImage, seller: sellerFull } },
} satisfies Prisma.BookingInclude;

type FinanceBooking = Prisma.BookingGetPayload<{ include: typeof financeInclude }>;

function listingOf(b: FinanceBooking) {
  return b.dacha ?? b.hotelRoom?.hotel ?? b.car ?? null;
}

function ownerOf(b: FinanceBooking) {
  return listingOf(b)?.seller ?? null;
}

function ownerName(seller: { phone: string; sellerProfile: { firstName: string; lastName: string } | null }) {
  return seller.sellerProfile
    ? `${seller.sellerProfile.firstName} ${seller.sellerProfile.lastName}`
    : seller.phone;
}

export default async function financeAdminRoutes(app: FastifyInstance) {
  // Zaklad to'langan bronlar (paymentStatus PAID)
  const depositWhere = { depositAmount: { gt: 0 }, paymentStatus: 'PAID' as const };

  // --- Umumiy moliya hisoboti ---
  app.get('/finance', async () => {
    const paidBookings = await prisma.booking.findMany({
      where: depositWhere,
      include: financeInclude,
    });

    let totalCollected = 0;
    let totalPaidOut = 0;
    const perSeller = new Map<
      string,
      { sellerId: string; name: string; phone: string; collected: number; paidOut: number; count: number }
    >();

    for (const b of paidBookings) {
      const dep = b.depositAmount ?? 0;
      totalCollected += dep;
      if (b.sellerPaidOut) totalPaidOut += dep;

      const seller = ownerOf(b);
      if (!seller) continue;
      const entry =
        perSeller.get(seller.id) ??
        {
          sellerId: seller.id,
          name: ownerName(seller),
          phone: seller.phone,
          collected: 0,
          paidOut: 0,
          count: 0,
        };
      entry.collected += dep;
      if (b.sellerPaidOut) entry.paidOut += dep;
      entry.count += 1;
      perSeller.set(seller.id, entry);
    }

    const revenue = await prisma.booking.aggregate({
      where: { status: { in: ['CONFIRMED', 'COMPLETED'] } },
      _sum: { totalPrice: true },
    });

    return {
      totalRevenue: revenue._sum.totalPrice ?? 0,
      totalCollected,
      totalPaidOut,
      totalPending: totalCollected - totalPaidOut,
      sellers: Array.from(perSeller.values())
        .map((s) => ({ ...s, pending: s.collected - s.paidOut }))
        .sort((a, b) => b.pending - a.pending),
    };
  });

  // --- Zaklad to'lovli bronlar ro'yxati (filtr: payout holati) ---
  app.get('/finance/bookings', async (req) => {
    const q = req.query as { payout?: 'paid' | 'pending'; sellerId?: string };
    const bookings = await prisma.booking.findMany({
      where: {
        ...depositWhere,
        ...(q.payout === 'paid' ? { sellerPaidOut: true } : {}),
        ...(q.payout === 'pending' ? { sellerPaidOut: false } : {}),
        ...(q.sellerId ? bookingSellerWhere(q.sellerId) : {}),
      },
      include: financeInclude,
      orderBy: { createdAt: 'desc' },
    });

    return bookings.map((b) => {
      const listing = listingOf(b);
      const seller = ownerOf(b);
      return {
        id: b.id,
        code: b.code,
        listingType: b.listingType,
        guestName: b.guestName,
        guestPhone: b.guestPhone,
        totalPrice: b.totalPrice,
        depositAmount: b.depositAmount,
        status: b.status,
        paymentStatus: b.paymentStatus,
        sellerPaidOut: b.sellerPaidOut,
        paidOutAt: b.paidOutAt,
        createdAt: b.createdAt,
        listingTitle: listing?.titleUz ?? '',
        seller: seller
          ? { id: seller.id, name: ownerName(seller), phone: seller.phone }
          : null,
      };
    });
  });

  /* ============ PAYOUT (sellerga zaklad o'tkazish) ============ */

  const payoutDTO = (p: {
    id: string;
    amount: number;
    note: string;
    createdAt: Date;
    seller: { id: string; phone: string; sellerProfile: { firstName: string; lastName: string } | null };
    bookings: { id: string; code: string; depositAmount: number | null; guestName: string }[];
  }) => ({
    id: p.id,
    amount: p.amount,
    note: p.note,
    createdAt: p.createdAt,
    seller: {
      id: p.seller.id,
      name: ownerName(p.seller),
      phone: p.seller.phone,
    },
    bookings: p.bookings.map((b) => ({
      id: b.id,
      code: b.code,
      guestName: b.guestName,
      depositAmount: b.depositAmount ?? 0,
    })),
  });

  const payoutInclude = {
    seller: { include: { sellerProfile: true } },
    bookings: true,
  } as const;

  // --- To'lovlar tarixi ---
  app.get('/payouts', async (req) => {
    const q = req.query as { sellerId?: string };
    const payouts = await prisma.payout.findMany({
      where: q.sellerId ? { sellerId: q.sellerId } : {},
      include: payoutInclude,
      orderBy: { createdAt: 'desc' },
    });
    return payouts.map(payoutDTO);
  });

  // --- To'lov yaratish: tanlangan bronlar zakladini bitta hujjatga birlashtiradi ---
  app.post('/payouts', async (req) => {
    const body = req.body as { sellerId: string; bookingIds: string[]; note?: string };
    if (!body.sellerId) throw badRequest('Seller tanlanmagan');
    if (!Array.isArray(body.bookingIds) || body.bookingIds.length === 0)
      throw badRequest('Kamida bitta bron tanlanishi kerak');

    const payout = await prisma.$transaction(async (tx) => {
      const bookings = await tx.booking.findMany({
        where: { id: { in: body.bookingIds } },
        include: financeInclude,
      });

      if (bookings.length !== body.bookingIds.length)
        throw badRequest('Ba\'zi bronlar topilmadi');
      for (const b of bookings) {
        if (ownerOf(b)?.id !== body.sellerId)
          throw badRequest(`${b.code} broni bu sellerga tegishli emas`);
        if (!b.depositAmount || b.paymentStatus !== 'PAID')
          throw badRequest(`${b.code} bronida to'langan zaklad yo'q`);
        if (b.sellerPaidOut)
          throw badRequest(`${b.code} broni bo'yicha to'lov allaqachon qilingan`);
      }

      const amount = bookings.reduce((sum, b) => sum + (b.depositAmount ?? 0), 0);
      const created = await tx.payout.create({
        data: {
          sellerId: body.sellerId,
          amount,
          note: body.note?.trim() ?? '',
        },
      });
      await tx.booking.updateMany({
        where: { id: { in: body.bookingIds } },
        data: { sellerPaidOut: true, paidOutAt: new Date(), payoutId: created.id },
      });

      return tx.payout.findUniqueOrThrow({ where: { id: created.id }, include: payoutInclude });
    });

    return payoutDTO(payout);
  });

  // --- To'lovni bekor qilish: bronlar yana "to'lanmagan" holatga qaytadi ---
  app.delete('/payouts/:id', async (req) => {
    const { id } = req.params as { id: string };
    await prisma.$transaction(async (tx) => {
      const payout = await tx.payout.findUnique({ where: { id } });
      if (!payout) throw notFound('To\'lov topilmadi');
      await tx.booking.updateMany({
        where: { payoutId: id },
        data: { sellerPaidOut: false, paidOutAt: null, payoutId: null },
      });
      await tx.payout.delete({ where: { id } });
    });
    return { ok: true };
  });

  // --- Bitta bron bo'yicha tezkor to'lov / bekor qilish (payout hujjati bilan) ---
  app.patch('/bookings/:id/payout', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { paidOut: boolean };

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: financeInclude,
    });
    if (!booking) throw notFound('Bron topilmadi');
    if (!booking.depositAmount || booking.paymentStatus !== 'PAID')
      throw badRequest('Bu bronda to\'langan zaklad yo\'q');

    const owner = ownerOf(booking);
    if (!owner) throw badRequest('Bron egasi topilmadi');

    if (body.paidOut) {
      // To'lov yaratish (bitta bronlik hujjat)
      if (booking.sellerPaidOut) throw badRequest('Bu bron bo\'yicha to\'lov allaqachon qilingan');
      await prisma.$transaction(async (tx) => {
        const created = await tx.payout.create({
          data: { sellerId: owner.id, amount: booking.depositAmount ?? 0, note: '' },
        });
        await tx.booking.update({
          where: { id },
          data: { sellerPaidOut: true, paidOutAt: new Date(), payoutId: created.id },
        });
      });
    } else {
      // Bekor qilish: bron payout hujjatidan chiqariladi, summa qayta hisoblanadi
      await prisma.$transaction(async (tx) => {
        const payoutId = booking.payoutId;
        await tx.booking.update({
          where: { id },
          data: { sellerPaidOut: false, paidOutAt: null, payoutId: null },
        });
        if (payoutId) {
          const remaining = await tx.booking.aggregate({
            where: { payoutId },
            _sum: { depositAmount: true },
            _count: { _all: true },
          });
          if (remaining._count._all === 0) {
            await tx.payout.delete({ where: { id: payoutId } });
          } else {
            await tx.payout.update({
              where: { id: payoutId },
              data: { amount: remaining._sum.depositAmount ?? 0 },
            });
          }
        }
      });
    }

    const updated = await prisma.booking.findUniqueOrThrow({ where: { id } });
    return { ok: true, sellerPaidOut: updated.sellerPaidOut, paidOutAt: updated.paidOutAt };
  });
}
