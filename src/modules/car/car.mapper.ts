import type { Prisma } from '@prisma/client';
import type { CarDTO } from '@dacha/shared';
import { zoneDTO } from '../zone/zone.mapper.js';
import { amenityDTO } from '../amenity/amenity.mapper.js';

export const carInclude = {
  zone: true,
  images: { orderBy: { order: 'asc' } },
  videos: { orderBy: { order: 'asc' } },
  amenities: { include: { amenity: true } },
  seller: { include: { sellerProfile: true } },
} satisfies Prisma.CarInclude;

export type CarWithRelations = Prisma.CarGetPayload<{ include: typeof carInclude }>;

export function carDTO(c: CarWithRelations, opts: { includeSeller?: boolean } = {}): CarDTO {
  return {
    id: c.id,
    slug: c.slug,
    titleUz: c.titleUz,
    titleRu: c.titleRu,
    titleEn: c.titleEn,
    descUz: c.descUz,
    descRu: c.descRu,
    descEn: c.descEn,
    brand: c.brand,
    carModel: c.carModel,
    year: c.year,
    seats: c.seats,
    transmission: c.transmission,
    fuelType: c.fuelType,
    driverIncluded: c.driverIncluded,
    routeInfo: c.routeInfo,
    pricePerDay: c.pricePerDay,
    priceWeekend: c.priceWeekend,
    lat: c.lat,
    lng: c.lng,
    address: c.address,
    status: c.status,
    rejectionReason: c.rejectionReason,
    depositEnabled: c.depositEnabled,
    depositType: c.depositType,
    depositValue: c.depositValue,
    viewsCount: c.viewsCount,
    createdAt: c.createdAt,
    zone: c.zone ? zoneDTO(c.zone) : undefined,
    images: c.images.map((i) => ({ id: i.id, url: i.url, thumbUrl: i.thumbUrl, order: i.order })),
    videos: c.videos.map((v) => ({ id: v.id, url: v.url, size: v.size })),
    amenities: c.amenities.map((a) => amenityDTO(a.amenity)),
    seller:
      opts.includeSeller && c.seller?.sellerProfile
        ? {
            id: c.seller.id,
            firstName: c.seller.sellerProfile.firstName,
            lastName: c.seller.sellerProfile.lastName,
            phone: c.seller.phone,
            companyName: c.seller.sellerProfile.companyName,
          }
        : undefined,
  };
}
