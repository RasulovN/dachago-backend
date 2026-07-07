import type {
  UserRole,
  UserStatus,
  ListingStatus,
  BookingStatus,
  PaymentStatus,
  DepositType,
  ListingType,
  Transmission,
  FuelType,
} from './constants.js';

/* ==================== Umumiy ==================== */

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
  hotelCount?: number;
  carCount?: number;
}

export interface AmenityDTO {
  id: string;
  icon: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  types: ListingType[];
}

export interface MediaImageDTO {
  id: string;
  url: string;
  thumbUrl: string;
  order: number;
}

export interface MediaVideoDTO {
  id: string;
  url: string;
  size: number;
}

export interface ListingSellerDTO {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string | null;
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

/* ==================== Dacha moduli ==================== */

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
  status: ListingStatus;
  rejectionReason?: string | null;
  depositEnabled: boolean;
  depositType: DepositType;
  depositValue: number;
  checkInTime: string;
  checkOutTime: string;
  viewsCount: number;
  createdAt?: string | Date;
  zone?: ZoneDTO;
  images: MediaImageDTO[];
  videos: MediaVideoDTO[];
  amenities: AmenityDTO[];
  seller?: ListingSellerDTO;
}

/* ==================== Hotel moduli ==================== */

export interface HotelRoomDTO {
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
}

export interface HotelDTO {
  id: string;
  slug: string;
  titleUz: string;
  titleRu: string;
  titleEn: string;
  descUz: string;
  descRu: string;
  descEn: string;
  starRating: number;
  breakfastIncluded: boolean;
  hasConference: boolean;
  priceFrom: number;
  lat: number;
  lng: number;
  address: string;
  status: ListingStatus;
  rejectionReason?: string | null;
  depositEnabled: boolean;
  depositType: DepositType;
  depositValue: number;
  checkInTime: string;
  checkOutTime: string;
  viewsCount: number;
  createdAt?: string | Date;
  zone?: ZoneDTO;
  rooms: HotelRoomDTO[];
  images: MediaImageDTO[];
  videos: MediaVideoDTO[];
  amenities: AmenityDTO[];
  seller?: ListingSellerDTO;
}

/* ==================== Car moduli ==================== */

export interface CarDTO {
  id: string;
  slug: string;
  titleUz: string;
  titleRu: string;
  titleEn: string;
  descUz: string;
  descRu: string;
  descEn: string;
  brand: string;
  carModel: string;
  year: number;
  seats: number;
  transmission: Transmission;
  fuelType: FuelType;
  driverIncluded: boolean;
  routeInfo: string | null;
  pricePerDay: number;
  priceWeekend: number | null;
  lat: number;
  lng: number;
  address: string;
  status: ListingStatus;
  rejectionReason?: string | null;
  depositEnabled: boolean;
  depositType: DepositType;
  depositValue: number;
  viewsCount: number;
  createdAt?: string | Date;
  zone?: ZoneDTO;
  images: MediaImageDTO[];
  videos: MediaVideoDTO[];
  amenities: AmenityDTO[];
  seller?: ListingSellerDTO;
}

/* ==================== Booking (umumiy) ==================== */

/** Bron qaysi e'longa tegishli — turi bilan qisqa ma'lumot */
export interface BookingListingRefDTO {
  type: ListingType;
  id: string;
  slug: string;
  titleUz: string;
  titleRu: string;
  titleEn: string;
  image: string | null;
  /** Faqat mehmonxona bronida: xona nomi */
  roomNameUz?: string;
  roomNameRu?: string;
  roomNameEn?: string;
}

export interface BookingDTO {
  id: string;
  code: string;
  listingType: ListingType;
  guestName: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  roomsCount: number;
  totalPrice: number;
  depositAmount: number | null;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  note: string | null;
  createdAt: string;
  listing?: BookingListingRefDTO;
}

/* ==================== Birlashgan katalog kartasi ==================== */

export interface ListingCardDTO {
  type: ListingType;
  id: string;
  slug: string;
  titleUz: string;
  titleRu: string;
  titleEn: string;
  price: number;
  image: string | null;
  zone?: ZoneDTO;
  createdAt?: string | Date;
  viewsCount?: number;
  // Dacha
  capacity?: number;
  rooms?: number;
  // Hotel
  starRating?: number;
  // Car
  brand?: string;
  carModel?: string;
  seats?: number;
}
