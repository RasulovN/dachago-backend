import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { ZodError } from 'zod';
import { env, isDev } from './config/env.js';
import { AppError } from './common/errors.js';
import { initStorage } from './common/storage.js';
import { MAX_VIDEO_SIZE } from '@dacha/shared';

import authPlugin from './plugins/auth.js';

// Modullar: har xizmat (dacha/hotel/car) mustaqil, umumiy qatlamlar alohida
import authRoutes from './modules/auth/auth.routes.js';
import translateRoutes from './modules/translate/translate.routes.js';
import paymeRoutes from './modules/payme/payme.routes.js';
import settingsPublicRoutes from './modules/settings/settings.routes.public.js';
import settingsAdminRoutes from './modules/settings/settings.routes.admin.js';
import zonePublicRoutes from './modules/zone/zone.routes.public.js';
import zoneAdminRoutes from './modules/zone/zone.routes.admin.js';
import amenityPublicRoutes from './modules/amenity/amenity.routes.public.js';
import amenityAdminRoutes from './modules/amenity/amenity.routes.admin.js';
import dachaPublicRoutes from './modules/dacha/dacha.routes.public.js';
import dachaSellerRoutes from './modules/dacha/dacha.routes.seller.js';
import dachaAdminRoutes from './modules/dacha/dacha.routes.admin.js';
import hotelPublicRoutes from './modules/hotel/hotel.routes.public.js';
import hotelSellerRoutes from './modules/hotel/hotel.routes.seller.js';
import hotelAdminRoutes from './modules/hotel/hotel.routes.admin.js';
import carPublicRoutes from './modules/car/car.routes.public.js';
import carSellerRoutes from './modules/car/car.routes.seller.js';
import carAdminRoutes from './modules/car/car.routes.admin.js';
import bookingPublicRoutes from './modules/booking/booking.routes.public.js';
import bookingSellerRoutes from './modules/booking/booking.routes.seller.js';
import bookingAdminRoutes from './modules/booking/booking.routes.admin.js';
import sellerRoutes from './modules/seller/seller.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import financeAdminRoutes from './modules/finance/finance.routes.admin.js';

export async function buildApp() {
  const app = Fastify({
    logger: isDev
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : true,
    bodyLimit: 2 * 1024 * 1024, // JSON body (media multipart orqali)
  });

  initStorage();

  await app.register(cors, {
    origin: [env.cors.webOrigin, env.cors.landingOrigin].filter(Boolean) as string[],
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

  // ==================== Marshrutlar ====================

  // Auth
  await app.register(authRoutes, { prefix: '/api/auth' });

  // Public: har modul o'z endpointlari bilan
  await app.register(settingsPublicRoutes, { prefix: '/api' });
  await app.register(zonePublicRoutes, { prefix: '/api' });
  await app.register(amenityPublicRoutes, { prefix: '/api' });
  await app.register(dachaPublicRoutes, { prefix: '/api' });
  await app.register(hotelPublicRoutes, { prefix: '/api' });
  await app.register(carPublicRoutes, { prefix: '/api' });
  await app.register(bookingPublicRoutes, { prefix: '/api' });
  await app.register(translateRoutes, { prefix: '/api' });
  await app.register(paymeRoutes, { prefix: '/api' });

  // Seller: auth + SELLER roli barcha seller modullari uchun bitta joyda
  await app.register(
    async (sellerScope) => {
      sellerScope.addHook('preHandler', sellerScope.authenticate);
      sellerScope.addHook('preHandler', sellerScope.requireRole('SELLER'));
      await sellerScope.register(sellerRoutes);
      await sellerScope.register(dachaSellerRoutes);
      await sellerScope.register(hotelSellerRoutes);
      await sellerScope.register(carSellerRoutes);
      await sellerScope.register(bookingSellerRoutes);
    },
    { prefix: '/api/seller' },
  );

  // Admin: auth + SUPER_ADMIN roli
  await app.register(
    async (adminScope) => {
      adminScope.addHook('preHandler', adminScope.authenticate);
      adminScope.addHook('preHandler', adminScope.requireRole('SUPER_ADMIN'));
      await adminScope.register(adminRoutes);
      await adminScope.register(zoneAdminRoutes);
      await adminScope.register(amenityAdminRoutes);
      await adminScope.register(dachaAdminRoutes);
      await adminScope.register(hotelAdminRoutes);
      await adminScope.register(carAdminRoutes);
      await adminScope.register(bookingAdminRoutes);
      await adminScope.register(financeAdminRoutes);
      await adminScope.register(settingsAdminRoutes);
    },
    { prefix: '/api/admin' },
  );

  return app;
}
