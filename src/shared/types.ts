import type {
  UserRole,
  UserStatus,
  DachaStatus,
  BookingStatus,
  PaymentStatus,
  DepositType,
} from './constants.js';

export interface AuthUser {
  id: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser & { firstName?: string; lastName?: string };
}

export interface ZoneDTO {
  id: string;
  slug: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  descUz: string;
  descRu: string;
  descEn: string;
  image: string | null;
  isActive: boolean;
  dachaCount?: number;
}

export interface AmenityDTO {
  id: string;
  icon: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
}

export interface DachaImageDTO {
  id: string;
  url: string;
  thumbUrl: string;
  order: number;
}

export interface DachaVideoDTO {
  id: string;
  url: string;
  size: number;
}

export interface DachaDTO {
  id: string;
  slug: string;
  titleUz: string;
  titleRu: string;
  titleEn: string;
  descUz: string;
  descRu: string;
  descEn: string;
  pricePerDay: number;
  priceWeekend: number | null;
  capacity: number;
  rooms: number;
  area: number | null;
  lat: number;
  lng: number;
  address: string;
  status: DachaStatus;
  rejectionReason?: string | null;
  depositEnabled: boolean;
  depositType: DepositType;
  depositValue: number;
  checkInTime: string;
  checkOutTime: string;
  viewsCount: number;
  zone?: ZoneDTO;
  images: DachaImageDTO[];
  videos: DachaVideoDTO[];
  amenities: AmenityDTO[];
  seller?: { id: string; firstName: string; lastName: string; phone: string; companyName: string | null };
}

export interface BookingDTO {
  id: string;
  code: string;
  dachaId: string;
  guestName: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  totalPrice: number;
  depositAmount: number | null;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  note: string | null;
  createdAt: string;
  dacha?: Pick<DachaDTO, 'id' | 'slug' | 'titleUz' | 'titleRu' | 'titleEn' | 'images'>;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

export interface SiteSettingsDTO {
  phone: string;
  email: string;
  telegram: string;
  instagram: string;
  youtube: string;
  updatedAt?: string;
  /** Payme public konfiguratsiyasi — backend .env dan keladi (kalit emas!) */
  payme?: { merchantId: string; checkoutUrl: string };
}
