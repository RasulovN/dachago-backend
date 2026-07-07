import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { env } from '../config/env.js';
import { unauthorized, forbidden } from '../common/errors.js';
import type { UserRole } from '@dacha/shared';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      ...roles: UserRole[]
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    authUser?: { id: string; phone: string; role: UserRole; status: string };
  }
}

interface AccessPayload {
  sub: string;
  phone: string;
  role: UserRole;
  status: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessPayload;
    user: AccessPayload;
  }
}

export default fp(async (app) => {
  // Access token JWT'lari uchun (refresh tokenlar DB'da opaque saqlanadi)
  await app.register(fastifyJwt, {
    secret: env.jwt.accessSecret,
    sign: { expiresIn: env.jwt.accessTtl },
  });

  app.decorate('authenticate', async (req: FastifyRequest) => {
    try {
      const payload = await req.jwtVerify<AccessPayload>();
      req.authUser = {
        id: payload.sub,
        phone: payload.phone,
        role: payload.role,
        status: payload.status,
      };
    } catch {
      throw unauthorized('Token yaroqsiz yoki muddati o\'tgan');
    }
  });

  app.decorate('requireRole', (...roles: UserRole[]) => {
    return async (req: FastifyRequest) => {
      if (!req.authUser) throw unauthorized();
      if (!roles.includes(req.authUser.role)) throw forbidden('Bu amal uchun ruxsat yo\'q');
    };
  });
});
