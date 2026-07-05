import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { ZodError } from 'zod';
import { env, isDev } from './config/env.js';
import { AppError } from './lib/errors.js';
import { initStorage } from './lib/storage.js';
import { MAX_VIDEO_SIZE } from '@dacha/shared';

import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import translateRoutes from './routes/translate.js';
import sellerRoutes from './routes/seller.js';
import adminRoutes from './routes/admin.js';
import paymeRoutes from './routes/payme.js';

export async function buildApp() {
  const app = Fastify({
    logger: isDev
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : true,
    bodyLimit: 2 * 1024 * 1024, // JSON body (media multipart orqali)
  });

  initStorage();

  await app.register(cors, {
    origin: [env.cors.webOrigin, env.cors.adminOrigin, env.cors.landingOrigin],
    credentials: true,
  });

  await app.register(rateLimit, {
    global: false,
    max: 100,
    timeWindow: '1 minute',
  });

  await app.register(multipart, {
    limits: { fileSize: MAX_VIDEO_SIZE, files: 20 },
  });

  await app.register(authPlugin);

  // Statik fayllar (yuklangan media)
  await app.register(fastifyStatic, {
    root: env.uploadDir,
    prefix: '/uploads/',
    decorateReply: false,
  });

  // Xatoliklarni bir joyda formatlash
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Kiritilgan ma\'lumotlar noto\'g\'ri',
        details: error.flatten(),
      });
    }
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      });
    }
    // Fastify o'zining xatolari (masalan rate limit, multipart limit)
    const errWithStatus = error as { statusCode?: number; message?: string };
    if (errWithStatus.statusCode) {
      return reply.status(errWithStatus.statusCode).send({
        error: 'ERROR',
        message: errWithStatus.message ?? 'Xatolik',
      });
    }
    req.log.error({ err: error }, 'Kutilmagan xato');
    return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Ichki server xatosi' });
  });

  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  // Marshrutlar
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(publicRoutes, { prefix: '/api' });
  await app.register(translateRoutes, { prefix: '/api' });
  await app.register(sellerRoutes, { prefix: '/api/seller' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(paymeRoutes, { prefix: '/api' });

  return app;
}
