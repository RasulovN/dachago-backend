import { buildApp } from './app.js';
import { env } from './config/env.js';
import { startCron } from './modules/booking/booking.cron.js';
import { prisma } from './common/prisma.js';

async function main() {
  const app = await buildApp();
  const cronTimer = startCron(app);

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} qabul qilindi, to'xtatilmoqda...`);
    clearInterval(cronTimer);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await app.listen({ port: env.port, host: env.host });
    app.log.info(`🚀 API tayyor: http://localhost:${env.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
