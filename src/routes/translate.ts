import type { FastifyInstance } from 'fastify';
import { translate } from '@vitalets/google-translate-api';
import { translateSchema } from '@dacha/shared';
import type { Locale } from '@dacha/shared';

/**
 * Bepul Google Translate kutubxonasi orqali tarjima.
 * Rate-limit yoki tarmoq xatosida graceful fallback: original matn qaytadi
 * va ok:false bilan belgilanadi (frontend qo'lda kiritishni taklif qiladi).
 */
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

      for (const target of data.to) {
        if (target === data.from) {
          result[target] = data.text;
          continue;
        }
        try {
          const res = await translate(data.text, { from: data.from, to: target });
          result[target] = res.text;
        } catch (err) {
          app.log.warn({ err }, 'tarjima xatosi');
          result[target] = '';
          failed.push(target);
        }
      }

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
