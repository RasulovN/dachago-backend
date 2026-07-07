import type { FastifyInstance } from 'fastify';
import { carDTO } from './car.mapper.js';
import { carRepository } from './car.repository.js';
import { moderateCar } from './car.service.js';

export default async function carAdminRoutes(app: FastifyInstance) {
  // --- Avtomobillar moderatsiyasi ---
  app.get('/cars', async (req) => {
    const q = req.query as { status?: string };
    const cars = await carRepository.listAll(q.status);
    return cars.map((c) => carDTO(c, { includeSeller: true }));
  });

  app.patch('/cars/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { action: 'approve' | 'reject' | 'archive'; reason?: string };
    const updated = await moderateCar(id, body.action, body.reason);
    return carDTO(updated, { includeSeller: true });
  });
}
