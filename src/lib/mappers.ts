import type { Prisma, Zone } from '@prisma/client';

// --- Zone ---
export function zoneDTO(z: Zone & { _count?: { dachas: number } }) {
  return {
    id: z.id,
    slug: z.slug,
    nameUz: z.nameUz,
    nameRu: z.nameRu,
    nameEn: z.nameEn,
    descUz: z.descUz,
    descRu: z.descRu,
    descEn: z.descEn,
    image: z.image,
    isActive: z.isActive,
    order: z.order,
    dachaCount: z._count?.dachas,
  };
}

export function amenityDTO(a: {
  id: string;
  icon: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
}) {
  return {
    id: a.id,
    icon: a.icon,
    nameUz: a.nameUz,
    nameRu: a.nameRu,
    nameEn: a.nameEn,
  };
}

const dachaInclude = {
  zone: true,
  images: { orderBy: { order: 'asc' } },
  videos: { orderBy: { order: 'asc' } },
  amenities: { include: { amenity: true } },
  seller: { include: { sellerProfile: true } },
} satisfies Prisma.DachaInclude;

export type DachaWithRelations = Prisma.DachaGetPayload<{ include: typeof dachaInclude }>;
export { dachaInclude };

export function dachaDTO(d: DachaWithRelations, opts: { includeSeller?: boolean } = {}) {
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

export function bookingDTO(b: {
  id: string;
  code: string;
  dachaId: string;
  guestName: string;
  guestPhone: string;
  checkIn: Date;
  checkOut: Date;
  guestsCount: number;
  totalPrice: number;
  depositAmount: number | null;
  status: string;
  paymentStatus: string;
  note: string | null;
  createdAt: Date;
  dacha?: {
    id: string;
    slug: string;
    titleUz: string;
    titleRu: string;
    titleEn: string;
    images?: { id: string; url: string; thumbUrl: string; order: number }[];
  } | null;
}) {
  return {
    id: b.id,
    code: b.code,
    dachaId: b.dachaId,
    guestName: b.guestName,
    guestPhone: b.guestPhone,
    checkIn: b.checkIn.toISOString(),
    checkOut: b.checkOut.toISOString(),
    guestsCount: b.guestsCount,
    totalPrice: b.totalPrice,
    depositAmount: b.depositAmount,
    status: b.status,
    paymentStatus: b.paymentStatus,
    note: b.note,
    createdAt: b.createdAt.toISOString(),
    dacha: b.dacha
      ? {
          id: b.dacha.id,
          slug: b.dacha.slug,
          titleUz: b.dacha.titleUz,
          titleRu: b.dacha.titleRu,
          titleEn: b.dacha.titleEn,
          images: b.dacha.images ?? [],
        }
      : undefined,
  };
}
