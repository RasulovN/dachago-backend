import type { Prisma } from '@prisma/client';
import type { DachaDTO } from '@dacha/shared';
import { zoneDTO } from '../zone/zone.mapper.js';
import { amenityDTO } from '../amenity/amenity.mapper.js';

export const dachaInclude = {
  zone: true,
  images: { orderBy: { order: 'asc' } },
  videos: { orderBy: { order: 'asc' } },
  amenities: { include: { amenity: true } },
  seller: { include: { sellerProfile: true } },
} satisfies Prisma.DachaInclude;

export type DachaWithRelations = Prisma.DachaGetPayload<{ include: typeof dachaInclude }>;

export function dachaDTO(d: DachaWithRelations, opts: { includeSeller?: boolean } = {}): DachaDTO {
  return {
    id: d.id,
    slug: d.slug,
    titleUz: d.titleUz,
    titleRu: d.titleRu,
    titleEn: d.titleEn,
    descUz: d.descUz,
    descRu: d.descRu,
    descEn: d.descEn,
    pricePerDay: d.pricePerDay,
    priceWeekend: d.priceWeekend,
    capacity: d.capacity,
    rooms: d.rooms,
    area: d.area,
    lat: d.lat,
    lng: d.lng,
    address: d.address,
    status: d.status,
    rejectionReason: d.rejectionReason,
    depositEnabled: d.depositEnabled,
    depositType: d.depositType,
    depositValue: d.depositValue,
    checkInTime: d.checkInTime,
    checkOutTime: d.checkOutTime,
    viewsCount: d.viewsCount,
    createdAt: d.createdAt,
    zone: d.zone ? zoneDTO(d.zone) : undefined,
    images: d.images.map((i) => ({ id: i.id, url: i.url, thumbUrl: i.thumbUrl, order: i.order })),
    videos: d.videos.map((v) => ({ id: v.id, url: v.url, size: v.size })),
    amenities: d.amenities.map((a) => amenityDTO(a.amenity)),
    seller:
      opts.includeSeller && d.seller?.sellerProfile
        ? {
            id: d.seller.id,
            firstName: d.seller.sellerProfile.firstName,
            lastName: d.seller.sellerProfile.lastName,
            phone: d.seller.phone,
            companyName: d.seller.sellerProfile.companyName,
          }
        : undefined,
  };
}
