import type { Prisma } from '@prisma/client';
import { prisma } from '../../common/prisma.js';
import { dachaInclude } from './dacha.mapper.js';

/** Saytda ko'rinadigan dacha sharti: ACTIVE va egasi APPROVED */
export const visibleDachaWhere = {
  status: 'ACTIVE',
  seller: { status: 'APPROVED' },
} as const;

export const dachaRepository = {
  findMany(args: { where: Prisma.DachaWhereInput; orderBy: Prisma.DachaOrderByWithRelationInput; skip: number; take: number }) {
    return prisma.dacha.findMany({ ...args, include: dachaInclude });
  },
  count(where: Prisma.DachaWhereInput) {
    return prisma.dacha.count({ where });
  },
  findBySlug(slug: string) {
    return prisma.dacha.findUnique({ where: { slug }, include: dachaInclude });
  },
  findById(id: string) {
    return prisma.dacha.findUnique({ where: { id } });
  },
  findByIdFull(id: string) {
    return prisma.dacha.findUnique({ where: { id }, include: dachaInclude });
  },
  listBySeller(sellerId: string) {
    return prisma.dacha.findMany({
      where: { sellerId },
      include: dachaInclude,
      orderBy: { createdAt: 'desc' },
    });
  },
  listAll(status?: string) {
    return prisma.dacha.findMany({
      where: status ? { status: status as never } : {},
      include: dachaInclude,
      orderBy: { createdAt: 'desc' },
    });
  },
  create(data: Prisma.DachaCreateInput | Prisma.DachaUncheckedCreateInput) {
    return prisma.dacha.create({ data: data as Prisma.DachaUncheckedCreateInput, include: dachaInclude });
  },
  update(id: string, data: Prisma.DachaUncheckedUpdateInput) {
    return prisma.dacha.update({ where: { id }, data, include: dachaInclude });
  },
  remove(id: string) {
    return prisma.dacha.delete({ where: { id } });
  },
  incrementViews(id: string) {
    return prisma.dacha.update({ where: { id }, data: { viewsCount: { increment: 1 } } });
  },
  mediaOf(id: string) {
    return prisma.dacha.findUnique({
      where: { id },
      include: { images: true, videos: true },
    });
  },
};
