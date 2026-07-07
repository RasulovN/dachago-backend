import type { FastifyInstance } from 'fastify';
import { LISTING_TYPES } from '@dacha/shared';
import { prisma } from '../../common/prisma.js';
import { amenityDTO } from './amenity.mapper.js';

export default async function amenityPublicRoutes(app: FastifyInstance) {
  // --- Qulayliklar ro'yxati (filter uchun) — e'lon turi bo'yicha ---
  app.get('/amenities', async (req) => {
    const q = req.query as { type?: string };
    const typeFilter =
      q.type && (LISTING_TYPES as readonly string[]).includes(q.type)
        ? { types: { has: q.type as never } }
        : {};
    const items = await prisma.amenity.findMany({
      where: typeFilter,
      orderBy: { order: 'asc' },
    });
    return items.map(amenityDTO);
  });
}
