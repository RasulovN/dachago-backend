import type { Prisma } from '@prisma/client';
import type { CarInput, CarUpdateInput, CarBookingInput } from '@dacha/shared';
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
import { carRepository, visibleCarWhere } from './car.repository.js';

/* ==================== Public: qidiruv/katalog ==================== */

export interface CarListQuery {
  page?: string;
  pageSize?: string;
  zone?: string;
  zoneId?: string;
  brand?: string;
  transmission?: string;
  fuelType?: string;
  seats?: string;
  minYear?: string;
  maxYear?: string;
  driver?: string;
  minPrice?: string;
  maxPrice?: string;
  search?: string;
  amenities?: string;
  sort?: string;
  checkIn?: string;
  checkOut?: string;
}

export async function listPublicCars(q: CarListQuery) {
  const page = Math.max(1, Number(q.page ?? 1));
  const pageSize = Math.min(48, Math.max(1, Number(q.pageSize ?? 12)));

  const where: Prisma.CarWhereInput = { ...visibleCarWhere };
  if (q.zone) {
    const zone = await prisma.zone.findUnique({ where: { slug: q.zone } });
    if (zone) where.zoneId = zone.id;
  }
  if (q.zoneId) where.zoneId = q.zoneId;
  if (q.brand) where.brand = { equals: q.brand, mode: 'insensitive' };
  if (q.transmission && ['MANUAL', 'AUTOMATIC'].includes(q.transmission))
    where.transmission = q.transmission as never;
  if (q.fuelType && ['PETROL', 'DIESEL', 'GAS', 'HYBRID', 'ELECTRIC'].includes(q.fuelType))
    where.fuelType = q.fuelType as never;
  if (q.seats) where.seats = { gte: Number(q.seats) };
  if (q.minYear || q.maxYear) {
    where.year = {
      ...(q.minYear ? { gte: Number(q.minYear) } : {}),
      ...(q.maxYear ? { lte: Number(q.maxYear) } : {}),
    };
  }
  if (q.driver === 'true') where.driverIncluded = true;
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
      { brand: { contains: s, mode: 'insensitive' } },
      { carModel: { contains: s, mode: 'insensitive' } },
      { address: { contains: s, mode: 'insensitive' } },
    ];
  }
  if (q.amenities) {
    const ids = q.amenities.split(',').filter(Boolean);
    if (ids.length) where.amenities = { some: { amenityId: { in: ids } } };
  }

  const orderBy: Prisma.CarOrderByWithRelationInput =
    q.sort === 'price_asc'
      ? { pricePerDay: 'asc' }
      : q.sort === 'price_desc'
        ? { pricePerDay: 'desc' }
        : q.sort === 'year'
          ? { year: 'desc' }
          : q.sort === 'popular'
            ? { viewsCount: 'desc' }
            : { createdAt: 'desc' };

  let [items, total] = await Promise.all([
    carRepository.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    carRepository.count(where),
  ]);

  // Sana bo'yicha bo'shlik filtri
  if (q.checkIn && q.checkOut) {
    const ci = new Date(q.checkIn);
    const co = new Date(q.checkOut);
    const availability = await Promise.all(
      items.map(async (c) => {
        const busy = await prisma.booking.count({ where: { carId: c.id, ...overlapWhere(ci, co) } });
        return busy === 0;
      }),
    );
    items = items.filter((_, i) => availability[i]);
  }

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getPublicCarBySlug(slug: string) {
  const car = await carRepository.findBySlug(slug);
  if (!car || car.status !== 'ACTIVE' || car.seller.status !== 'APPROVED')
    throw notFound('Avtomobil topilmadi');
  carRepository.incrementViews(car.id).catch(() => {});
  return car;
}

/* ==================== Bandlik ==================== */

export async function assertCarVisible(id: string) {
  const car = await prisma.car.findUnique({
    where: { id },
    select: { status: true, seller: { select: { status: true } } },
  });
  if (!car || car.status !== 'ACTIVE' || car.seller.status !== 'APPROVED')
    throw notFound('Avtomobil topilmadi');
}

export async function getCarBusyRanges(carId: string, from: Date, to: Date) {
  const bookings = await prisma.booking.findMany({
    where: { carId, ...overlapWhere(from, to) },
    select: { checkIn: true, checkOut: true },
    orderBy: { checkIn: 'asc' },
  });
  return bookings.map((b) => ({
    checkIn: b.checkIn.toISOString(),
    checkOut: b.checkOut.toISOString(),
  }));
}

/* ==================== Bron yaratish ==================== */

export async function createCarBooking(carId: string, input: CarBookingInput) {
  const dates = parseBookingDates(input);

  const car = await prisma.car.findUnique({
    where: { id: carId },
    include: { seller: { select: { status: true } } },
  });
  if (!car || car.status !== 'ACTIVE' || car.seller.status !== 'APPROVED')
    throw notFound('Avtomobil topilmadi');
  if (input.guestsCount > car.seats)
    throw badRequest(`Bu avtomobil maksimal ${car.seats} yo'lovchiga mo'ljallangan`);

  const days = nightsBetween(dates.checkIn, dates.checkOut);
  const totalPrice = days * car.pricePerDay;
  const depositAmount = calcDeposit(
    totalPrice,
    car.depositEnabled,
    car.depositType,
    car.depositValue,
  );

  return prisma.$transaction(async (tx) => {
    const overlapping = await tx.booking.count({
      where: { carId, ...overlapWhere(dates.checkIn, dates.checkOut) },
    });
    if (overlapping > 0)
      throw conflict('Tanlangan kun(lar) allaqachon band', { carId, ...dates });

    return tx.booking.create({
      data: {
        ...baseBookingData(input, dates, totalPrice, depositAmount),
        listingType: 'CAR',
        carId,
      },
    });
  });
}

/* ==================== Seller CRUD ==================== */

export async function ownCarOrThrow(carId: string, sellerId: string) {
  const car = await carRepository.findById(carId);
  if (!car) throw notFound('Avtomobil topilmadi');
  if (car.sellerId !== sellerId) throw forbidden('Bu avtomobil sizga tegishli emas');
  return car;
}

export async function createCar(sellerId: string, data: CarInput) {
  const zone = await prisma.zone.findUnique({ where: { id: data.zoneId } });
  if (!zone) throw badRequest('Zona topilmadi');

  const { amenityIds, ...fields } = data;
  return carRepository.create({
    ...fields,
    routeInfo: data.routeInfo ?? null,
    priceWeekend: data.priceWeekend ?? null,
    slug: uniqueSlug(data.titleUz),
    sellerId,
    status: 'PENDING',
    amenities: { create: amenityIds.map((amenityId) => ({ amenityId })) },
  });
}

export async function updateCar(carId: string, sellerId: string, data: CarUpdateInput) {
  await ownCarOrThrow(carId, sellerId);
  const { amenityIds, ...rest } = data;

  return carRepository.update(carId, {
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

export async function deleteCar(carId: string, sellerId: string) {
  await ownCarOrThrow(carId, sellerId);
  const [images, videos] = await Promise.all([
    carRepository.imagesOf(carId),
    carRepository.videosOf(carId),
  ]);
  images.forEach((i) => {
    deleteByUrl(i.url);
    deleteByUrl(i.thumbUrl);
  });
  videos.forEach((v) => deleteByUrl(v.url));
  await carRepository.remove(carId);
  return carId;
}

/* ==================== Admin moderatsiya ==================== */

export async function moderateCar(id: string, action: 'approve' | 'reject' | 'archive', reason?: string) {
  const car = await carRepository.findById(id);
  if (!car) throw notFound('Avtomobil topilmadi');

  let status = car.status;
  if (action === 'approve') status = 'ACTIVE';
  else if (action === 'reject') status = 'REJECTED';
  else if (action === 'archive') status = 'ARCHIVED';
  else throw badRequest('Noto\'g\'ri amal');

  return carRepository.update(id, {
    status,
    ...(action === 'reject' ? { rejectionReason: reason ?? null } : {}),
  });
}
