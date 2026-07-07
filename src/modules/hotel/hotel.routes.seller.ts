import type { FastifyInstance } from 'fastify';
import {
  hotelInputSchema,
  hotelUpdateSchema,
  hotelRoomInputSchema,
  hotelRoomUpdateSchema,
  MAX_VIDEOS_PER_LISTING,
} from '@dacha/shared';
import { prisma } from '../../common/prisma.js';
import { notFound, forbidden, badRequest } from '../../common/errors.js';
import { collectImagesFromRequest, receiveVideoFromRequest } from '../../common/media.js';
import { deleteByUrl } from '../../common/storage.js';
import { hotelDTO, hotelRoomDTO } from './hotel.mapper.js';
import { hotelRepository } from './hotel.repository.js';
import {
  ownHotelOrThrow,
  createHotel,
  updateHotel,
  deleteHotel,
  addRoom,
  updateRoom,
  deleteRoom,
} from './hotel.service.js';

export default async function hotelSellerRoutes(app: FastifyInstance) {
  // --- Mening mehmonxonalarim ---
  app.get('/hotels', async (req) => {
    const hotels = await hotelRepository.listBySeller(req.authUser!.id);
    return hotels.map((h) => hotelDTO(h));
  });

  app.get('/hotels/:id', async (req) => {
    const { id } = req.params as { id: string };
    await ownHotelOrThrow(id, req.authUser!.id);
    const hotel = await hotelRepository.findByIdFull(id);
    return hotelDTO(hotel!);
  });

  // --- Yaratish ---
  app.post('/hotels', async (req) => {
    const data = hotelInputSchema.parse(req.body);
    const hotel = await createHotel(req.authUser!.id, data);
    return hotelDTO(hotel);
  });

  // --- Tahrirlash ---
  app.patch('/hotels/:id', async (req) => {
    const { id } = req.params as { id: string };
    const data = hotelUpdateSchema.parse(req.body);
    const hotel = await updateHotel(id, req.authUser!.id, data);
    return hotelDTO(hotel);
  });

  // --- O'chirish ---
  app.delete('/hotels/:id', async (req) => {
    const { id } = req.params as { id: string };
    const deleted = await deleteHotel(id, req.authUser!.id);
    return { ok: true, deleted };
  });

  // --- Xonalar CRUD ---
  app.post('/hotels/:id/rooms', async (req) => {
    const { id } = req.params as { id: string };
    const data = hotelRoomInputSchema.parse(req.body);
    const room = await addRoom(id, req.authUser!.id, data);
    return hotelRoomDTO(room);
  });

  app.patch('/hotels/rooms/:roomId', async (req) => {
    const { roomId } = req.params as { roomId: string };
    const data = hotelRoomUpdateSchema.parse(req.body);
    const room = await updateRoom(roomId, req.authUser!.id, data);
    return hotelRoomDTO(room);
  });

  app.delete('/hotels/rooms/:roomId', async (req) => {
    const { roomId } = req.params as { roomId: string };
    await deleteRoom(roomId, req.authUser!.id);
    return { ok: true };
  });

  // --- Rasm yuklash ---
  app.post('/hotels/:id/images', async (req) => {
    const { id } = req.params as { id: string };
    await ownHotelOrThrow(id, req.authUser!.id);

    const currentCount = await prisma.hotelImage.count({ where: { hotelId: id } });
    const saved = await collectImagesFromRequest(req, { currentCount });

    const created = await Promise.all(
      saved.map((f) => prisma.hotelImage.create({ data: { hotelId: id, ...f } })),
    );
    return { images: created.map((i) => ({ id: i.id, url: i.url, thumbUrl: i.thumbUrl, order: i.order })) };
  });

  // --- Video yuklash (stream, 200MB limit) ---
  app.post('/hotels/:id/videos', async (req) => {
    const { id } = req.params as { id: string };
    await ownHotelOrThrow(id, req.authUser!.id);

    const currentCount = await prisma.hotelVideo.count({ where: { hotelId: id } });
    if (currentCount >= MAX_VIDEOS_PER_LISTING)
      throw badRequest(`Maksimal ${MAX_VIDEOS_PER_LISTING} ta video yuklash mumkin`);

    const { url, size } = await receiveVideoFromRequest(req);
    const video = await prisma.hotelVideo.create({
      data: { hotelId: id, url, size, order: currentCount },
    });
    return { video: { id: video.id, url: video.url, size: video.size } };
  });

  // --- Video o'chirish ---
  app.delete('/hotels/videos/:videoId', async (req) => {
    const { videoId } = req.params as { videoId: string };
    const vid = await prisma.hotelVideo.findUnique({
      where: { id: videoId },
      include: { hotel: true },
    });
    if (!vid) throw notFound('Video topilmadi');
    if (vid.hotel.sellerId !== req.authUser!.id) throw forbidden();
    deleteByUrl(vid.url);
    await prisma.hotelVideo.delete({ where: { id: videoId } });
    return { ok: true };
  });

  // --- Rasm o'chirish ---
  app.delete('/hotels/images/:imageId', async (req) => {
    const { imageId } = req.params as { imageId: string };
    const img = await prisma.hotelImage.findUnique({
      where: { id: imageId },
      include: { hotel: true },
    });
    if (!img) throw notFound('Rasm topilmadi');
    if (img.hotel.sellerId !== req.authUser!.id) throw forbidden();
    deleteByUrl(img.url);
    deleteByUrl(img.thumbUrl);
    await prisma.hotelImage.delete({ where: { id: imageId } });
    return { ok: true };
  });
}
