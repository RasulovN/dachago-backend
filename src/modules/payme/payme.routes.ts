import type { FastifyInstance } from 'fastify';
import { verifyPaymeAuth, dispatchPaymeMethod, PaymeRpcError, PaymeError } from './payme.service.js';

/**
 * Payme Merchant API endpoint — JSON-RPC 2.0.
 * Payme serveri shu URL'ga POST yuboradi (webhook/kassa).
 * Har doim HTTP 200 qaytaramiz, xatolar JSON-RPC "error" ichida.
 */
export default async function paymeRoutes(app: FastifyInstance) {
  app.post('/payme', async (req, reply) => {
    const body = req.body as {
      id?: number | string;
      method?: string;
      params?: Record<string, unknown>;
    };
    const rpcId = body?.id ?? null;

    // Auth tekshiruvi
    if (!verifyPaymeAuth(req.headers.authorization)) {
      return reply.send({
        jsonrpc: '2.0',
        id: rpcId,
        error: { code: PaymeError.UNAUTHORIZED.code, message: PaymeError.UNAUTHORIZED.message },
      });
    }

    if (!body?.method) {
      return reply.send({
        jsonrpc: '2.0',
        id: rpcId,
        error: { code: PaymeError.METHOD_NOT_FOUND.code, message: PaymeError.METHOD_NOT_FOUND.message },
      });
    }

    try {
      const result = await dispatchPaymeMethod(body.method, body.params ?? {});
      return reply.send({ jsonrpc: '2.0', id: rpcId, result });
    } catch (err) {
      if (err instanceof PaymeRpcError) {
        return reply.send({
          jsonrpc: '2.0',
          id: rpcId,
          error: {
            code: err.code,
            message: err.rpcMessage,
            ...(err.data ? { data: err.data } : {}),
          },
        });
      }
      app.log.error({ err }, 'Payme ichki xatosi');
      return reply.send({
        jsonrpc: '2.0',
        id: rpcId,
        error: { code: -32400, message: { uz: 'Ichki xato', ru: 'Внутренняя ошибка', en: 'Internal error' } },
      });
    }
  });
}
