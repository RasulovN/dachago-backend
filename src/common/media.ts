import type { FastifyRequest } from 'fastify';
import {
  MAX_IMAGES_PER_LISTING,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
} from '@dacha/shared';
import { badRequest } from './errors.js';
import { saveImage, saveVideoStream, deleteByUrl } from './storage.js';

/**
 * Multipart so'rovdan rasmlarni qabul qilib diskka saqlaydi.
 * Barcha modullar (dacha/hotel/car) uchun umumiy — DB yozuvini modul o'zi yaratadi.
 */
export async function collectImagesFromRequest(
  req: FastifyRequest,
  opts: { currentCount: number; max?: number },
): Promise<{ url: string; thumbUrl: string; order: number }[]> {
  const max = opts.max ?? MAX_IMAGES_PER_LISTING;
  const parts = req.files({ limits: { fileSize: MAX_IMAGE_SIZE } });

  const saved: { url: string; thumbUrl: string; order: number }[] = [];
  let order = opts.currentCount;

  for await (const part of parts) {
    if (order >= max) throw badRequest(`Maksimal ${max} ta rasm yuklash mumkin`);
    if (!ALLOWED_IMAGE_TYPES.includes(part.mimetype))
      throw badRequest(`Rasm formati qo'llab-quvvatlanmaydi: ${part.mimetype}`);

    const buffer = await part.toBuffer();
    const { url, thumbUrl } = await saveImage(buffer, 'images');
    saved.push({ url, thumbUrl, order });
    order++;
  }

  if (saved.length === 0) throw badRequest('Rasm yuborilmadi');
  return saved;
}

/** Multipart so'rovdan bitta videoni stream orqali qabul qiladi */
export async function receiveVideoFromRequest(
  req: FastifyRequest,
): Promise<{ url: string; size: number }> {
  const part = await req.file({ limits: { fileSize: MAX_VIDEO_SIZE } });
  if (!part) throw badRequest('Video yuborilmadi');
  if (!ALLOWED_VIDEO_TYPES.includes(part.mimetype))
    throw badRequest(`Video formati qo'llab-quvvatlanmaydi: ${part.mimetype}`);

  const { url, size } = await saveVideoStream(part.file, part.filename);

  // Stream tugagach fayl limitdan oshgan bo'lsa multipart truncated bo'ladi
  if (part.file.truncated) {
    deleteByUrl(url);
    throw badRequest(`Video hajmi ${MAX_VIDEO_SIZE / 1024 / 1024}MB dan oshmasligi kerak`);
  }
  return { url, size };
}

/** Rasm yozuvlari uchun fayllarni diskdan o'chirish */
export function deleteImageFiles(images: { url: string; thumbUrl: string }[]): void {
  for (const img of images) {
    deleteByUrl(img.url);
    deleteByUrl(img.thumbUrl);
  }
}
