import type { FastifyInstance } from 'fastify';
import { translateSchema } from '@dacha/shared';
import type { Locale } from '@dacha/shared';

/**
 * Bepul tarjima — ikki bosqichli zanjir (API kalitsiz):
 *   1) Google Translate "gtx" endpointi (tez va sifatli)
 *   2) MyMemory API (Google ishlamasa/bloklangan bo'lsa zaxira)
 * Ikkalasi ham ishlamasa graceful fallback: ok:false + bo'sh natija
 * qaytadi va frontend o'zbekcha matnni ko'chirib davom etadi.
 */

const TIMEOUT_MS = 7000;

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** 1-usul: translate.googleapis.com (client=gtx) — bepul, kalitsiz */
async function viaGoogle(text: string, from: string, to: string): Promise<string> {
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t` +
    `&sl=${from}&tl=${to}&q=${encodeURIComponent(text)}`;
  const data = (await fetchJson(url)) as unknown[][];
  // Javob: [[["tarjima","original",...], ...], ...] — segmentlarni yig'amiz
  const out = (Array.isArray(data?.[0]) ? data[0] : [])
    .map((seg) => (Array.isArray(seg) ? String(seg[0] ?? '') : ''))
    .join('');
  if (!out.trim()) throw new Error('bo\'sh natija');
  return out.trim();
}

/** 2-usul (zaxira): MyMemory — bepul, kuniga ~5000 belgi (anonim) */
async function viaMyMemory(text: string, from: string, to: string): Promise<string> {
  const url =
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}` +
    `&langpair=${from}|${to}`;
  const data = (await fetchJson(url)) as {
    responseStatus?: number | string;
    responseData?: { translatedText?: string };
  };
  const out = (data.responseData?.translatedText ?? '').trim();
  if (Number(data.responseStatus) !== 200 || !out || out.toUpperCase().includes('MYMEMORY WARNING'))
    throw new Error('mymemory xatosi');
  return out;
}

async function translateOne(text: string, from: string, to: string): Promise<string> {
  try {
    return await viaGoogle(text, from, to);
  } catch {
    return viaMyMemory(text, from, to);
  }
}

export default async function translateRoutes(app: FastifyInstance) {
  app.post(
    '/translate',
    {
      preHandler: [app.authenticate],
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (req) => {
      const data = translateSchema.parse(req.body);
      const result: Record<string, string> = {};
      const failed: Locale[] = [];

      // Tillar parallel tarjima qilinadi — forma saqlashi tezlashadi
      await Promise.all(
        data.to.map(async (target) => {
          if (target === data.from) {
            result[target] = data.text;
            return;
          }
          try {
            result[target] = await translateOne(data.text, data.from, target);
          } catch (err) {
            app.log.warn({ err, target }, 'tarjima xatosi');
            result[target] = '';
            failed.push(target);
          }
        }),
      );

      return {
        ok: failed.length === 0,
        translations: result,
        failed,
        message: failed.length
          ? 'Ba\'zi tillar tarjima qilinmadi, iltimos qo\'lda kiriting'
          : undefined,
      };
    },
  );
}
