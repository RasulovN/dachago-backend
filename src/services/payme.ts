import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { PAYME_STATE } from '@dacha/shared';

/**
 * Payme Merchant API (JSON-RPC 2.0) protokoli.
 * Hujjat: https://developer.help.paycom.uz/protokol-merchant-api
 *
 * Muhim: Payme summani TIYIN'da yuboradi (1 so'm = 100 tiyin).
 * Bizda depositAmount so'mda saqlanadi, shuning uchun *100 solishtiramiz.
 */

// Payme xato kodlari
export const PaymeError = {
  INVALID_AMOUNT: { code: -31001, message: { uz: 'Noto\'g\'ri summa', ru: 'Неверная сумма', en: 'Invalid amount' } },
  TRANSACTION_NOT_FOUND: { code: -31003, message: { uz: 'Tranzaksiya topilmadi', ru: 'Транзакция не найдена', en: 'Transaction not found' } },
  CANT_PERFORM: { code: -31008, message: { uz: 'Amalni bajarib bo\'lmaydi', ru: 'Невозможно выполнить операцию', en: 'Unable to perform operation' } },
  CANT_CANCEL: { code: -31007, message: { uz: 'Bekor qilib bo\'lmaydi', ru: 'Невозможно отменить', en: 'Unable to cancel' } },
  ORDER_NOT_FOUND: { code: -31050, message: { uz: 'Buyurtma topilmadi', ru: 'Заказ не найден', en: 'Order not found' }, data: 'order_id' },
  ORDER_NOT_AVAILABLE: { code: -31051, message: { uz: 'Buyurtma to\'lov uchun mavjud emas', ru: 'Заказ недоступен для оплаты', en: 'Order not available for payment' }, data: 'order_id' },
  UNAUTHORIZED: { code: -32504, message: { uz: 'Avtorizatsiya xatosi', ru: 'Ошибка авторизации', en: 'Authorization error' } },
  METHOD_NOT_FOUND: { code: -32601, message: { uz: 'Metod topilmadi', ru: 'Метод не найден', en: 'Method not found' } },
} as const;

export class PaymeRpcError extends Error {
  code: number;
  rpcMessage: unknown;
  data?: unknown;
  constructor(err: { code: number; message: unknown; data?: unknown }, data?: unknown) {
    super(typeof err.message === 'string' ? err.message : JSON.stringify(err.message));
    this.code = err.code;
    this.rpcMessage = err.message;
    this.data = data ?? (err as { data?: unknown }).data;
  }
}

/** Basic Auth tekshiruvi: login "Paycom", parol = kassa kaliti */
export function verifyPaymeAuth(authHeader: string | undefined): boolean {
  if (!authHeader?.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    const password = decoded.slice(idx + 1);
    return password === env.payme.key && env.payme.key.length > 0;
  } catch {
    return false;
  }
}

function nowMs(): number {
  return Date.now();
}

/** account'dan bookingId ni oladi */
function getOrderId(params: { account?: Record<string, string> }): string {
  const id = params.account?.order_id ?? params.account?.booking_id;
  if (!id) throw new PaymeRpcError(PaymeError.ORDER_NOT_FOUND);
  return id;
}

async function findBookingForPayment(orderId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: orderId } });
  if (!booking) throw new PaymeRpcError(PaymeError.ORDER_NOT_FOUND);
  return booking;
}

// --- Metodlar ---

export async function checkPerformTransaction(params: {
  amount: number;
  account?: Record<string, string>;
}) {
  const orderId = getOrderId(params);
  const booking = await findBookingForPayment(orderId);

  if (!booking.depositAmount || booking.paymentStatus === 'PAID')
    throw new PaymeRpcError(PaymeError.ORDER_NOT_AVAILABLE);
  if (['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(booking.status))
    throw new PaymeRpcError(PaymeError.ORDER_NOT_AVAILABLE);
  if (params.amount !== booking.depositAmount * 100)
    throw new PaymeRpcError(PaymeError.INVALID_AMOUNT);

  return { allow: true };
}

export async function createTransaction(params: {
  id: string;
  time: number;
  amount: number;
  account?: Record<string, string>;
}) {
  // Mavjud tranzaksiyani tekshiramiz
  const existing = await prisma.paymeTransaction.findUnique({ where: { paymeId: params.id } });
  if (existing) {
    if (existing.state !== PAYME_STATE.CREATED)
      throw new PaymeRpcError(PaymeError.CANT_PERFORM);
    return {
      create_time: Number(existing.createTime),
      transaction: existing.id,
      state: existing.state,
    };
  }

  // Yangi tranzaksiya — avval shartlarni tekshiramiz
  const orderId = getOrderId(params);
  const booking = await findBookingForPayment(orderId);
  if (!booking.depositAmount || booking.paymentStatus === 'PAID')
    throw new PaymeRpcError(PaymeError.ORDER_NOT_AVAILABLE);
  if (params.amount !== booking.depositAmount * 100)
    throw new PaymeRpcError(PaymeError.INVALID_AMOUNT);

  // Shu buyurtma uchun boshqa aktiv tranzaksiya bo'lmasligi kerak
  const activeForOrder = await prisma.paymeTransaction.findFirst({
    where: { bookingId: booking.id, state: PAYME_STATE.CREATED },
  });
  if (activeForOrder) throw new PaymeRpcError(PaymeError.ORDER_NOT_AVAILABLE);

  const created = await prisma.paymeTransaction.create({
    data: {
      paymeId: params.id,
      bookingId: booking.id,
      amount: params.amount,
      state: PAYME_STATE.CREATED,
      createTime: BigInt(params.time),
    },
  });
  await prisma.booking.update({
    where: { id: booking.id },
    data: { paymentStatus: 'AWAITING' },
  });

  return { create_time: params.time, transaction: created.id, state: PAYME_STATE.CREATED };
}

export async function performTransaction(params: { id: string }) {
  const tx = await prisma.paymeTransaction.findUnique({ where: { paymeId: params.id } });
  if (!tx) throw new PaymeRpcError(PaymeError.TRANSACTION_NOT_FOUND);

  if (tx.state === PAYME_STATE.PERFORMED) {
    return { transaction: tx.id, perform_time: Number(tx.performTime), state: tx.state };
  }
  if (tx.state !== PAYME_STATE.CREATED) throw new PaymeRpcError(PaymeError.CANT_PERFORM);

  const performTime = nowMs();
  const updated = await prisma.paymeTransaction.update({
    where: { id: tx.id },
    data: { state: PAYME_STATE.PERFORMED, performTime: BigInt(performTime) },
  });
  await prisma.booking.update({
    where: { id: tx.bookingId },
    data: { paymentStatus: 'PAID' },
  });

  return { transaction: updated.id, perform_time: performTime, state: PAYME_STATE.PERFORMED };
}

export async function cancelTransaction(params: { id: string; reason: number }) {
  const tx = await prisma.paymeTransaction.findUnique({ where: { paymeId: params.id } });
  if (!tx) throw new PaymeRpcError(PaymeError.TRANSACTION_NOT_FOUND);

  if (tx.state === PAYME_STATE.CANCELLED || tx.state === PAYME_STATE.CANCELLED_AFTER_PERFORM) {
    return { transaction: tx.id, cancel_time: Number(tx.cancelTime), state: tx.state };
  }

  const cancelTime = nowMs();
  const newState =
    tx.state === PAYME_STATE.PERFORMED
      ? PAYME_STATE.CANCELLED_AFTER_PERFORM
      : PAYME_STATE.CANCELLED;

  const updated = await prisma.paymeTransaction.update({
    where: { id: tx.id },
    data: { state: newState, cancelTime: BigInt(cancelTime), reason: params.reason },
  });
  await prisma.booking.update({
    where: { id: tx.bookingId },
    data: { paymentStatus: 'REFUNDED' },
  });

  return { transaction: updated.id, cancel_time: cancelTime, state: newState };
}

export async function checkTransaction(params: { id: string }) {
  const tx = await prisma.paymeTransaction.findUnique({ where: { paymeId: params.id } });
  if (!tx) throw new PaymeRpcError(PaymeError.TRANSACTION_NOT_FOUND);
  return {
    create_time: Number(tx.createTime),
    perform_time: Number(tx.performTime),
    cancel_time: Number(tx.cancelTime),
    transaction: tx.id,
    state: tx.state,
    reason: tx.reason ?? null,
  };
}

export async function getStatement(params: { from: number; to: number }) {
  const txs = await prisma.paymeTransaction.findMany({
    where: { createTime: { gte: BigInt(params.from), lte: BigInt(params.to) } },
    orderBy: { createTime: 'asc' },
  });
  return {
    transactions: txs.map((tx) => ({
      id: tx.paymeId,
      time: Number(tx.createTime),
      amount: tx.amount,
      account: { order_id: tx.bookingId },
      create_time: Number(tx.createTime),
      perform_time: Number(tx.performTime),
      cancel_time: Number(tx.cancelTime),
      transaction: tx.id,
      state: tx.state,
      reason: tx.reason ?? null,
    })),
  };
}

export async function dispatchPaymeMethod(method: string, params: Record<string, unknown>) {
  switch (method) {
    case 'CheckPerformTransaction':
      return checkPerformTransaction(params as never);
    case 'CreateTransaction':
      return createTransaction(params as never);
    case 'PerformTransaction':
      return performTransaction(params as never);
    case 'CancelTransaction':
      return cancelTransaction(params as never);
    case 'CheckTransaction':
      return checkTransaction(params as never);
    case 'GetStatement':
      return getStatement(params as never);
    default:
      throw new PaymeRpcError(PaymeError.METHOD_NOT_FOUND);
  }
}
