import { prisma } from '../../common/prisma.js';
import { notFound, badRequest, forbidden } from '../../common/errors.js';
import { bookingInclude, bookingOwnerInclude, bookingSellerId } from './booking.shared.js';

export type BookingAction = 'confirm' | 'cancel' | 'complete';

/**
 * Seller bron holatini o'zgartiradi (tasdiqlash / bekor qilish / yakunlash).
 * Egalik barcha modullar bo'ylab tekshiriladi.
 */
export async function applySellerBookingAction(
  bookingId: string,
  sellerId: string,
  action: BookingAction,
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingOwnerInclude,
  });
  if (!booking) throw notFound('Bron topilmadi');
  if (bookingSellerId(booking) !== sellerId) throw forbidden();

  let status = booking.status;
  if (action === 'confirm') {
    if (booking.status !== 'PENDING') throw badRequest('Faqat kutilayotgan bronni tasdiqlash mumkin');
    status = 'CONFIRMED';
  } else if (action === 'cancel') {
    if (['COMPLETED', 'CANCELLED'].includes(booking.status))
      throw badRequest('Bu bronni bekor qilib bo\'lmaydi');
    status = 'CANCELLED';
  } else if (action === 'complete') {
    if (booking.status !== 'CONFIRMED') throw badRequest('Faqat tasdiqlangan bronni yakunlash mumkin');
    status = 'COMPLETED';
  } else {
    throw badRequest('Noto\'g\'ri amal');
  }

  return prisma.booking.update({
    where: { id: bookingId },
    data: {
      status,
      // Tasdiqlangach muddat cheklovini olib tashlaymiz
      ...(status === 'CONFIRMED' ? { expiresAt: null } : {}),
    },
    include: bookingInclude,
  });
}
