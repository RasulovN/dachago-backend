import type { FastifyInstance } from 'fastify';
import { carInputSchema, carUpdateSchema, MAX_VIDEOS_PER_LISTING } from '@dacha/shared';
import { prisma } from '../../common/prisma.js';
import { notFound, forbidden, badRequest } from '../../common/errors.js';
import { collectImagesFromRequest, receiveVideoFromRequest } from '../../common/media.js';
import { deleteByUrl } from '../../common/storage.js';
import { carDTO } from './car.mapper.js';
import { carRepository } from './car.repository.js';
import { ownCarOrThrow, createCar, updateCar, deleteCar } from './car.service.js';

export default async function carSellerRoutes(app: FastifyInstance) {
  // --- Mening avtomobillarim ---
  app.get('/cars', async (req) => {
    const cars = await carRepository.listBySeller(req.authUser!.id);
    return cars.map((c) => carDTO(c));
  });

  app.get('/cars/:id', async (req) => {
    const { id } = req.params as { id: string };
    await ownCarOrThrow(id, req.authUser!.id);
    const car = await carRepository.findByIdFull(id);
    return carDTO(car!);
  });

  // --- Yaratish ---
  app.post('/cars', async (req) => {
    const data = carInputSchema.parse(req.body);
    const car = await createCar(req.authUser!.id, data);
    return carDTO(car);
  });

  // --- Tahrirlash ---
  app.patch('/cars/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = carUpdateSchema.parse(req.body);
    const car = await updateCar(id, req.authUser!.id, data);
    return carDTO(car);
  });

  // --- O'chirish ---
  app.delete('/cars/:id', async (req) => {
    const { id } = req.params as { id: string };
    const deleted = await deleteCar(id, req.authUser!.id);
    return { ok: true, deleted };
  });

  // --- Rasm yuklash ---
  app.post('/cars/:id/images', async (req) => {
    const { id } = req.params as { id: string };
    await ownCarOrThrow(id, req.authUser!.id);

    const currentCount = await prisma.carImage.count({ where: { carId: id } });
    const saved = await collectImagesFromRequest(req, { currentCount });

    const created = await Promise.all(
      saved.map((f) => prisma.carImage.create({ data: { carId: id, ...f } })),
    );
    return { images: created.map((i) => ({ id: i.id, url: i.url, thumbUrl: i.thumbUrl, order: i.order })) };
  });

  // --- Video yuklash (stream, 200MB limit) ---
  app.post('/cars/:id/videos', async (req) => {
    const { id } = req.params as { id: string };
    await ownCarOrThrow(id, req.authUser!.id);

    const currentCount = await prisma.carVideo.count({ where: { carId: id } });
    if (currentCount >= MAX_VIDEOS_PER_LISTING)
      throw badRequest(`Maksimal ${MAX_VIDEOS_PER_LISTING} ta video yuklash mumkin`);

    const { url, size } = await receiveVideoFromRequest(req);
    const video = await prisma.carVideo.create({
      data: { carId: id, url, size, order: currentCount },
    });
    return { video: { id: video.id, url: video.url, size: video.size } };
  });

  // --- Video o'chirish ---
  app.delete('/cars/videos/:videoId', async (req) => {
    const { videoId } = req.params as { videoId: string };
    const vid = await prisma.carVideo.findUnique({
      where: { id: videoId },
      include: { car: true },
    });
    if (!vid) throw notFound('Video topilmadi');
    if (vid.car.sellerId !== req.authUser!.id) throw forbidden();
    deleteByUrl(vid.url);
    await prisma.carVideo.delete({ where: { id: videoId } });
    return { ok: true };
  });

  // --- Rasm o'chirish ---
  app.delete('/cars/images/:imageId', async (req) => {
    const { imageId } = req.params as { imageId: string };
    const img = await prisma.carImage.findUnique({
      where: { id: imageId },
      include: { car: true },
    });
    if (!img) throw notFound('Rasm topilmadi');
    if (img.car.sellerId !== req.authUser!.id) throw forbidden();
    deleteByUrl(img.url);
    deleteByUrl(img.thumbUrl);
    await prisma.carImage.delete({ where: { id: imageId } });
    return { ok: true };
  });
}
