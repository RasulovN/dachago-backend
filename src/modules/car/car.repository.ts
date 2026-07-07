import type { Prisma } from '@prisma/client';
import { prisma } from '../../common/prisma.js';
import { carInclude } from './car.mapper.js';

/** Saytda ko'rinadigan avto sharti: ACTIVE va egasi APPROVED */
export const visibleCarWhere = {
  status: 'ACTIVE',
  seller: { status: 'APPROVED' },
} as const;

export const carRepository = {
  findMany(args: { where: Prisma.CarWhereInput; orderBy: Prisma.CarOrderByWithRelationInput; skip: number; take: number }) {
    return prisma.car.findMany({ ...args, include: carInclude });
  },
  count(where: Prisma.CarWhereInput) {
    return prisma.car.count({ where });
  },
  findBySlug(slug: string) {
    return prisma.car.findUnique({ where: { slug }, include: carInclude });
  },
  findById(id: string) {
    return prisma.car.findUnique({ where: { id } });
  },
  findByIdFull(id: string) {
    return prisma.car.findUnique({ where: { id }, include: carInclude });
  },
  listBySeller(sellerId: string) {
    return prisma.car.findMany({
      where: { sellerId },
      include: carInclude,
      orderBy: { createdAt: 'desc' },
    });
  },
  listAll(status?: string) {
    return prisma.car.findMany({
      where: status ? { status: status as never } : {},
      include: carInclude,
      orderBy: { createdAt: 'desc' },
    });
  },
  create(data: Prisma.CarUncheckedCreateInput) {
    return prisma.car.create({ data, include: carInclude });
  },
  update(id: string, data: Prisma.CarUncheckedUpdateInput) {
    return prisma.car.update({ where: { id }, data, include: carInclude });
  },
  remove(id: string) {
    return prisma.car.delete({ where: { id } });
  },
  incrementViews(id: string) {
    return prisma.car.update({ where: { id }, data: { viewsCount: { increment: 1 } } });
  },
  imagesOf(id: string) {
    return prisma.carImage.findMany({ where: { carId: id } });
  },
  videosOf(id: string) {
    return prisma.carVideo.findMany({ where: { carId: id } });
  },
  /** Faol brendlar ro'yxati (filtr uchun) */
  async distinctBrands() {
    const rows = await prisma.car.findMany({
      where: visibleCarWhere,
      select: { brand: true },
      distinct: ['brand'],
      orderBy: { brand: 'asc' },
    });
    return rows.map((r) => r.brand);
  },
};
