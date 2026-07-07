import type { FastifyInstance } from 'fastify';
import { dachaDTO } from './dacha.mapper.js';
import { dachaRepository } from './dacha.repository.js';
import { moderateDacha } from './dacha.service.js';

export default async function dachaAdminRoutes(app: FastifyInstance) {
  // --- Dachalar moderatsiyasi ---
  app.get('/dachas', async (req) => {
    const q = req.query as { status?: string };
    const dachas = await dachaRepository.listAll(q.status);
    return dachas.map((d) => dachaDTO(d, { includeSeller: true }));
  });

  // Tasdiqlash / rad etish / arxivlash
  app.patch('/dachas/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { action: 'approve' | 'reject' | 'archive'; reason?: string };
    const updated = await moderateDacha(id, body.action, body.reason);
    return dachaDTO(updated, { includeSeller: true });
  });
}
