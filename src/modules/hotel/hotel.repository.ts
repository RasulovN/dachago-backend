import type { Prisma } from '@prisma/client';
import { prisma } from '../../common/prisma.js';
import { hotelInclude } from './hotel.mapper.js';

/** Saytda ko'rinadigan mehmonxona sharti: ACTIVE va egasi APPROVED */
export const visibleHotelWhere = {
  status: 'ACTIVE',
  seller: { status: 'APPROVED' },
} as const;

export const hotelRepository = {
  findMany(args: { where: Prisma.HotelWhereInput; orderBy: Prisma.HotelOrderByWithRelationInput; skip: number; take: number }) {
    return prisma.hotel.findMany({ ...args, include: hotelInclude });
  },
  count(where: Prisma.HotelWhereInput) {
    return prisma.hotel.count({ where });
  },
  findBySlug(slug: string) {
    return prisma.hotel.findUnique({ where: { slug }, include: hotelInclude });
  },
  findById(id: string) {
    return prisma.hotel.findUnique({ where: { id } });
  },
  findByIdFull(id: string) {
    return prisma.hotel.findUnique({ where: { id }, include: hotelInclude });
  },
  listBySeller(sellerId: string) {
    return prisma.hotel.findMany({
      where: { sellerId },
      include: hotelInclude,
      orderBy: { createdAt: 'desc' },
    });
  },
  listAll(status?: string) {
    return prisma.hotel.findMany({
      where: status ? { status: status as never } : {},
      include: hotelInclude,
      orderBy: { createdAt: 'desc' },
    });
  },
  create(data: Prisma.HotelUncheckedCreateInput) {
    return prisma.hotel.create({ data, include: hotelInclude });
  },
  update(id: string, data: Prisma.HotelUncheckedUpdateInput) {
    return prisma.hotel.update({ where: { id }, data, include: hotelInclude });
  },
  remove(id: string) {
    return prisma.hotel.delete({ where: { id } });
  },
  incrementViews(id: string) {
    return prisma.hotel.update({ where: { id }, data: { viewsCount: { increment: 1 } } });
  },
  imagesOf(id: string) {
    return prisma.hotelImage.findMany({ where: { hotelId: id } });
  },
  videosOf(id: string) {
    return prisma.hotelVideo.findMany({ where: { hotelId: id } });
  },
  // --- Xonalar ---
  findRoom(roomId: string) {
    return prisma.hotelRoom.findUnique({ where: { id: roomId }, include: { hotel: true } });
  },
  createRoom(hotelId: string, data: Omit<Prisma.HotelRoomUncheckedCreateInput, 'hotelId'>) {
    return prisma.hotelRoom.create({ data: { ...data, hotelId } });
  },
  updateRoom(roomId: string, data: Prisma.HotelRoomUncheckedUpdateInput) {
    return prisma.hotelRoom.update({ where: { id: roomId }, data });
  },
  removeRoom(roomId: string) {
    return prisma.hotelRoom.delete({ where: { id: roomId } });
  },
  /** priceFrom (eng arzon xona narxi) ni qayta hisoblaydi */
  async recalcPriceFrom(hotelId: string) {
    const min = await prisma.hotelRoom.aggregate({
      where: { hotelId },
      _min: { pricePerNight: true },
    });
    await prisma.hotel.update({
      where: { id: hotelId },
      data: { priceFrom: min._min.pricePerNight ?? 0 },
    });
  },
};
