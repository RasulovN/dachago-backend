import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';
import { nanoid } from 'nanoid';
import { env } from '../config/env.js';

/**
 * Lokal disk storage. Barcha yo'llar env.uploadDir ostida saqlanadi.
 * Keyinchalik S3'ga o'tish uchun faqat shu modulni almashtirish yetarli.
 */

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function subDir(kind: 'images' | 'videos' | 'zones' | 'avatars'): string {
  const dir = path.join(env.uploadDir, kind);
  ensureDir(dir);
  return dir;
}

/** Public URL yasash (nisbiy yo'ldan) */
export function publicUrl(relativePath: string): string {
  return `${env.publicBaseUrl}/uploads/${relativePath.replace(/\\/g, '/')}`;
}

/**
 * Rasmni saqlaydi: optimallashtirilgan asosiy versiya (max 1600px webp)
 * va thumbnail (400px webp). Buffer'dan ishlaydi.
 */
export async function saveImage(
  buffer: Buffer,
  kind: 'images' | 'zones' | 'avatars' = 'images',
): Promise<{ url: string; thumbUrl: string }> {
  const dir = subDir(kind);
  const id = nanoid();
  const mainName = `${id}.webp`;
  const thumbName = `${id}_thumb.webp`;

  await sharp(buffer)
    .rotate()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(dir, mainName));

  await sharp(buffer)
    .rotate()
    .resize(400, 400, { fit: 'cover' })
    .webp({ quality: 72 })
    .toFile(path.join(dir, thumbName));

  return {
    url: publicUrl(`${kind}/${mainName}`),
    thumbUrl: publicUrl(`${kind}/${thumbName}`),
  };
}

/**
 * Videoni stream orqali diskka yozadi (xotirani to'ldirmasdan).
 * Fayl kengaytmasini saqlaydi.
 */
export async function saveVideoStream(
  fileStream: NodeJS.ReadableStream & { truncated?: boolean },
  originalName: string,
): Promise<{ url: string; fullPath: string; size: number }> {
  const dir = subDir('videos');
  const ext = path.extname(originalName) || '.mp4';
  const name = `${nanoid()}${ext}`;
  const dest = path.join(dir, name);
  await pipeline(fileStream, fs.createWriteStream(dest));
  const size = fs.existsSync(dest) ? fs.statSync(dest).size : 0;
  return {
    url: publicUrl(`videos/${name}`),
    fullPath: dest,
    size,
  };
}

/** URL'dan fayl o'chirish (public URL yoki nisbiy yo'l) */
export function deleteByUrl(url: string): void {
  try {
    const marker = '/uploads/';
    const idx = url.indexOf(marker);
    const rel = idx >= 0 ? url.slice(idx + marker.length) : url;
    const full = path.join(env.uploadDir, rel);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch {
    // fayl allaqachon yo'q — e'tiborsiz qoldiramiz
  }
}

export function initStorage(): void {
  ensureDir(env.uploadDir);
  (['images', 'videos', 'zones', 'avatars'] as const).forEach(subDir);
}
