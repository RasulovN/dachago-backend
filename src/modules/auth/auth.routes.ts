import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';
import { nanoid } from 'nanoid';
import { registerSchema, loginSchema } from '@dacha/shared';
import { prisma } from '../../common/prisma.js';
import { badRequest, conflict, unauthorized, forbidden } from '../../common/errors.js';
import { env } from '../../config/env.js';

function refreshExpiry(): Date {
  // JWT_REFRESH_TTL "30d" ko'rinishida — kunlarni ajratamiz
  const m = /^(\d+)d$/.exec(env.jwt.refreshTtl);
  const days = m ? Number(m[1]) : 30;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function issueTokens(
  app: FastifyInstance,
  user: { id: string; phone: string; role: string; status: string },
) {
  const accessToken = app.jwt.sign({
    sub: user.id,
    phone: user.phone,
    role: user.role as never,
    status: user.status,
  });
  const refreshToken = nanoid(48);
  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiry() },
  });
  return { accessToken, refreshToken };
}

export default async function authRoutes(app: FastifyInstance) {
  // Seller ro'yxatdan o'tishi — status PENDING, super admin tasdig'ini kutadi
  app.post('/register', async (req) => {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (existing) throw conflict('Bu telefon raqami allaqachon ro\'yxatdan o\'tgan');

    const passwordHash = await argon2.hash(data.password);

    const user = await prisma.user.create({
      data: {
        phone: data.phone,
        email: data.email || null,
        password: passwordHash,
        role: 'SELLER',
        status: 'PENDING',
        sellerProfile: {
          create: {
            firstName: data.firstName,
            lastName: data.lastName,
            companyName: data.companyName || null,
            passportInfo: data.passportInfo,
            address: data.address,
          },
        },
      },
    });

    return {
      ok: true,
      message: 'Arizangiz qabul qilindi. Super admin tasdiqlagach tizimga kira olasiz.',
      userId: user.id,
    };
  });

  app.post('/login', async (req) => {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { phone: data.phone },
      include: { sellerProfile: true },
    });
    if (!user) throw unauthorized('Telefon yoki parol noto\'g\'ri');

    const valid = await argon2.verify(user.password, data.password);
    if (!valid) throw unauthorized('Telefon yoki parol noto\'g\'ri');

    if (user.status === 'PENDING')
      throw forbidden('Arizangiz hali tasdiqlanmagan. Iltimos, kuting.');
    if (user.status === 'REJECTED')
      throw forbidden(
        user.sellerProfile?.rejectionReason
          ? `Arizangiz rad etilgan: ${user.sellerProfile.rejectionReason}`
          : 'Arizangiz rad etilgan.',
      );
    if (user.status === 'BLOCKED') throw forbidden('Hisobingiz bloklangan.');

    const tokens = await issueTokens(app, user);
    return {
      ...tokens,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        status: user.status,
        firstName: user.sellerProfile?.firstName,
        lastName: user.sellerProfile?.lastName,
      },
    };
  });

  app.post('/refresh', async (req) => {
    const body = req.body as { refreshToken?: string };
    if (!body?.refreshToken) throw badRequest('refreshToken talab qilinadi');

    const stored = await prisma.refreshToken.findUnique({
      where: { token: body.refreshToken },
      include: { user: { include: { sellerProfile: true } } },
    });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => {});
      throw unauthorized('Refresh token yaroqsiz yoki muddati o\'tgan');
    }
    if (stored.user.status === 'BLOCKED') throw forbidden('Hisobingiz bloklangan.');

    // Rotatsiya: eski tokenni o'chirib yangisini beramiz
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    const tokens = await issueTokens(app, stored.user);
    return {
      ...tokens,
      user: {
        id: stored.user.id,
        phone: stored.user.phone,
        role: stored.user.role,
        status: stored.user.status,
        firstName: stored.user.sellerProfile?.firstName,
        lastName: stored.user.sellerProfile?.lastName,
      },
    };
  });

  app.post('/logout', async (req) => {
    const body = req.body as { refreshToken?: string };
    if (body?.refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: body.refreshToken } });
    }
    return { ok: true };
  });

  // Joriy foydalanuvchi ma'lumoti
  app.get('/me', { preHandler: [app.authenticate] }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.authUser!.id },
      include: { sellerProfile: true },
    });
    if (!user) throw unauthorized();
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      status: user.status,
      profile: user.sellerProfile,
    };
  });
}
