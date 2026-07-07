import type { Prisma } from '@prisma/client';
import type { DachaInput, DachaUpdateInput, DachaBookingInput } from '@dacha/shared';
import { prisma } from '../../common/prisma.js';
import { notFound, badRequest, forbidden, conflict } from '../../common/errors.js';
import { uniqueSlug } from '../../common/slug.js';
import { deleteByUrl } from '../../common/storage.js';
import {
  overlapWhere,
  nightsBetween,
  calcDeposit,
  parseBookingDates,
  baseBookingData,
} from '../booking/booking.shared.js';
import { dachaRepository, visibleDachaWhere } from './dacha.repository.js';

/* ==================== Public: qidiruv/katalog ==================== */

export interface DachaListQuery {
  page?: string;
  pageSize?: string;
  zone?: string;
  zoneId?: string;
  capacity?: string;
  rooms?: string;
  minPrice?: string;
  maxPrice?: string;
  search?: string;
  amenities?: string;
  sort?: string;
  checkIn?: string;
  checkOut?: string;
}

export async function listPublicDachas(q: DachaListQuery) {
  const page = Math.max(1, Number(q.page ?? 1));
  const pageSize = Math.min(48, Math.max(1, Number(q.pageSize ?? 12)));

  const where: Prisma.DachaWhereInput = { ...visibleDachaWhere };
  if (q.zone) {
    const zone = await prisma.zone.findUnique({ where: { slug: q.zone } });
    if (zone) where.zoneId = zone.id;
  }
  if (q.zoneId) where.zoneId = q.zoneId;
  if (q.capacity) where.capacity = { gte: Number(q.capacity) };
  if (q.rooms) where.rooms = { gte: Number(q.rooms) };
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
    if (ids.length) where.amenities = { some: { amenityId: { in: ids } } };
  }

  const orderBy: Prisma.DachaOrderByWithRelationInput =
    q.sort === 'price_asc'
      ? { pricePerDay: 'asc' }
      : q.sort === 'price_desc'
        ? { pricePerDay: 'desc' }
        : q.sort === 'popular'
          ? { viewsCount: 'desc' }
          : { createdAt: 'desc' };

  let [items, total] = await Promise.all([
    dachaRepository.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    dachaRepository.count(where),
  ]);

  // Sana bo'yicha bo'shlik filtri (checkIn/checkOut berilsa)
  if (q.checkIn && q.checkOut) {
    const ci = new Date(q.checkIn);
    const co = new Date(q.checkOut);
    const availability = await Promise.all(
      items.map(async (d) => {
        const busy = await prisma.booking.count({ where: { dachaId: d.id, ...overlapWhere(ci, co) } });
        return busy === 0;
      }),
    );
    items = items.filter((_, i) => availability[i]);
  }

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getPublicDachaBySlug(slug: string) {
  const dacha = await dachaRepository.findBySlug(slug);
  if (!dacha || dacha.status !== 'ACTIVE' || dacha.seller.status !== 'APPROVED')
    throw notFound('Dacha topilmadi');

  // Ko'rishlar sonini oshiramiz (fon rejimda)
  dachaRepository.incrementViews(dacha.id).catch(() => {});
  return dacha;
}

/* ==================== Bandlik ==================== */

export async function getDachaBusyRanges(dachaId: string, from: Date, to: Date) {
  const bookings = await prisma.booking.findMany({
    where: { dachaId, ...overlapWhere(from, to) },
    select: { checkIn: true, checkOut: true },
    orderBy: { checkIn: 'asc' },
  });
  return bookings.map((b) => ({
    checkIn: b.checkIn.toISOString(),
    checkOut: b.checkOut.toISOString(),
  }));
}

export async function assertDachaVisible(id: string) {
  const dacha = await prisma.dacha.findUnique({
    where: { id },
    select: { status: true, seller: { select: { status: true } } },
  });
  if (!dacha || dacha.status !== 'ACTIVE' || dacha.seller.status !== 'APPROVED')
    throw notFound('Dacha topilmadi');
}

/* ==================== Bron yaratish ==================== */

export async function createDachaBooking(dachaId: string, input: DachaBookingInput) {
  const dates = parseBookingDates(input);

  const dacha = await prisma.dacha.findUnique({
    where: { id: dachaId },
    include: { seller: { select: { status: true } } },
  });
  if (!dacha || dacha.status !== 'ACTIVE' || dacha.seller.status !== 'APPROVED')
    throw notFound('Dacha topilmadi');
  if (input.guestsCount > dacha.capacity)
    throw badRequest(`Bu dacha maksimal ${dacha.capacity} kishiga mo'ljallangan`);

  const nights = nightsBetween(dates.checkIn, dates.checkOut);
  const totalPrice = nights * dacha.pricePerDay;
  const depositAmount = calcDeposit(
    totalPrice,
    dacha.depositEnabled,
    dacha.depositType,
    dacha.depositValue,
  );

  // Tranzaksiya ichida band emasligini tekshirib, bron yaratamiz (race condition'ga qarshi)
  return prisma.$transaction(async (tx) => {
    const overlapping = await tx.booking.count({
      where: { dachaId, ...overlapWhere(dates.checkIn, dates.checkOut) },
    });
    if (overlapping > 0)
      throw conflict('Tanlangan sana(lar) allaqachon band', { dachaId, ...dates });

    return tx.booking.create({
      data: {
        ...baseBookingData(input, dates, totalPrice, depositAmount),
        listingType: 'DACHA',
        dachaId,
      },
    });
  });
}

/* ==================== Seller CRUD ==================== */

export async function ownDachaOrThrow(dachaId: string, sellerId: string) {
  const dacha = await dachaRepository.findById(dachaId);
  if (!dacha) throw notFound('Dacha topilmadi');
  if (dacha.sellerId !== sellerId) throw forbidden('Bu dacha sizga tegishli emas');
  return dacha;
}

export async function createDacha(sellerId: string, data: DachaInput) {
  const zone = await prisma.zone.findUnique({ where: { id: data.zoneId } });
  if (!zone) throw badRequest('Zona topilmadi');

  const { amenityIds, ...fields } = data;
  return dachaRepository.create({
    ...fields,
    priceWeekend: data.priceWeekend ?? null,
    area: data.area ?? null,
    slug: uniqueSlug(data.titleUz),
    sellerId,
    status: 'PENDING', // super admin moderatsiyasini kutadi
    amenities: { create: amenityIds.map((amenityId) => ({ amenityId })) },
  });
}

export async function updateDacha(dachaId: string, sellerId: string, data: DachaUpdateInput) {
  await ownDachaOrThrow(dachaId, sellerId);
  const { amenityIds, ...rest } = data;

  return dachaRepository.update(dachaId, {
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
  });
}

export async function deleteDacha(dachaId: string, sellerId: string) {
  const dacha = await ownDachaOrThrow(dachaId, sellerId);
  // Media fayllarni tozalaymiz
  const media = await dachaRepository.mediaOf(dachaId);
  media?.images.forEach((i) => {
    deleteByUrl(i.url);
    deleteByUrl(i.thumbUrl);
  });
  media?.videos.forEach((v) => deleteByUrl(v.url));
  await dachaRepository.remove(dachaId);
  return dacha.id;
}

/* ==================== Admin moderatsiya ==================== */

export async function moderateDacha(id: string, action: 'approve' | 'reject' | 'archive', reason?: string) {
  const dacha = await dachaRepository.findById(id);
  if (!dacha) throw notFound('Dacha topilmadi');

  let status = dacha.status;
  if (action === 'approve') status = 'ACTIVE';
  else if (action === 'reject') status = 'REJECTED';
  else if (action === 'archive') status = 'ARCHIVED';
  else throw badRequest('Noto\'g\'ri amal');

  return dachaRepository.update(id, {
    status,
    ...(action === 'reject' ? { rejectionReason: reason ?? null } : {}),
  });
}
