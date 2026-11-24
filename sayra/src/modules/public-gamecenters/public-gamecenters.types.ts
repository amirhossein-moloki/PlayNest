export type PublicAmenityKey =
  | 'food_service'
  | 'vip'
  | 'online_booking'
  | 'online_games'
  | 'extra_controllers';

export type PublicGameCenterStatusFilter = 'active' | 'open_now';

export type PublicGameCenterRankingSort =
  | 'bayesian'
  | 'rating'
  | 'reviews'
  | 'newest'
  | 'price_asc'
  | 'price_desc';

export interface PublicGameCenterImageDto {
  url: string;
  thumbUrl: string | null;
  altText: string | null;
  purpose: string;
}

export interface PublicGameCenterDeviceSummaryDto {
  type: string;
  count: number;
  minHourlyPrice: number | null;
  hasVip: boolean;
}

export interface PublicGameCenterDeviceCountsDto {
  PC: number;
  'PLAYSTATION 4': number;
  'PLAYSTATION 5': number;
  XBOX: number;
  SWITCH: number;
  VR: number;
}

export interface PublicGameCenterRatingSummaryDto {
  average: number;
  validReviewsCount: number;
  latestReviewAt: string | null;
}

export interface PublicGameCenterRankingInfoDto {
  bayesianScore: number;
  rawAverageR: number;
  validReviewsCountV: number;
  globalAverageC: number;
  m: number;
  minReviews: number;
  isEligibleForRanking: boolean;
  rank: number | null;
}

export interface PublicGameCenterActivityStatusDto {
  isActive: true;
  isOpenNow: boolean;
  openingTime: string | null;
  closingTime: string | null;
  timezone: string;
  isTemporarilyClosed: boolean;
  closedUntil: string | null;
}

export interface PublicGameCenterPricingDto {
  startingHourlyRate: number;
  originalPrice: number;
  finalPrice: number;
  hasDiscount: boolean;
  discountPercentage: number;
  discountAmount: number;
  currency: 'IRT';
}

export interface PublicGameCenterDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  province: string | null;
  neighborhood: string | null;
  address: string | null;
  coordinates: {
    lat: number;
    lng: number;
  } | null;
  images: {
    coverUrl: string | null;
    gallery: PublicGameCenterImageDto[];
  };
  devices: PublicGameCenterDeviceSummaryDto[];
  deviceCounts: PublicGameCenterDeviceCountsDto;
  pcCount: number;
  consoleCount: number;
  amenities: PublicAmenityKey[];
  games: string[];
  pricing: PublicGameCenterPricingDto;
  activityStatus: PublicGameCenterActivityStatusDto;
  rating: PublicGameCenterRatingSummaryDto;
  ranking: PublicGameCenterRankingInfoDto | null;
  detailUrl: string;
  absoluteDetailUrl: string;
  updatedAt: string;
}

export interface PublicGameCenterRankingMethodologyDto {
  algorithm: 'bayesian_average';
  formula: '(v / (v + m)) * R + (m / (v + m)) * C';
  m: number;
  minReviews: number;
  globalAverageC: number;
  scopeTotalValidReviews: number;
  scope: {
    city: string | null;
    neighborhood: string | null;
    deviceType: string | null;
    amenities: PublicAmenityKey[];
  };
  sort: PublicGameCenterRankingSort;
  rankedCount: number;
  newlyRegisteredCount: number;
  calculatedAt: string;
}

export interface PublicGameCenterRankingsResponseDto {
  ranked: PublicGameCenterDto[];
  newlyRegistered: PublicGameCenterDto[];
  methodology: PublicGameCenterRankingMethodologyDto;
}
