import type { FastifyInstance } from 'fastify';
import { zoneInputSchema, amenityInputSchema } from '@dacha/shared';
import { MAX_IMAGE_SIZE, ALLOWED_IMAGE_TYPES } from '@dacha/shared';
import { prisma } from '../lib/prisma.js';
import { notFound, badRequest } from '../lib/errors.js';
import { dachaDTO, dachaInclude, zoneDTO, bookingDTO } from '../lib/mappers.js';
import { saveImage } from '../lib/storage.js';

export default async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', app.requireRole('SUPER_ADMIN'));

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
    const [
      sellersTotal,
      sellersPending,
      dachasTotal,
      dachasActive,
      dachasPending,
      bookingsTotal,
      zonesTotal,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'SELLER' } }),
      prisma.user.count({ where: { role: 'SELLER', status: 'PENDING' } }),
      prisma.dacha.count(),
      prisma.dacha.count({ where: { status: 'ACTIVE' } }),
      prisma.dacha.count({ where: { status: 'PENDING' } }),
      prisma.booking.count(),
      prisma.zone.count(),
    ]);

    const revenue = await prisma.booking.aggregate({
      where: { status: { in: ['CONFIRMED', 'COMPLETED'] } },
      _sum: { totalPrice: true },
    });

    const recentBookings = await prisma.booking.findMany({
      include: { dacha: { include: { images: { orderBy: { order: 'asc' }, take: 1 } } } },
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

    // 3) Zonalar bo'yicha faol dachalar soni
    const zones = await prisma.zone.findMany({
      select: {
        nameUz: true,
        nameRu: true,
        nameEn: true,
        _count: { select: { dachas: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { order: 'asc' },
    });
    const dachasByZone = zones
      .map((z) => ({ nameUz: z.nameUz, nameRu: z.nameRu, nameEn: z.nameEn, count: z._count.dachas }))
      .sort((a, b) => b.count - a.count);

    return {
      sellersTotal,
      sellersPending,
      dachasTotal,
      dachasActive,
      dachasPending,
      bookingsTotal,
      zonesTotal,
      totalRevenue: revenue._sum.totalPrice ?? 0,
      recentBookings: recentBookings.map(bookingDTO),
      charts: { bookingsByStatus, bookingsTrend, dachasByZone },
    };
  });

  // --- Sellerlar ---
  app.get('/sellers', async (req) => {
    const q = req.query as { status?: string };
    const sellers = await prisma.user.findMany({
      where: { role: 'SELLER', ...(q.status ? { status: q.status as never } : {}) },
      include: { sellerProfile: true, _count: { select: { dachas: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return sellers.map((s) => ({
      id: s.id,
      phone: s.phone,
      email: s.email,
      status: s.status,
      createdAt: s.createdAt,
      dachaCount: s._count.dachas,
      profile: s.sellerProfile,
    }));
  });

  app.get('/sellers/:id', async (req) => {
    const { id } = req.params as { id: string };
    const seller = await prisma.user.findUnique({
      where: { id },
      include: { sellerProfile: true, dachas: { include: dachaInclude } },
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

  // --- Zonalar CRUD ---
  app.get('/zones', async () => {
    const zones = await prisma.zone.findMany({
      orderBy: { order: 'asc' },
      include: { _count: { select: { dachas: true } } },
    });
    return zones.map(zoneDTO);
  });

  app.post('/zones', async (req) => {
    const data = zoneInputSchema.parse(req.body);
    const zone = await prisma.zone.create({ data });
    return zoneDTO(zone);
  });

  app.patch('/zones/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = zoneInputSchema.partial().parse(req.body);
    const zone = await prisma.zone.update({ where: { id }, data });
    return zoneDTO(zone);
  });

  app.delete('/zones/:id', async (req) => {
    const { id } = req.params as { id: string };
    const count = await prisma.dacha.count({ where: { zoneId: id } });
    if (count > 0) throw badRequest('Bu zonada dachalar mavjud, avval ularni ko\'chiring yoki o\'chiring');
    await prisma.zone.delete({ where: { id } });
    return { ok: true };
  });

  // --- Qulayliklar CRUD ---
  app.get('/amenities', async () => {
    const items = await prisma.amenity.findMany({ orderBy: { order: 'asc' } });
    return items;
  });

  app.post('/amenities', async (req) => {
    const data = amenityInputSchema.parse(req.body);
    const amenity = await prisma.amenity.create({ data });
    return amenity;
  });

  app.patch('/amenities/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = amenityInputSchema.partial().parse(req.body);
    const amenity = await prisma.amenity.update({ where: { id }, data });
    return amenity;
  });

  app.delete('/amenities/:id', async (req) => {
    const { id } = req.params as { id: string };
    await prisma.amenity.delete({ where: { id } });
    return { ok: true };
  });

  // --- Dachalar moderatsiyasi ---
  app.get('/dachas', async (req) => {
    const q = req.query as { status?: string };
    const dachas = await prisma.dacha.findMany({
      where: { ...(q.status ? { status: q.status as never } : {}) },
      include: dachaInclude,
      orderBy: { createdAt: 'desc' },
    });
    return dachas.map((d) => dachaDTO(d, { includeSeller: true }));
  });

  // Dacha tasdiqlash / rad etish / arxivlash
  app.patch('/dachas/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { action: 'approve' | 'reject' | 'archive'; reason?: string };

    const dacha = await prisma.dacha.findUnique({ where: { id } });
    if (!dacha) throw notFound('Dacha topilmadi');

    let status = dacha.status;
    if (body.action === 'approve') status = 'ACTIVE';
    else if (body.action === 'reject') status = 'REJECTED';
    else if (body.action === 'archive') status = 'ARCHIVED';
    else throw badRequest('Noto\'g\'ri amal');

    const updated = await prisma.dacha.update({
      where: { id },
      data: {
        status,
        ...(body.action === 'reject' ? { rejectionReason: body.reason ?? null } : {}),
      },
      include: dachaInclude,
    });
    return dachaDTO(updated, { includeSeller: true });
  });

  // --- Barcha bronlar ---
  app.get('/bookings', async (req) => {
    const q = req.query as { status?: string };
    const bookings = await prisma.booking.findMany({
      where: { ...(q.status ? { status: q.status as never } : {}) },
      include: { dacha: { include: { images: { orderBy: { order: 'asc' }, take: 1 } } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return bookings.map(bookingDTO);
  });

  // ==================== MOLIYA (zaklad to'lovlari) ====================

  // Zaklad to'langan bronlar (paymentStatus PAID) — sellerlar bo'yicha hisob-kitob
  const depositWhere = { depositAmount: { gt: 0 }, paymentStatus: 'PAID' as const };

  // --- Umumiy moliya hisoboti ---
  app.get('/finance', async () => {
    const paidBookings = await prisma.booking.findMany({
      where: depositWhere,
      include: {
        dacha: {
          include: { seller: { include: { sellerProfile: true } } },
        },
      },
    });

    let totalCollected = 0; // jami yig'ilgan zaklad
    let totalPaidOut = 0; // sellerlarga to'langan
    const perSeller = new Map<
      string,
      { sellerId: string; name: string; phone: string; collected: number; paidOut: number; count: number }
    >();

    for (const b of paidBookings) {
      const dep = b.depositAmount ?? 0;
      totalCollected += dep;
      if (b.sellerPaidOut) totalPaidOut += dep;

      const seller = b.dacha.seller;
      const key = seller.id;
      const entry =
        perSeller.get(key) ??
        {
          sellerId: seller.id,
          name: seller.sellerProfile
            ? `${seller.sellerProfile.firstName} ${seller.sellerProfile.lastName}`
            : seller.phone,
          phone: seller.phone,
          collected: 0,
          paidOut: 0,
          count: 0,
        };
      entry.collected += dep;
      if (b.sellerPaidOut) entry.paidOut += dep;
      entry.count += 1;
      perSeller.set(key, entry);
    }

    // Bronlardan umumiy daromad (tasdiqlangan+yakunlangan)
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
        ...(q.sellerId ? { dacha: { sellerId: q.sellerId } } : {}),
      },
      include: {
        dacha: {
          include: {
            images: { orderBy: { order: 'asc' }, take: 1 },
            seller: { include: { sellerProfile: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return bookings.map((b) => ({
      id: b.id,
      code: b.code,
      guestName: b.guestName,
      guestPhone: b.guestPhone,
      totalPrice: b.totalPrice,
      depositAmount: b.depositAmount,
      status: b.status,
      paymentStatus: b.paymentStatus,
      sellerPaidOut: b.sellerPaidOut,
      paidOutAt: b.paidOutAt,
      createdAt: b.createdAt,
      dachaTitle: b.dacha.titleUz,
      seller: {
        id: b.dacha.seller.id,
        name: b.dacha.seller.sellerProfile
          ? `${b.dacha.seller.sellerProfile.firstName} ${b.dacha.seller.sellerProfile.lastName}`
          : b.dacha.seller.phone,
        phone: b.dacha.seller.phone,
      },
    }));
  });

  // --- Sellerga zaklad to'lovini belgilash / bekor qilish ---
  app.patch('/bookings/:id/payout', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { paidOut: boolean };

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) throw notFound('Bron topilmadi');
    if (!booking.depositAmount || booking.paymentStatus !== 'PAID')
      throw badRequest('Bu bronda to\'langan zaklad yo\'q');

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        sellerPaidOut: body.paidOut,
        paidOutAt: body.paidOut ? new Date() : null,
      },
    });
    return { ok: true, sellerPaidOut: updated.sellerPaidOut, paidOutAt: updated.paidOutAt };
  });
}
