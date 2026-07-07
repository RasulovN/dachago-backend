import type { FastifyInstance } from 'fastify';
import { MAX_IMAGE_SIZE, ALLOWED_IMAGE_TYPES } from '@dacha/shared';
import { prisma } from '../../common/prisma.js';
import { notFound, badRequest } from '../../common/errors.js';
import { saveImage } from '../../common/storage.js';
import { bookingInclude, bookingDTO } from '../booking/booking.shared.js';
import { dachaInclude, dachaDTO } from '../dacha/dacha.mapper.js';
import { hotelInclude, hotelDTO } from '../hotel/hotel.mapper.js';
import { carInclude, carDTO } from '../car/car.mapper.js';

export default async function adminRoutes(app: FastifyInstance) {
  // --- Rasm yuklash (zona va boshqalar uchun umumiy) ---
  app.post('/upload', async (req) => {
    const part = await req.file({ limits: { fileSize: MAX_IMAGE_SIZE } });
    if (!part) throw badRequest('Rasm yuborilmadi');
    if (!ALLOWED_IMAGE_TYPES.includes(part.mimetype))
      throw badRequest(`Rasm formati qo'llab-quvvatlanmaydi: ${part.mimetype}`);
    const buffer = await part.toBuffer();
    if (buffer.length > MAX_IMAGE_SIZE)
      throw badRequest(`Rasm hajmi ${MAX_IMAGE_SIZE / 1024 / 1024}MB dan oshmasligi kerak`);
    const { url, thumbUrl } = await saveImage(buffer, 'zones');
    return { url, thumbUrl };
  });

  // --- Dashboard ---
  app.get('/dashboard', async () => {
    const countsOf = (model: 'dacha' | 'hotel' | 'car') =>
      Promise.all([
        (prisma[model] as never as { count: (a?: unknown) => Promise<number> }).count(),
        (prisma[model] as never as { count: (a: unknown) => Promise<number> }).count({ where: { status: 'ACTIVE' } }),
        (prisma[model] as never as { count: (a: unknown) => Promise<number> }).count({ where: { status: 'PENDING' } }),
      ]);

    const [
      sellersTotal,
      sellersPending,
      [dachasTotal, dachasActive, dachasPending],
      [hotelsTotal, hotelsActive, hotelsPending],
      [carsTotal, carsActive, carsPending],
      bookingsTotal,
      zonesTotal,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'SELLER' } }),
      prisma.user.count({ where: { role: 'SELLER', status: 'PENDING' } }),
      countsOf('dacha'),
      countsOf('hotel'),
      countsOf('car'),
      prisma.booking.count(),
      prisma.zone.count(),
    ]);

    const revenue = await prisma.booking.aggregate({
      where: { status: { in: ['CONFIRMED', 'COMPLETED'] } },
      _sum: { totalPrice: true },
    });

    const recentBookings = await prisma.booking.findMany({
      include: bookingInclude,
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    // --- Chart ma'lumotlari ---
    // 1) Bronlar status bo'yicha
    const statusGroups = await prisma.booking.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED'] as const;
    const bookingsByStatus = STATUSES.map((status) => ({
      status,
      count: statusGroups.find((g) => g.status === status)?._count._all ?? 0,
    }));

    // 2) So'nggi 14 kunlik bron trendi + daromadi
    const DAYS = 14;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (DAYS - 1));
    const trendBookings = await prisma.booking.findMany({
      where: { createdAt: { gte: from } },
      select: { createdAt: true, totalPrice: true, status: true },
    });
    const trendMap = new Map<string, { count: number; revenue: number }>();
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      trendMap.set(d.toISOString().slice(0, 10), { count: 0, revenue: 0 });
    }
    for (const b of trendBookings) {
      const key = b.createdAt.toISOString().slice(0, 10);
      const entry = trendMap.get(key);
      if (entry) {
        entry.count += 1;
        if (b.status === 'CONFIRMED' || b.status === 'COMPLETED') entry.revenue += b.totalPrice;
      }
    }
    const bookingsTrend = Array.from(trendMap.entries()).map(([date, v]) => ({
      date,
      count: v.count,
      revenue: v.revenue,
    }));

    // 3) Zonalar bo'yicha faol e'lonlar soni (3 modul yig'indisi)
    const zones = await prisma.zone.findMany({
      select: {
        nameUz: true,
        nameRu: true,
        nameEn: true,
        _count: {
          select: {
            dachas: { where: { status: 'ACTIVE' } },
            hotels: { where: { status: 'ACTIVE' } },
            cars: { where: { status: 'ACTIVE' } },
          },
        },
      },
      orderBy: { order: 'asc' },
    });
    const listingsByZone = zones
      .map((z) => ({
        nameUz: z.nameUz,
        nameRu: z.nameRu,
        nameEn: z.nameEn,
        count: z._count.dachas + z._count.hotels + z._count.cars,
      }))
      .sort((a, b) => b.count - a.count);

    // 4) E'lonlar turi bo'yicha
    const listingsByType = [
      { type: 'DACHA', count: dachasTotal },
      { type: 'HOTEL', count: hotelsTotal },
      { type: 'CAR', count: carsTotal },
    ];

    return {
      sellersTotal,
      sellersPending,
      dachasTotal,
      dachasActive,
      dachasPending,
      hotelsTotal,
      hotelsActive,
      hotelsPending,
      carsTotal,
      carsActive,
      carsPending,
      listingsTotal: dachasTotal + hotelsTotal + carsTotal,
      listingsActive: dachasActive + hotelsActive + carsActive,
      listingsPending: dachasPending + hotelsPending + carsPending,
      bookingsTotal,
      zonesTotal,
      totalRevenue: revenue._sum.totalPrice ?? 0,
      recentBookings: recentBookings.map(bookingDTO),
      charts: { bookingsByStatus, bookingsTrend, listingsByZone, listingsByType },
    };
  });

  // --- Sellerlar ---
  app.get('/sellers', async (req) => {
    const q = req.query as { status?: string };
    const sellers = await prisma.user.findMany({
      where: { role: 'SELLER', ...(q.status ? { status: q.status as never } : {}) },
      include: {
        sellerProfile: true,
        _count: { select: { dachas: true, hotels: true, cars: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return sellers.map((s) => ({
      id: s.id,
      phone: s.phone,
      email: s.email,
      status: s.status,
      createdAt: s.createdAt,
      listingCount: s._count.dachas + s._count.hotels + s._count.cars,
      dachaCount: s._count.dachas,
      hotelCount: s._count.hotels,
      carCount: s._count.cars,
      profile: s.sellerProfile,
    }));
  });

  app.get('/sellers/:id', async (req) => {
    const { id } = req.params as { id: string };
    const seller = await prisma.user.findUnique({
      where: { id },
      include: {
        sellerProfile: true,
        dachas: { include: dachaInclude },
        hotels: { include: hotelInclude },
        cars: { include: carInclude },
      },
    });
    if (!seller || seller.role !== 'SELLER') throw notFound('Seller topilmadi');
    return {
      id: seller.id,
      phone: seller.phone,
      email: seller.email,
      status: seller.status,
      createdAt: seller.createdAt,
      profile: seller.sellerProfile,
      dachas: seller.dachas.map((d) => dachaDTO(d)),
      hotels: seller.hotels.map((h) => hotelDTO(h)),
      cars: seller.cars.map((c) => carDTO(c)),
    };
  });

  // Seller holatini boshqarish (tasdiqlash / rad etish / bloklash / blokdan chiqarish)
  app.patch('/sellers/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { action: 'approve' | 'reject' | 'block' | 'unblock'; reason?: string };

    const seller = await prisma.user.findUnique({ where: { id } });
    if (!seller || seller.role !== 'SELLER') throw notFound('Seller topilmadi');

    let status = seller.status;
    if (body.action === 'approve') status = 'APPROVED';
    else if (body.action === 'reject') status = 'REJECTED';
    else if (body.action === 'block') status = 'BLOCKED';
    else if (body.action === 'unblock') status = 'APPROVED';
    else throw badRequest('Noto\'g\'ri amal');

    await prisma.user.update({ where: { id }, data: { status } });
    if (body.action === 'reject' && body.reason) {
      await prisma.sellerProfile.update({
        where: { userId: id },
        data: { rejectionReason: body.reason },
      });
    }
    // Bloklashda barcha sessiyalarni bekor qilamiz
    if (body.action === 'block') {
      await prisma.refreshToken.deleteMany({ where: { userId: id } });
    }
    return { ok: true, status };
  });
}
