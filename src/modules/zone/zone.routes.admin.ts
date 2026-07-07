import type { FastifyInstance } from 'fastify';
import { zoneInputSchema } from '@dacha/shared';
import { prisma } from '../../common/prisma.js';
import { badRequest } from '../../common/errors.js';
import { zoneDTO } from './zone.mapper.js';

export default async function zoneAdminRoutes(app: FastifyInstance) {
  app.get('/zones', async () => {
    const zones = await prisma.zone.findMany({
      orderBy: { order: 'asc' },
      include: { _count: { select: { dachas: true, hotels: true, cars: true } } },
    });
    return zones.map(zoneDTO);
  });

  app.post('/zones', async (req) => {
    const data = zoneInputSchema.parse(req.body);
    const zone = await prisma.zone.create({ data });
    return zoneDTO(zone);
  });

  app.patch('/zones/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = zoneInputSchema.partial().parse(req.body);
    const zone = await prisma.zone.update({ where: { id }, data });
    return zoneDTO(zone);
  });

  app.delete('/zones/:id', async (req) => {
    const { id } = req.params as { id: string };
    const [dachas, hotels, cars] = await Promise.all([
      prisma.dacha.count({ where: { zoneId: id } }),
      prisma.hotel.count({ where: { zoneId: id } }),
      prisma.car.count({ where: { zoneId: id } }),
    ]);
    if (dachas + hotels + cars > 0)
      throw badRequest('Bu zonada e\'lonlar mavjud, avval ularni ko\'chiring yoki o\'chiring');
    await prisma.zone.delete({ where: { id } });
    return { ok: true };
  });
}
