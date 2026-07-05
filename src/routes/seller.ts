import type { FastifyInstance } from 'fastify';
import { dachaInputSchema, sellerSettingsSchema } from '@dacha/shared';
import {
  MAX_IMAGES_PER_DACHA,
  MAX_IMAGE_SIZE,
  MAX_VIDEOS_PER_DACHA,
  MAX_VIDEO_SIZE,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
} from '@dacha/shared';
import { prisma } from '../lib/prisma.js';
import { notFound, badRequest, forbidden } from '../lib/errors.js';
import { dachaDTO, dachaInclude, bookingDTO } from '../lib/mappers.js';
import { uniqueSlug } from '../lib/slug.js';
import { saveImage, saveVideoStream, deleteByUrl } from '../lib/storage.js';

export default async function sellerRoutes(app: FastifyInstance) {
  // Barcha seller yo'llari auth + SELLER roli talab qiladi
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', app.requireRole('SELLER'));

  async function ownDachaOrThrow(dachaId: string, sellerId: string) {
    const dacha = await prisma.dacha.findUnique({ where: { id: dachaId } });
    if (!dacha) throw notFound('Dacha topilmadi');
    if (dacha.sellerId !== sellerId) throw forbidden('Bu dacha sizga tegishli emas');
    return dacha;
  }

  // --- Dashboard statistikasi ---
  app.get('/dashboard', async (req) => {
    const sellerId = req.authUser!.id;
    const [dachaCount, activeCount, pendingBookings, confirmedBookings, dachas] = await Promise.all([
      prisma.dacha.count({ where: { sellerId } }),
      prisma.dacha.count({ where: { sellerId, status: 'ACTIVE' } }),
      prisma.booking.count({ where: { dacha: { sellerId }, status: 'PENDING' } }),
      prisma.booking.count({ where: { dacha: { sellerId }, status: 'CONFIRMED' } }),
      prisma.dacha.findMany({ where: { sellerId }, select: { viewsCount: true } }),
    ]);

    const revenue = await prisma.booking.aggregate({
      where: { dacha: { sellerId }, status: { in: ['CONFIRMED', 'COMPLETED'] } },
      _sum: { totalPrice: true },
    });

    // Zaklad (deposit) hisob-kitobi
    const [depositCollected, depositPaidOut] = await Promise.all([
      prisma.booking.aggregate({
        where: { dacha: { sellerId }, depositAmount: { gt: 0 }, paymentStatus: 'PAID' },
        _sum: { depositAmount: true },
      }),
      prisma.booking.aggregate({
        where: { dacha: { sellerId }, depositAmount: { gt: 0 }, paymentStatus: 'PAID', sellerPaidOut: true },
        _sum: { depositAmount: true },
      }),
    ]);
    const collected = depositCollected._sum.depositAmount ?? 0;
    const paidOut = depositPaidOut._sum.depositAmount ?? 0;

    const recentBookings = await prisma.booking.findMany({
      where: { dacha: { sellerId } },
      include: { dacha: { include: { images: { orderBy: { order: 'asc' }, take: 1 } } } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    return {
      dachaCount,
      activeCount,
      pendingBookings,
      confirmedBookings,
      totalViews: dachas.reduce((s, d) => s + d.viewsCount, 0),
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

    const [revenue, depositAgg, paidOutAgg] = await Promise.all([
      prisma.booking.aggregate({
        where: { dacha: { sellerId }, status: { in: ['CONFIRMED', 'COMPLETED'] } },
        _sum: { totalPrice: true },
        _count: { _all: true },
      }),
      prisma.booking.aggregate({
        where: { dacha: { sellerId }, depositAmount: { gt: 0 }, paymentStatus: 'PAID' },
        _sum: { depositAmount: true },
      }),
      prisma.booking.aggregate({
        where: { dacha: { sellerId }, depositAmount: { gt: 0 }, paymentStatus: 'PAID', sellerPaidOut: true },
        _sum: { depositAmount: true },
      }),
    ]);

    const collected = depositAgg._sum.depositAmount ?? 0;
    const paidOut = paidOutAgg._sum.depositAmount ?? 0;

    // Zaklad to'lovli bronlar ro'yxati
    const depositBookings = await prisma.booking.findMany({
      where: { dacha: { sellerId }, depositAmount: { gt: 0 }, paymentStatus: 'PAID' },
      include: { dacha: { include: { images: { orderBy: { order: 'asc' }, take: 1 } } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      totalRevenue: revenue._sum.totalPrice ?? 0,
      completedBookings: revenue._count._all,
      depositCollected: collected,
      depositReceived: paidOut, // admindan olingan
      depositPending: collected - paidOut, // admindan olinishi kerak
      bookings: depositBookings.map((b) => ({
        id: b.id,
        code: b.code,
        guestName: b.guestName,
        totalPrice: b.totalPrice,
        depositAmount: b.depositAmount,
        status: b.status,
        sellerPaidOut: b.sellerPaidOut,
        paidOutAt: b.paidOutAt,
        createdAt: b.createdAt,
        dachaTitle: b.dacha.titleUz,
        image: b.dacha.images[0]?.thumbUrl ?? null,
      })),
    };
  });

  // --- Mening dachalarim ---
  app.get('/dachas', async (req) => {
    const sellerId = req.authUser!.id;
    const dachas = await prisma.dacha.findMany({
      where: { sellerId },
      include: dachaInclude,
      orderBy: { createdAt: 'desc' },
    });
    return dachas.map((d) => dachaDTO(d));
  });

  app.get('/dachas/:id', async (req) => {
    const { id } = req.params as { id: string };
    await ownDachaOrThrow(id, req.authUser!.id);
    const dacha = await prisma.dacha.findUnique({ where: { id }, include: dachaInclude });
    return dachaDTO(dacha!);
  });

  // --- Dacha yaratish ---
  app.post('/dachas', async (req) => {
    const sellerId = req.authUser!.id;
    const data = dachaInputSchema.parse(req.body);

    const zone = await prisma.zone.findUnique({ where: { id: data.zoneId } });
    if (!zone) throw badRequest('Zona topilmadi');

    const dacha = await prisma.dacha.create({
      data: {
        slug: uniqueSlug(data.titleUz),
        sellerId,
        zoneId: data.zoneId,
        titleUz: data.titleUz,
        titleRu: data.titleRu,
        titleEn: data.titleEn,
        descUz: data.descUz,
        descRu: data.descRu,
        descEn: data.descEn,
        pricePerDay: data.pricePerDay,
        priceWeekend: data.priceWeekend ?? null,
        capacity: data.capacity,
        rooms: data.rooms,
        area: data.area ?? null,
        lat: data.lat,
        lng: data.lng,
        address: data.address,
        checkInTime: data.checkInTime,
        checkOutTime: data.checkOutTime,
        depositEnabled: data.depositEnabled,
        depositType: data.depositType,
        depositValue: data.depositValue,
        status: 'PENDING', // super admin moderatsiyasini kutadi
        amenities: {
          create: data.amenityIds.map((amenityId) => ({ amenityId })),
        },
      },
      include: dachaInclude,
    });
    return dachaDTO(dacha);
  });

  // --- Dacha tahrirlash ---
  app.patch('/dachas/:id', async (req) => {
    const { id } = req.params as { id: string };
    await ownDachaOrThrow(id, req.authUser!.id);
    const data = dachaInputSchema.partial().parse(req.body);

    const { amenityIds, ...rest } = data;

    const dacha = await prisma.dacha.update({
      where: { id },
      data: {
        ...rest,
        // Tahrirdan keyin qayta moderatsiyaga yuboramiz
        status: 'PENDING',
        ...(amenityIds
          ? {
              amenities: {
                deleteMany: {},
                create: amenityIds.map((amenityId) => ({ amenityId })),
              },
            }
          : {}),
      },
      include: dachaInclude,
    });
    return dachaDTO(dacha);
  });

  // --- Dacha o'chirish ---
  app.delete('/dachas/:id', async (req) => {
    const { id } = req.params as { id: string };
    const dacha = await ownDachaOrThrow(id, req.authUser!.id);
    // Media fayllarni tozalaymiz
    const media = await prisma.dacha.findUnique({
      where: { id },
      include: { images: true, videos: true },
    });
    media?.images.forEach((i) => {
      deleteByUrl(i.url);
      deleteByUrl(i.thumbUrl);
    });
    media?.videos.forEach((v) => deleteByUrl(v.url));
    await prisma.dacha.delete({ where: { id } });
    return { ok: true, deleted: dacha.id };
  });

  // --- Rasm yuklash (multipart, ko'p fayl) ---
  app.post('/dachas/:id/images', async (req) => {
    const { id } = req.params as { id: string };
    await ownDachaOrThrow(id, req.authUser!.id);

    const currentCount = await prisma.dachaImage.count({ where: { dachaId: id } });
    const parts = req.files({ limits: { fileSize: MAX_IMAGE_SIZE } });

    const created: { id: string; url: string; thumbUrl: string; order: number }[] = [];
    let order = currentCount;

    for await (const part of parts) {
      if (order >= MAX_IMAGES_PER_DACHA)
        throw badRequest(`Maksimal ${MAX_IMAGES_PER_DACHA} ta rasm yuklash mumkin`);
      if (!ALLOWED_IMAGE_TYPES.includes(part.mimetype))
        throw badRequest(`Rasm formati qo'llab-quvvatlanmaydi: ${part.mimetype}`);

      const buffer = await part.toBuffer();
      const { url, thumbUrl } = await saveImage(buffer, 'images');
      const img = await prisma.dachaImage.create({
        data: { dachaId: id, url, thumbUrl, order },
      });
      created.push({ id: img.id, url, thumbUrl, order });
      order++;
    }

    if (created.length === 0) throw badRequest('Rasm yuborilmadi');
    return { images: created };
  });

  // --- Video yuklash (stream, 200MB limit) ---
  app.post('/dachas/:id/videos', async (req) => {
    const { id } = req.params as { id: string };
    await ownDachaOrThrow(id, req.authUser!.id);

    const currentCount = await prisma.dachaVideo.count({ where: { dachaId: id } });
    if (currentCount >= MAX_VIDEOS_PER_DACHA)
      throw badRequest(`Maksimal ${MAX_VIDEOS_PER_DACHA} ta video yuklash mumkin`);

    const part = await req.file({ limits: { fileSize: MAX_VIDEO_SIZE } });
    if (!part) throw badRequest('Video yuborilmadi');
    if (!ALLOWED_VIDEO_TYPES.includes(part.mimetype))
      throw badRequest(`Video formati qo'llab-quvvatlanmaydi: ${part.mimetype}`);

    const { url, size } = await saveVideoStream(part.file, part.filename);

    // Stream tugagach fayl limitdan oshgan bo'lsa multipart truncated bo'ladi
    if (part.file.truncated) {
      deleteByUrl(url);
      throw badRequest(`Video hajmi ${MAX_VIDEO_SIZE / 1024 / 1024}MB dan oshmasligi kerak`);
    }

    const video = await prisma.dachaVideo.create({
      data: { dachaId: id, url, size, order: currentCount },
    });
    return { video: { id: video.id, url: video.url, size: video.size } };
  });

  // --- Media o'chirish ---
  app.delete('/images/:imageId', async (req) => {
    const { imageId } = req.params as { imageId: string };
    const img = await prisma.dachaImage.findUnique({ where: { id: imageId }, include: { dacha: true } });
    if (!img) throw notFound('Rasm topilmadi');
    if (img.dacha.sellerId !== req.authUser!.id) throw forbidden();
    deleteByUrl(img.url);
    deleteByUrl(img.thumbUrl);
    await prisma.dachaImage.delete({ where: { id: imageId } });
    return { ok: true };
  });

  app.delete('/videos/:videoId', async (req) => {
    const { videoId } = req.params as { videoId: string };
    const vid = await prisma.dachaVideo.findUnique({ where: { id: videoId }, include: { dacha: true } });
    if (!vid) throw notFound('Video topilmadi');
    if (vid.dacha.sellerId !== req.authUser!.id) throw forbidden();
    deleteByUrl(vid.url);
    await prisma.dachaVideo.delete({ where: { id: videoId } });
    return { ok: true };
  });

  // --- Bronlar ---
  app.get('/bookings', async (req) => {
    const sellerId = req.authUser!.id;
    const q = req.query as { status?: string; dachaId?: string };
    const bookings = await prisma.booking.findMany({
      where: {
        dacha: { sellerId },
        ...(q.status ? { status: q.status as never } : {}),
        ...(q.dachaId ? { dachaId: q.dachaId } : {}),
      },
      include: { dacha: { include: { images: { orderBy: { order: 'asc' }, take: 1 } } } },
      orderBy: { createdAt: 'desc' },
    });
    return bookings.map(bookingDTO);
  });

  // Bronni tasdiqlash / bekor qilish / yakunlash
  app.patch('/bookings/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { action: 'confirm' | 'cancel' | 'complete' };
    const sellerId = req.authUser!.id;

    const booking = await prisma.booking.findUnique({ where: { id }, include: { dacha: true } });
    if (!booking) throw notFound('Bron topilmadi');
    if (booking.dacha.sellerId !== sellerId) throw forbidden();

    let status = booking.status;
    if (body.action === 'confirm') {
      if (booking.status !== 'PENDING') throw badRequest('Faqat kutilayotgan bronni tasdiqlash mumkin');
      status = 'CONFIRMED';
    } else if (body.action === 'cancel') {
      if (['COMPLETED', 'CANCELLED'].includes(booking.status))
        throw badRequest('Bu bronni bekor qilib bo\'lmaydi');
      status = 'CANCELLED';
    } else if (body.action === 'complete') {
      if (booking.status !== 'CONFIRMED') throw badRequest('Faqat tasdiqlangan bronni yakunlash mumkin');
      status = 'COMPLETED';
    } else {
      throw badRequest('Noto\'g\'ri amal');
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        status,
        // Tasdiqlangach muddat cheklovini olib tashlaymiz
        ...(status === 'CONFIRMED' ? { expiresAt: null } : {}),
      },
      include: { dacha: { include: { images: { orderBy: { order: 'asc' }, take: 1 } } } },
    });
    return bookingDTO(updated);
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
