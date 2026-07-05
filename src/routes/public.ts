import type { FastifyInstance } from 'fastify';
import { bookingInputSchema } from '@dacha/shared';
import { prisma } from '../lib/prisma.js';
import { notFound, badRequest } from '../lib/errors.js';
import { dachaDTO, dachaInclude, zoneDTO, bookingDTO } from '../lib/mappers.js';
import {
  assertRangeAvailable,
  getBusyRanges,
  nightsBetween,
  calcDeposit,
} from '../services/availability.js';
import { bookingCode } from '../lib/slug.js';
import { BOOKING_PENDING_TTL_HOURS } from '@dacha/shared';

export default async function publicRoutes(app: FastifyInstance) {
  // --- Zonalar ---
  app.get('/zones', async () => {
    const zones = await prisma.zone.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: { _count: { select: { dachas: { where: { status: 'ACTIVE' } } } } },
    });
    return zones.map(zoneDTO);
  });

  app.get('/zones/:slug', async (req) => {
    const { slug } = req.params as { slug: string };
    const zone = await prisma.zone.findUnique({
      where: { slug },
      include: { _count: { select: { dachas: { where: { status: 'ACTIVE' } } } } },
    });
    if (!zone || !zone.isActive) throw notFound('Zona topilmadi');
    return zoneDTO(zone);
  });

  // --- Qulayliklar ro'yxati (filter uchun) ---
  app.get('/amenities', async () => {
    const items = await prisma.amenity.findMany({ orderBy: { order: 'asc' } });
    return items.map((a) => ({
      id: a.id,
      icon: a.icon,
      nameUz: a.nameUz,
      nameRu: a.nameRu,
      nameEn: a.nameEn,
    }));
  });

  // --- Dachalar ro'yxati (filter, sort, pagination) ---
  app.get('/dachas', async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(48, Math.max(1, Number(q.pageSize ?? 12)));

    const where: Record<string, unknown> = { status: 'ACTIVE' };
    if (q.zone) {
      const zone = await prisma.zone.findUnique({ where: { slug: q.zone } });
      if (zone) where.zoneId = zone.id;
    }
    if (q.zoneId) where.zoneId = q.zoneId;
    if (q.capacity) where.capacity = { gte: Number(q.capacity) };
    if (q.minPrice || q.maxPrice) {
      where.pricePerDay = {
        ...(q.minPrice ? { gte: Number(q.minPrice) } : {}),
        ...(q.maxPrice ? { lte: Number(q.maxPrice) } : {}),
      };
    }
    if (q.search) {
      const s = q.search;
      where.OR = [
        { titleUz: { contains: s, mode: 'insensitive' } },
        { titleRu: { contains: s, mode: 'insensitive' } },
        { titleEn: { contains: s, mode: 'insensitive' } },
        { address: { contains: s, mode: 'insensitive' } },
      ];
    }
    if (q.amenities) {
      const ids = q.amenities.split(',').filter(Boolean);
      if (ids.length) {
        where.amenities = { some: { amenityId: { in: ids } } };
      }
    }

    // Sort
    const orderBy: Record<string, string> =
      q.sort === 'price_asc'
        ? { pricePerDay: 'asc' }
        : q.sort === 'price_desc'
          ? { pricePerDay: 'desc' }
          : q.sort === 'popular'
            ? { viewsCount: 'desc' }
            : { createdAt: 'desc' };

    let [items, total] = await Promise.all([
      prisma.dacha.findMany({
        where,
        include: dachaInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.dacha.count({ where }),
    ]);

    // Sana bo'yicha bo'shlik filtri (checkIn/checkOut berilsa)
    if (q.checkIn && q.checkOut) {
      const ci = new Date(q.checkIn);
      const co = new Date(q.checkOut);
      const available: typeof items = [];
      for (const d of items) {
        const busy = await getBusyRanges(d.id, ci, co);
        if (busy.length === 0) available.push(d);
      }
      items = available;
    }

    return {
      items: items.map((d) => dachaDTO(d)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  });

  // --- Bitta dacha (slug bo'yicha) ---
  app.get('/dachas/:slug', async (req) => {
    const { slug } = req.params as { slug: string };
    const dacha = await prisma.dacha.findUnique({ where: { slug }, include: dachaInclude });
    if (!dacha || dacha.status !== 'ACTIVE') throw notFound('Dacha topilmadi');

    // Ko'rishlar sonini oshiramiz (fon rejimda)
    prisma.dacha
      .update({ where: { id: dacha.id }, data: { viewsCount: { increment: 1 } } })
      .catch(() => {});

    return dachaDTO(dacha, { includeSeller: true });
  });

  // --- Bandlik kalendari ---
  app.get('/dachas/:id/availability', async (req) => {
    const { id } = req.params as { id: string };
    const q = req.query as { from?: string; to?: string; month?: string };

    let from: Date;
    let to: Date;
    if (q.month) {
      // month = "2026-07"
      const [y, m] = q.month.split('-').map(Number);
      from = new Date(Date.UTC(y, m - 1, 1));
      to = new Date(Date.UTC(y, m + 1, 1)); // 2 oy oldinga zaxira bilan
    } else {
      from = q.from ? new Date(q.from) : new Date();
      to = q.to ? new Date(q.to) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    }

    const busy = await getBusyRanges(id, from, to);
    return { dachaId: id, busy };
  });

  // --- Bron yaratish (ro'yxatsiz) ---
  app.post(
    '/bookings',
    { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } },
    async (req) => {
      const data = bookingInputSchema.parse(req.body);
      const checkIn = new Date(data.checkIn);
      const checkOut = new Date(data.checkOut);

      if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime()))
        throw badRequest('Sana formati noto\'g\'ri');
      if (checkOut <= checkIn) throw badRequest('Chiqish sanasi kirish sanasidan keyin bo\'lishi kerak');
      if (checkIn < new Date(Date.now() - 60 * 60 * 1000))
        throw badRequest('O\'tgan sanaga bron qilib bo\'lmaydi');

      const dacha = await prisma.dacha.findUnique({ where: { id: data.dachaId } });
      if (!dacha || dacha.status !== 'ACTIVE') throw notFound('Dacha topilmadi');
      if (data.guestsCount > dacha.capacity)
        throw badRequest(`Bu dacha maksimal ${dacha.capacity} kishiga mo'ljallangan`);

      const nights = nightsBetween(checkIn, checkOut);
      const totalPrice = nights * dacha.pricePerDay;
      const depositAmount = calcDeposit(
        totalPrice,
        dacha.depositEnabled,
        dacha.depositType,
        dacha.depositValue,
      );

      // Tranzaksiya ichida band emasligini tekshirib, bron yaratamiz (race conditionга qarshi)
      const booking = await prisma.$transaction(async (tx) => {
        await assertRangeAvailable(data.dachaId, checkIn, checkOut, tx);
        return tx.booking.create({
          data: {
            code: bookingCode(),
            dachaId: data.dachaId,
            guestName: `${data.guestFirstName} ${data.guestLastName}`,
            guestPhone: data.guestPhone,
            checkIn,
            checkOut,
            guestsCount: data.guestsCount,
            totalPrice,
            depositAmount,
            note: data.note || null,
            status: 'PENDING',
            paymentStatus: depositAmount ? 'AWAITING' : 'NOT_REQUIRED',
            expiresAt: new Date(Date.now() + BOOKING_PENDING_TTL_HOURS * 60 * 60 * 1000),
          },
        });
      });

      return {
        booking: bookingDTO(booking),
        payment: depositAmount
          ? {
              required: true,
              amount: depositAmount,
              // Frontend Payme checkout URL'ini shu ma'lumot bilan yasaydi
            }
          : { required: false },
      };
    },
  );

  // --- Bron holatini tekshirish (kod bilan) ---
  app.get('/bookings/:code', async (req) => {
    const { code } = req.params as { code: string };
    const booking = await prisma.booking.findUnique({
      where: { code },
      include: { dacha: { include: { images: { orderBy: { order: 'asc' }, take: 1 } } } },
    });
    if (!booking) throw notFound('Bron topilmadi');
    return bookingDTO(booking);
  });
}
