import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { conflict } from '../lib/errors.js';

/**
 * Sanani band qiladigan bron holatlari.
 * PENDING (muddati tugamagan) va CONFIRMED sanani egallaydi.
 */
const BLOCKING_STATUSES = ['PENDING', 'CONFIRMED'] as const;

/**
 * Berilgan oralig'da dacha band emasligini tekshiradi.
 * Ikki oraliq kesishadi agar: existing.checkIn < new.checkOut && existing.checkOut > new.checkIn
 * Ixtiyoriy tranzaksiya klienti bilan ishlaydi (race conditionга qarshi).
 */
export async function isRangeAvailable(
  dachaId: string,
  checkIn: Date,
  checkOut: Date,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
  excludeBookingId?: string,
): Promise<boolean> {
  const overlapping = await tx.booking.count({
    where: {
      dachaId,
      status: { in: [...BLOCKING_STATUSES] },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
  });
  return overlapping === 0;
}

export async function assertRangeAvailable(
  dachaId: string,
  checkIn: Date,
  checkOut: Date,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  const ok = await isRangeAvailable(dachaId, checkIn, checkOut, tx);
  if (!ok) throw conflict('Tanlangan sana(lar) allaqachon band', { dachaId, checkIn, checkOut });
}

/**
 * Oy uchun band bo'lgan sanalarni qaytaradi (kalendar uchun).
 * Har bir band oraliqni {checkIn, checkOut} sifatida qaytaramiz — frontend
 * kunlarni belgilaydi.
 */
export async function getBusyRanges(
  dachaId: string,
  from: Date,
  to: Date,
): Promise<{ checkIn: string; checkOut: string }[]> {
  const bookings = await prisma.booking.findMany({
    where: {
      dachaId,
      status: { in: [...BLOCKING_STATUSES] },
      checkIn: { lt: to },
      checkOut: { gt: from },
    },
    select: { checkIn: true, checkOut: true },
    orderBy: { checkIn: 'asc' },
  });
  return bookings.map((b) => ({
    checkIn: b.checkIn.toISOString(),
    checkOut: b.checkOut.toISOString(),
  }));
}

/** Kunlar sonini hisoblaydi (kamida 1) */
export function nightsBetween(checkIn: Date, checkOut: Date): number {
  const ms = checkOut.getTime() - checkIn.getTime();
  const nights = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return Math.max(1, nights);
}

/** Depozit summasini hisoblaydi */
export function calcDeposit(
  totalPrice: number,
  depositEnabled: boolean,
  depositType: 'FIXED' | 'PERCENT',
  depositValue: number,
): number | null {
  if (!depositEnabled || depositValue <= 0) return null;
  if (depositType === 'PERCENT') {
    return Math.round((totalPrice * depositValue) / 100);
  }
  return depositValue;
}
