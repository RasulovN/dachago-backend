import type { FastifyInstance } from 'fastify';
import { siteSettingsSchema } from '@dacha/shared';
import { prisma } from '../../common/prisma.js';

function settingsDTO(s: {
  phone: string;
  email: string;
  telegram: string;
  instagram: string;
  youtube: string;
  updatedAt: Date;
}) {
  return {
    phone: s.phone,
    email: s.email,
    telegram: s.telegram,
    instagram: s.instagram,
    youtube: s.youtube,
    updatedAt: s.updatedAt.toISOString(),
  };
}

export default async function settingsAdminRoutes(app: FastifyInstance) {
  app.get('/settings', async () => {
    const s = await prisma.siteSettings.upsert({ where: { id: 1 }, update: {}, create: {} });
    return settingsDTO(s);
  });

  app.patch('/settings', async (req) => {
    const data = siteSettingsSchema.partial().parse(req.body);
    const s = await prisma.siteSettings.upsert({
      where: { id: 1 },
      update: data,
      create: data,
    });
    return settingsDTO(s);
  });
}
