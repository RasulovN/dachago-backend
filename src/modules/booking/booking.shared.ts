import type { Prisma } from '@prisma/client';
import type { BookingGuestInput, BookingDTO, BookingListingRefDTO } from '@dacha/shared';
import { BOOKING_PENDING_TTL_HOURS } from '@dacha/shared';
import { badRequest } from '../../common/errors.js';
import { bookingCode } from '../../common/slug.js';

/** Sanani band qiladigan bron holatlari: PENDING (muddati tugamagan) va CONFIRMED */
export const BLOCKING_STATUSES = ['PENDING', 'CONFIRMED'] as const;

/** Oraliq kesishuvi sharti: existing.checkIn < new.checkOut && existing.checkOut > new.checkIn */
export function overlapWhere(checkIn: Date, checkOut: Date) {
  return {
    status: { in: [...BLOCKING_STATUSES] as ('PENDING' | 'CONFIRMED')[] },
    checkIn: { lt: checkOut },
    checkOut: { gt: checkIn },
  };
}

/** Kunlar sonini hisoblaydi (kamida 1) */
export function nightsBetween(checkIn: Date, checkOut: Date): number {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/** Depozit summasini hisoblaydi */
export function calcDeposit(
  totalPrice: number,
  depositEnabled: boolean,
  depositType: 'FIXED' | 'PERCENT',
  depositValue: number,
): number | null {
  if (!depositEnabled || depositValue <= 0) return null;
  if (depositType === 'PERCENT') return Math.round((totalPrice * depositValue) / 100);
  return depositValue;
}

/** Bron sanalarini tekshirib Date'ga o'giradi */
export function parseBookingDates(input: { checkIn: string; checkOut: string }) {
  const checkIn = new Date(input.checkIn);
  const checkOut = new Date(input.checkOut);
  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime()))
    throw badRequest('Sana formati noto\'g\'ri');
  if (checkOut <= checkIn)
    throw badRequest('Chiqish sanasi kirish sanasidan keyin bo\'lishi kerak');
  if (checkIn < new Date(Date.now() - 60 * 60 * 1000))
    throw badRequest('O\'tgan sanaga bron qilib bo\'lmaydi');
  return { checkIn, checkOut };
}

/** Barcha bron turlari uchun umumiy yaratish maydonlari */
export function baseBookingData(
  input: BookingGuestInput,
  dates: { checkIn: Date; checkOut: Date },
  totalPrice: number,
  depositAmount: number | null,
) {
  return {
    code: bookingCode(),
    guestName: `${input.guestFirstName} ${input.guestLastName}`,
    guestPhone: input.guestPhone,
    checkIn: dates.checkIn,
    checkOut: dates.checkOut,
    guestsCount: input.guestsCount,
    totalPrice,
    depositAmount,
    note: input.note || null,
    status: 'PENDING',
    paymentStatus: depositAmount ? 'AWAITING' : 'NOT_REQUIRED',
    expiresAt: new Date(Date.now() + BOOKING_PENDING_TTL_HOURS * 60 * 60 * 1000),
  } as const;
}

/** Bron yaratish javobidagi to'lov bloki */
export function paymentInfo(depositAmount: number | null) {
  return depositAmount ? { required: true as const, amount: depositAmount } : { required: false as const };
}

/* ==================== Include va DTO ==================== */

const firstImage = { orderBy: { order: 'asc' }, take: 1 } as const;

/** Bron + tegishli e'lon qisqa ma'lumoti (rasm bilan) */
export const bookingInclude = {
  dacha: { include: { images: firstImage } },
  hotelRoom: { include: { hotel: { include: { images: firstImage } } } },
  car: { include: { images: firstImage } },
} satisfies Prisma.BookingInclude;

export type BookingWithListing = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

/** Bron egasini (sellerni) topish uchun include */
export const bookingOwnerInclude = {
  dacha: { select: { sellerId: true } },
  hotelRoom: { select: { hotel: { select: { sellerId: true } } } },
  car: { select: { sellerId: true } },
} satisfies Prisma.BookingInclude;

type BookingWithOwner = Prisma.BookingGetPayload<{ include: typeof bookingOwnerInclude }>;

export function bookingSellerId(b: BookingWithOwner): string | null {
  return b.dacha?.sellerId ?? b.hotelRoom?.hotel.sellerId ?? b.car?.sellerId ?? null;
}

/** Sellerga tegishli bronlar sharti (barcha modullar bo'ylab) */
export function bookingSellerWhere(sellerId: string): Prisma.BookingWhereInput {
  return {
    OR: [
      { dacha: { sellerId } },
      { hotelRoom: { hotel: { sellerId } } },
      { car: { sellerId } },
    ],
  };
}

function listingRef(b: BookingWithListing): BookingListingRefDTO | undefined {
  if (b.dacha) {
    return {
      type: 'DACHA',
      id: b.dacha.id,
      slug: b.dacha.slug,
      titleUz: b.dacha.titleUz,
      titleRu: b.dacha.titleRu,
      titleEn: b.dacha.titleEn,
      image: b.dacha.images[0]?.thumbUrl ?? null,
    };
  }
  if (b.hotelRoom) {
    const h = b.hotelRoom.hotel;
    return {
      type: 'HOTEL',
      id: h.id,
      slug: h.slug,
      titleUz: h.titleUz,
      titleRu: h.titleRu,
      titleEn: h.titleEn,
      image: h.images[0]?.thumbUrl ?? null,
      roomNameUz: b.hotelRoom.nameUz,
      roomNameRu: b.hotelRoom.nameRu,
      roomNameEn: b.hotelRoom.nameEn,
    };
  }
  if (b.car) {
    return {
      type: 'CAR',
      id: b.car.id,
      slug: b.car.slug,
      titleUz: b.car.titleUz,
      titleRu: b.car.titleRu,
      titleEn: b.car.titleEn,
      image: b.car.images[0]?.thumbUrl ?? null,
    };
  }
  return undefined;
}

export function bookingDTO(b: BookingWithListing): BookingDTO {
  return {
    id: b.id,
    code: b.code,
    listingType: b.listingType,
    guestName: b.guestName,
    guestPhone: b.guestPhone,
    checkIn: b.checkIn.toISOString(),
    checkOut: b.checkOut.toISOString(),
    guestsCount: b.guestsCount,
    roomsCount: b.roomsCount,
    totalPrice: b.totalPrice,
    depositAmount: b.depositAmount,
    status: b.status,
    paymentStatus: b.paymentStatus,
    note: b.note,
    createdAt: b.createdAt.toISOString(),
    listing: listingRef(b),
  };
}
