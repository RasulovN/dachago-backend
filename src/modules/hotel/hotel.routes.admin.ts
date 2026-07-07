import type { FastifyInstance } from 'fastify';
import { hotelDTO } from './hotel.mapper.js';
import { hotelRepository } from './hotel.repository.js';
import { moderateHotel } from './hotel.service.js';

export default async function hotelAdminRoutes(app: FastifyInstance) {
  // --- Mehmonxonalar moderatsiyasi ---
  app.get('/hotels', async (req) => {
    const q = req.query as { status?: string };
    const hotels = await hotelRepository.listAll(q.status);
    return hotels.map((h) => hotelDTO(h, { includeSeller: true }));
  });

  app.patch('/hotels/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { action: 'approve' | 'reject' | 'archive'; reason?: string };
    const updated = await moderateHotel(id, body.action, body.reason);
    return hotelDTO(updated, { includeSeller: true });
  });
}
