import type { AmenityDTO, ListingType } from '@dacha/shared';

export function amenityDTO(a: {
  id: string;
  icon: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  types?: string[];
}): AmenityDTO {
  return {
    id: a.id,
    icon: a.icon,
    nameUz: a.nameUz,
    nameRu: a.nameRu,
    nameEn: a.nameEn,
    types: (a.types ?? []) as ListingType[],
  };
}
