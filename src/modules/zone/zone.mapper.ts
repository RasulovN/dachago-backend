import type { Zone } from '@prisma/client';
import type { ZoneDTO } from '@dacha/shared';

type ZoneWithCounts = Zone & {
  _count?: { dachas?: number; hotels?: number; cars?: number };
};

export function zoneDTO(z: ZoneWithCounts): ZoneDTO {
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
    dachaCount: z._count?.dachas,
    hotelCount: z._count?.hotels,
    carCount: z._count?.cars,
  };
}
