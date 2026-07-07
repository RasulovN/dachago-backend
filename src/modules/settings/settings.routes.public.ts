import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env.js';
import { prisma } from '../../common/prisma.js';

export default async function settingsPublicRoutes(app: FastifyInstance) {
  // --- Sayt sozlamalari (aloqa + ijtimoiy tarmoqlar + Payme public config) ---
  app.get('/settings', async () => {
    const s = await prisma.siteSettings.upsert({ where: { id: 1 }, update: {}, create: {} });
    return {
      phone: s.phone,
      email: s.email,
      telegram: s.telegram,
      instagram: s.instagram,
      youtube: s.youtube,
      updatedAt: s.updatedAt.toISOString(),
      // Merchant ID public ma'lumot (checkout URL'da ochiq ko'rinadi); PAYME_KEY hech qachon berilmaydi!
      payme: {
        merchantId: env.payme.merchantId,
        checkoutUrl: env.payme.checkoutUrl,
      },
    };
  });
}
