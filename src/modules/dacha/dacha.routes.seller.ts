import type { FastifyInstance } from 'fastify';
import { dachaInputSchema, dachaUpdateSchema, MAX_VIDEOS_PER_LISTING } from '@dacha/shared';
import { prisma } from '../../common/prisma.js';
import { notFound, badRequest, forbidden } from '../../common/errors.js';
import { collectImagesFromRequest, receiveVideoFromRequest } from '../../common/media.js';
import { deleteByUrl } from '../../common/storage.js';
import { dachaDTO } from './dacha.mapper.js';
import { dachaRepository } from './dacha.repository.js';
import {
  ownDachaOrThrow,
  createDacha,
  updateDacha,
  deleteDacha,
} from './dacha.service.js';

export default async function dachaSellerRoutes(app: FastifyInstance) {
  // --- Mening dachalarim ---
  app.get('/dachas', async (req) => {
    const dachas = await dachaRepository.listBySeller(req.authUser!.id);
    return dachas.map((d) => dachaDTO(d));
  });

  app.get('/dachas/:id', async (req) => {
    const { id } = req.params as { id: string };
    await ownDachaOrThrow(id, req.authUser!.id);
    const dacha = await dachaRepository.findByIdFull(id);
    return dachaDTO(dacha!);
  });

  // --- Yaratish ---
  app.post('/dachas', async (req) => {
    const data = dachaInputSchema.parse(req.body);
    const dacha = await createDacha(req.authUser!.id, data);
    return dachaDTO(dacha);
  });

  // --- Tahrirlash ---
  app.patch('/dachas/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = dachaUpdateSchema.parse(req.body);
    const dacha = await updateDacha(id, req.authUser!.id, data);
    return dachaDTO(dacha);
  });

  // --- O'chirish ---
  app.delete('/dachas/:id', async (req) => {
    const { id } = req.params as { id: string };
    const deleted = await deleteDacha(id, req.authUser!.id);
    return { ok: true, deleted };
  });

  // --- Rasm yuklash (multipart, ko'p fayl) ---
  app.post('/dachas/:id/images', async (req) => {
    const { id } = req.params as { id: string };
    await ownDachaOrThrow(id, req.authUser!.id);

    const currentCount = await prisma.dachaImage.count({ where: { dachaId: id } });
    const saved = await collectImagesFromRequest(req, { currentCount });

    const created = await Promise.all(
      saved.map((f) => prisma.dachaImage.create({ data: { dachaId: id, ...f } })),
    );
    return { images: created.map((i) => ({ id: i.id, url: i.url, thumbUrl: i.thumbUrl, order: i.order })) };
  });

  // --- Video yuklash (stream, 200MB limit) ---
  app.post('/dachas/:id/videos', async (req) => {
    const { id } = req.params as { id: string };
    await ownDachaOrThrow(id, req.authUser!.id);

    const currentCount = await prisma.dachaVideo.count({ where: { dachaId: id } });
    if (currentCount >= MAX_VIDEOS_PER_LISTING)
      throw badRequest(`Maksimal ${MAX_VIDEOS_PER_LISTING} ta video yuklash mumkin`);

    const { url, size } = await receiveVideoFromRequest(req);
    const video = await prisma.dachaVideo.create({
      data: { dachaId: id, url, size, order: currentCount },
    });
    return { video: { id: video.id, url: video.url, size: video.size } };
  });

  // --- Media o'chirish ---
  app.delete('/dachas/images/:imageId', async (req) => {
    const { imageId } = req.params as { imageId: string };
    const img = await prisma.dachaImage.findUnique({
      where: { id: imageId },
      include: { dacha: true },
    });
    if (!img) throw notFound('Rasm topilmadi');
    if (img.dacha.sellerId !== req.authUser!.id) throw forbidden();
    deleteByUrl(img.url);
    deleteByUrl(img.thumbUrl);
    await prisma.dachaImage.delete({ where: { id: imageId } });
    return { ok: true };
  });

  app.delete('/dachas/videos/:videoId', async (req) => {
    const { videoId } = req.params as { videoId: string };
    const vid = await prisma.dachaVideo.findUnique({
      where: { id: videoId },
      include: { dacha: true },
    });
    if (!vid) throw notFound('Video topilmadi');
    if (vid.dacha.sellerId !== req.authUser!.id) throw forbidden();
    deleteByUrl(vid.url);
    await prisma.dachaVideo.delete({ where: { id: videoId } });
    return { ok: true };
  });
}
