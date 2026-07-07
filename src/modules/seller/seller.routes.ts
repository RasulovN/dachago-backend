import type { FastifyInstance } from 'fastify';
import { sellerSettingsSchema } from '@dacha/shared';
import { prisma } from '../../common/prisma.js';
import {
  bookingInclude,
  bookingDTO,
  bookingSellerWhere,
} from '../booking/booking.shared.js';

export default async function sellerRoutes(app: FastifyInstance) {
  // --- Dashboard statistikasi (3 modul bo'yicha) ---
  app.get('/dashboard', async (req) => {
    const sellerId = req.authUser!.id;
    const myBookings = bookingSellerWhere(sellerId);

    const [
      dachaCount,
      hotelCount,
      carCount,
      dachaActive,
      hotelActive,
      carActive,
      pendingBookings,
      confirmedBookings,
      dachaViews,
      hotelViews,
      carViews,
    ] = await Promise.all([
      prisma.dacha.count({ where: { sellerId } }),
      prisma.hotel.count({ where: { sellerId } }),
      prisma.car.count({ where: { sellerId } }),
      prisma.dacha.count({ where: { sellerId, status: 'ACTIVE' } }),
      prisma.hotel.count({ where: { sellerId, status: 'ACTIVE' } }),
      prisma.car.count({ where: { sellerId, status: 'ACTIVE' } }),
      prisma.booking.count({ where: { ...myBookings, status: 'PENDING' } }),
      prisma.booking.count({ where: { ...myBookings, status: 'CONFIRMED' } }),
      prisma.dacha.aggregate({ where: { sellerId }, _sum: { viewsCount: true } }),
      prisma.hotel.aggregate({ where: { sellerId }, _sum: { viewsCount: true } }),
      prisma.car.aggregate({ where: { sellerId }, _sum: { viewsCount: true } }),
    ]);

    const revenue = await prisma.booking.aggregate({
      where: { ...myBookings, status: { in: ['CONFIRMED', 'COMPLETED'] } },
      _sum: { totalPrice: true },
    });

    // Zaklad (deposit) hisob-kitobi
    const [depositCollected, depositPaidOut] = await Promise.all([
      prisma.booking.aggregate({
        where: { ...myBookings, depositAmount: { gt: 0 }, paymentStatus: 'PAID' },
        _sum: { depositAmount: true },
      }),
      prisma.booking.aggregate({
        where: { ...myBookings, depositAmount: { gt: 0 }, paymentStatus: 'PAID', sellerPaidOut: true },
        _sum: { depositAmount: true },
      }),
    ]);
    const collected = depositCollected._sum.depositAmount ?? 0;
    const paidOut = depositPaidOut._sum.depositAmount ?? 0;

    const recentBookings = await prisma.booking.findMany({
      where: myBookings,
      include: bookingInclude,
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    return {
      dachaCount,
      hotelCount,
      carCount,
      listingCount: dachaCount + hotelCount + carCount,
      activeCount: dachaActive + hotelActive + carActive,
      pendingBookings,
      confirmedBookings,
      totalViews:
        (dachaViews._sum.viewsCount ?? 0) +
        (hotelViews._sum.viewsCount ?? 0) +
        (carViews._sum.viewsCount ?? 0),
      totalRevenue: revenue._sum.totalPrice ?? 0,
      depositCollected: collected,
      depositPaidOut: paidOut,
      depositPending: collected - paidOut,
      recentBookings: recentBookings.map(bookingDTO),
    };
  });

  // --- Seller moliya (daromad + zaklad) ---
  app.get('/finance', async (req) => {
    const sellerId = req.authUser!.id;
    const myBookings = bookingSellerWhere(sellerId);

    const [revenue, depositAgg, paidOutAgg] = await Promise.all([
      prisma.booking.aggregate({
        where: { ...myBookings, status: { in: ['CONFIRMED', 'COMPLETED'] } },
        _sum: { totalPrice: true },
        _count: { _all: true },
      }),
      prisma.booking.aggregate({
        where: { ...myBookings, depositAmount: { gt: 0 }, paymentStatus: 'PAID' },
        _sum: { depositAmount: true },
      }),
      prisma.booking.aggregate({
        where: { ...myBookings, depositAmount: { gt: 0 }, paymentStatus: 'PAID', sellerPaidOut: true },
        _sum: { depositAmount: true },
      }),
    ]);

    const collected = depositAgg._sum.depositAmount ?? 0;
    const paidOut = paidOutAgg._sum.depositAmount ?? 0;

    // Zaklad to'lovli bronlar ro'yxati
    const depositBookings = await prisma.booking.findMany({
      where: { ...myBookings, depositAmount: { gt: 0 }, paymentStatus: 'PAID' },
      include: bookingInclude,
      orderBy: { createdAt: 'desc' },
    });

    return {
      totalRevenue: revenue._sum.totalPrice ?? 0,
      completedBookings: revenue._count._all,
      depositCollected: collected,
      depositReceived: paidOut, // admindan olingan
      depositPending: collected - paidOut, // admindan olinishi kerak
      bookings: depositBookings.map((b) => ({
        ...bookingDTO(b),
        sellerPaidOut: b.sellerPaidOut,
        paidOutAt: b.paidOutAt,
      })),
    };
  });

  // --- Sozlamalar ---
  app.patch('/settings', async (req) => {
    const data = sellerSettingsSchema.parse(req.body);
    await prisma.sellerProfile.update({
      where: { userId: req.authUser!.id },
      data: {
        ...(data.firstName ? { firstName: data.firstName } : {}),
        ...(data.lastName ? { lastName: data.lastName } : {}),
        ...(data.companyName !== undefined ? { companyName: data.companyName } : {}),
        ...(data.address ? { address: data.address } : {}),
      },
    });
    return { ok: true };
  });
}
