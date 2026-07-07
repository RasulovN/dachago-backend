import type { FastifyInstance } from 'fastify';
import { prisma } from '../../common/prisma.js';
import { notFound } from '../../common/errors.js';
import { zoneDTO } from './zone.mapper.js';

// Saytda ko'rinadigan e'lon sharti — barcha modullar uchun bir xil qoida
const visibleWhere = { status: 'ACTIVE', seller: { status: 'APPROVED' } } as const;

const zoneCounts = {
  _count: {
    select: {
      dachas: { where: visibleWhere },
      hotels: { where: visibleWhere },
      cars: { where: visibleWhere },
    },
  },
} as const;

export default async function zonePublicRoutes(app: FastifyInstance) {
  app.get('/zones', async () => {
    const zones = await prisma.zone.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: zoneCounts,
    });
    return zones.map(zoneDTO);
  });

  app.get('/zones/:slug', async (req) => {
    const { slug } = req.params as { slug: string };
    const zone = await prisma.zone.findUnique({ where: { slug }, include: zoneCounts });
    if (!zone || !zone.isActive) throw notFound('Zona topilmadi');
    return zoneDTO(zone);
  });
}
