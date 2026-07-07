import type { Prisma } from '@prisma/client';
import type {
  HotelInput,
  HotelUpdateInput,
  HotelRoomInput,
  HotelRoomUpdateInput,
  HotelBookingInput,
} from '@dacha/shared';
import { prisma } from '../../common/prisma.js';
import { notFound, badRequest, forbidden, conflict } from '../../common/errors.js';
import { uniqueSlug } from '../../common/slug.js';
import { deleteByUrl } from '../../common/storage.js';
import {
  BLOCKING_STATUSES,
  overlapWhere,
  nightsBetween,
  calcDeposit,
  parseBookingDates,
  baseBookingData,
} from '../booking/booking.shared.js';
import { hotelRepository, visibleHotelWhere } from './hotel.repository.js';

/* ==================== Public: qidiruv/katalog ==================== */

export interface HotelListQuery {
  page?: string;
  pageSize?: string;
  zone?: string;
  zoneId?: string;
  stars?: string;
  breakfast?: string;
  conference?: string;
  capacity?: string;
  minPrice?: string;
  maxPrice?: string;
  search?: string;
  amenities?: string;
  sort?: string;
}

export async function listPublicHotels(q: HotelListQuery) {
  const page = Math.max(1, Number(q.page ?? 1));
  const pageSize = Math.min(48, Math.max(1, Number(q.pageSize ?? 12)));

  const where: Prisma.HotelWhereInput = { ...visibleHotelWhere };
  if (q.zone) {
    const zone = await prisma.zone.findUnique({ where: { slug: q.zone } });
    if (zone) where.zoneId = zone.id;
  }
  if (q.zoneId) where.zoneId = q.zoneId;
  if (q.stars) where.starRating = { gte: Number(q.stars) };
  if (q.breakfast === 'true') where.breakfastIncluded = true;
  if (q.conference === 'true') where.hasConference = true;
  // Sig'im va narx — xona darajasida tekshiriladi
  if (q.capacity) where.rooms = { some: { capacity: { gte: Number(q.capacity) } } };
  if (q.minPrice || q.maxPrice) {
    where.rooms = {
      some: {
        ...(q.capacity ? { capacity: { gte: Number(q.capacity) } } : {}),
        pricePerNight: {
          ...(q.minPrice ? { gte: Number(q.minPrice) } : {}),
          ...(q.maxPrice ? { lte: Number(q.maxPrice) } : {}),
        },
      },
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

  const orderBy: Prisma.HotelOrderByWithRelationInput =
    q.sort === 'price_asc'
      ? { priceFrom: 'asc' }
      : q.sort === 'price_desc'
        ? { priceFrom: 'desc' }
        : q.sort === 'stars'
          ? { starRating: 'desc' }
          : q.sort === 'popular'
            ? { viewsCount: 'desc' }
            : { createdAt: 'desc' };

  const [items, total] = await Promise.all([
    hotelRepository.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    hotelRepository.count(where),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getPublicHotelBySlug(slug: string) {
  const hotel = await hotelRepository.findBySlug(slug);
  if (!hotel || hotel.status !== 'ACTIVE' || hotel.seller.status !== 'APPROVED')
    throw notFound('Mehmonxona topilmadi');
  hotelRepository.incrementViews(hotel.id).catch(() => {});
  return hotel;
}

/* ==================== Xona bandligi ==================== */

async function getVisibleRoom(roomId: string) {
  const room = await prisma.hotelRoom.findUnique({
    where: { id: roomId },
    include: { hotel: { include: { seller: { select: { status: true } } } } },
  });
  if (!room || room.hotel.status !== 'ACTIVE' || room.hotel.seller.status !== 'APPROVED')
    throw notFound('Xona topilmadi');
  return room;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Xona uchun kun-bakun band xonalar sonini hisoblaydi.
 * Qaytaradi: so'ralgan oraliqda har kuni nechta xona band.
 */
async function roomUsageByDay(
  roomId: string,
  from: Date,
  to: Date,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<Map<number, number>> {
  const bookings = await tx.booking.findMany({
    where: {
      hotelRoomId: roomId,
      status: { in: [...BLOCKING_STATUSES] },
      checkIn: { lt: to },
      checkOut: { gt: from },
    },
    select: { checkIn: true, checkOut: true, roomsCount: true },
  });

  const usage = new Map<number, number>();
  for (const b of bookings) {
    const start = Math.max(b.checkIn.getTime(), from.getTime());
    const end = Math.min(b.checkOut.getTime(), to.getTime());
    for (let t = startOfDay(start); t < end; t += DAY_MS) {
      usage.set(t, (usage.get(t) ?? 0) + b.roomsCount);
    }
  }
  return usage;
}

function startOfDay(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/**
 * Xona bandlik kalendari: so'ralgan xonalar soni uchun to'liq band kunlar
 * oraliqlar ko'rinishida qaytariladi (frontend kalendari bilan mos).
 */
export async function getRoomBusyRanges(roomId: string, from: Date, to: Date, roomsRequested = 1) {
  const room = await getVisibleRoom(roomId);
  const usage = await roomUsageByDay(roomId, from, to);

  const busy: { checkIn: string; checkOut: string }[] = [];
  let rangeStart: number | null = null;
  for (let t = startOfDay(from.getTime()); t < to.getTime(); t += DAY_MS) {
    const used = usage.get(t) ?? 0;
    const full = room.totalRooms - used < roomsRequested;
    if (full && rangeStart === null) rangeStart = t;
    if (!full && rangeStart !== null) {
      busy.push({ checkIn: new Date(rangeStart).toISOString(), checkOut: new Date(t).toISOString() });
      rangeStart = null;
    }
  }
  if (rangeStart !== null) {
    busy.push({ checkIn: new Date(rangeStart).toISOString(), checkOut: new Date(to.getTime()).toISOString() });
  }
  return busy;
}

/* ==================== Bron yaratish ==================== */

export async function createHotelBooking(roomId: string, input: HotelBookingInput) {
  const dates = parseBookingDates(input);
  const room = await getVisibleRoom(roomId);

  const roomsCount = input.roomsCount ?? 1;
  if (roomsCount > room.totalRooms)
    throw badRequest(`Bu turdagi xonalar soni ${room.totalRooms} ta`);
  if (input.guestsCount > room.capacity * roomsCount)
    throw badRequest(`Tanlangan xonalar maksimal ${room.capacity * roomsCount} mehmonga mo'ljallangan`);

  const nights = nightsBetween(dates.checkIn, dates.checkOut);
  const totalPrice = nights * room.pricePerNight * roomsCount;
  const depositAmount = calcDeposit(
    totalPrice,
    room.hotel.depositEnabled,
    room.hotel.depositType,
    room.hotel.depositValue,
  );

  // Tranzaksiya ichida har kun uchun bo'sh xona yetarliligini tekshiramiz
  return prisma.$transaction(async (tx) => {
    const usage = await roomUsageByDay(roomId, dates.checkIn, dates.checkOut, tx);
    for (const used of usage.values()) {
      if (room.totalRooms - used < roomsCount)
        throw conflict('Tanlangan sanalarda yetarli bo\'sh xona yo\'q', { roomId, ...dates });
    }

    return tx.booking.create({
      data: {
        ...baseBookingData(input, dates, totalPrice, depositAmount),
        listingType: 'HOTEL',
        hotelRoomId: roomId,
        roomsCount,
      },
    });
  });
}

/* ==================== Seller CRUD ==================== */

export async function ownHotelOrThrow(hotelId: string, sellerId: string) {
  const hotel = await hotelRepository.findById(hotelId);
  if (!hotel) throw notFound('Mehmonxona topilmadi');
  if (hotel.sellerId !== sellerId) throw forbidden('Bu mehmonxona sizga tegishli emas');
  return hotel;
}

export async function createHotel(sellerId: string, data: HotelInput) {
  const zone = await prisma.zone.findUnique({ where: { id: data.zoneId } });
  if (!zone) throw badRequest('Zona topilmadi');

  const { amenityIds, ...fields } = data;
  return hotelRepository.create({
    ...fields,
    slug: uniqueSlug(data.titleUz),
    sellerId,
    status: 'PENDING',
    amenities: { create: amenityIds.map((amenityId) => ({ amenityId })) },
  });
}

export async function updateHotel(hotelId: string, sellerId: string, data: HotelUpdateInput) {
  await ownHotelOrThrow(hotelId, sellerId);
  const { amenityIds, ...rest } = data;

  return hotelRepository.update(hotelId, {
    ...rest,
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

export async function deleteHotel(hotelId: string, sellerId: string) {
  await ownHotelOrThrow(hotelId, sellerId);
  const [images, videos] = await Promise.all([
    hotelRepository.imagesOf(hotelId),
    hotelRepository.videosOf(hotelId),
  ]);
  images.forEach((i) => {
    deleteByUrl(i.url);
    deleteByUrl(i.thumbUrl);
  });
  videos.forEach((v) => deleteByUrl(v.url));
  await hotelRepository.remove(hotelId);
  return hotelId;
}

/* ==================== Xonalar CRUD (seller) ==================== */

export async function addRoom(hotelId: string, sellerId: string, data: HotelRoomInput) {
  await ownHotelOrThrow(hotelId, sellerId);
  const room = await hotelRepository.createRoom(hotelId, {
    ...data,
    priceWeekend: data.priceWeekend ?? null,
    area: data.area ?? null,
  });
  await hotelRepository.recalcPriceFrom(hotelId);
  return room;
}

export async function updateRoom(roomId: string, sellerId: string, data: HotelRoomUpdateInput) {
  const room = await hotelRepository.findRoom(roomId);
  if (!room) throw notFound('Xona topilmadi');
  if (room.hotel.sellerId !== sellerId) throw forbidden();
  const updated = await hotelRepository.updateRoom(roomId, data);
  await hotelRepository.recalcPriceFrom(room.hotelId);
  return updated;
}

export async function deleteRoom(roomId: string, sellerId: string) {
  const room = await hotelRepository.findRoom(roomId);
  if (!room) throw notFound('Xona topilmadi');
  if (room.hotel.sellerId !== sellerId) throw forbidden();

  // Aktiv bronli xonani o'chirishga yo'l qo'ymaymiz
  const active = await prisma.booking.count({
    where: { hotelRoomId: roomId, status: { in: [...BLOCKING_STATUSES] } },
  });
  if (active > 0) throw badRequest('Bu xonada aktiv bronlar bor, avval ularni yakunlang');

  await hotelRepository.removeRoom(roomId);
  await hotelRepository.recalcPriceFrom(room.hotelId);
  return roomId;
}

/* ==================== Admin moderatsiya ==================== */

export async function moderateHotel(id: string, action: 'approve' | 'reject' | 'archive', reason?: string) {
  const hotel = await hotelRepository.findById(id);
  if (!hotel) throw notFound('Mehmonxona topilmadi');

  let status = hotel.status;
  if (action === 'approve') status = 'ACTIVE';
  else if (action === 'reject') status = 'REJECTED';
  else if (action === 'archive') status = 'ARCHIVED';
  else throw badRequest('Noto\'g\'ri amal');

  return hotelRepository.update(id, {
    status,
    ...(action === 'reject' ? { rejectionReason: reason ?? null } : {}),
  });
}
