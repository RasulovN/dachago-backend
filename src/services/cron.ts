import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

/**
 * Muddati o'tgan PENDING bronlarni EXPIRED qiladi (sanani bo'shatadi).
 * Har 10 daqiqada ishlaydi.
 */
async function expireStaleBookings(app: FastifyInstance) {
  const now = new Date();
  const result = await prisma.booking.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: now },
    },
    data: { status: 'EXPIRED' },
  });
  if (result.count > 0) {
    app.log.info(`${result.count} ta muddati o'tgan bron EXPIRED qilindi`);
  }

  // Muddati o'tgan refresh tokenlarni tozalaymiz
  await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } });
}

export function startCron(app: FastifyInstance): NodeJS.Timeout {
  // Ishga tushishda bir marta va keyin har 10 daqiqada
  expireStaleBookings(app).catch((err) => app.log.error({ err }, 'cron xatosi'));
  const interval = setInterval(
    () => expireStaleBookings(app).catch((err) => app.log.error({ err }, 'cron xatosi')),
    10 * 60 * 1000,
  );
  return interval;
}
