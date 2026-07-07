import type { FastifyInstance } from 'fastify';
import { amenityInputSchema } from '@dacha/shared';
import { prisma } from '../../common/prisma.js';
import { amenityDTO } from './amenity.mapper.js';

export default async function amenityAdminRoutes(app: FastifyInstance) {
  app.get('/amenities', async () => {
    const items = await prisma.amenity.findMany({ orderBy: { order: 'asc' } });
    return items.map(amenityDTO);
  });

  app.post('/amenities', async (req) => {
    const data = amenityInputSchema.parse(req.body);
    const amenity = await prisma.amenity.create({ data });
    return amenityDTO(amenity);
  });

  app.patch('/amenities/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = amenityInputSchema.partial().parse(req.body);
    const amenity = await prisma.amenity.update({ where: { id }, data });
    return amenityDTO(amenity);
  });

  app.delete('/amenities/:id', async (req) => {
    const { id } = req.params as { id: string };
    await prisma.amenity.delete({ where: { id } });
    return { ok: true };
  });
}
