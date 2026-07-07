import type { Prisma } from '@prisma/client';
import type { HotelDTO, HotelRoomDTO } from '@dacha/shared';
import { zoneDTO } from '../zone/zone.mapper.js';
import { amenityDTO } from '../amenity/amenity.mapper.js';

export const hotelInclude = {
  zone: true,
  images: { orderBy: { order: 'asc' } },
  videos: { orderBy: { order: 'asc' } },
  amenities: { include: { amenity: true } },
  rooms: { orderBy: { pricePerNight: 'asc' } },
  seller: { include: { sellerProfile: true } },
} satisfies Prisma.HotelInclude;

export type HotelWithRelations = Prisma.HotelGetPayload<{ include: typeof hotelInclude }>;

export function hotelRoomDTO(r: {
  id: string;
  hotelId: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  capacity: number;
  pricePerNight: number;
  priceWeekend: number | null;
  totalRooms: number;
  area: number | null;
}): HotelRoomDTO {
  return {
    id: r.id,
    hotelId: r.hotelId,
    nameUz: r.nameUz,
    nameRu: r.nameRu,
    nameEn: r.nameEn,
    capacity: r.capacity,
    pricePerNight: r.pricePerNight,
    priceWeekend: r.priceWeekend,
    totalRooms: r.totalRooms,
    area: r.area,
  };
}

export function hotelDTO(h: HotelWithRelations, opts: { includeSeller?: boolean } = {}): HotelDTO {
  return {
    id: h.id,
    slug: h.slug,
    titleUz: h.titleUz,
    titleRu: h.titleRu,
    titleEn: h.titleEn,
    descUz: h.descUz,
    descRu: h.descRu,
    descEn: h.descEn,
    starRating: h.starRating,
    breakfastIncluded: h.breakfastIncluded,
    hasConference: h.hasConference,
    priceFrom: h.priceFrom,
    lat: h.lat,
    lng: h.lng,
    address: h.address,
    status: h.status,
    rejectionReason: h.rejectionReason,
    depositEnabled: h.depositEnabled,
    depositType: h.depositType,
    depositValue: h.depositValue,
    checkInTime: h.checkInTime,
    checkOutTime: h.checkOutTime,
    viewsCount: h.viewsCount,
    createdAt: h.createdAt,
    zone: h.zone ? zoneDTO(h.zone) : undefined,
    rooms: h.rooms.map(hotelRoomDTO),
    images: h.images.map((i) => ({ id: i.id, url: i.url, thumbUrl: i.thumbUrl, order: i.order })),
    videos: h.videos.map((v) => ({ id: v.id, url: v.url, size: v.size })),
    amenities: h.amenities.map((a) => amenityDTO(a.amenity)),
    seller:
      opts.includeSeller && h.seller?.sellerProfile
        ? {
            id: h.seller.id,
            firstName: h.seller.sellerProfile.firstName,
            lastName: h.seller.sellerProfile.lastName,
            phone: h.seller.phone,
            companyName: h.seller.sellerProfile.companyName,
          }
        : undefined,
  };
}
