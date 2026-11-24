import { GamePlayMode, GameStationType } from '@prisma/client';
import {
  PublicAmenityKey,
  PublicGameCenterDto,
  PublicGameCenterImageDto,
} from '../public-gamecenters/public-gamecenters.types';
import { TextMatchType } from '../../common/utils/searchText';

export interface GameIndexAlias {
  alias: string;
  normalized: string;
  locale: string | null;
}

export interface IndexedCatalogGame {
  id: string;
  slug: string | null;
  title: string;
  titleFa: string | null;
  titleEn: string | null;
  category: string | null;
  genre: string | null;
  description: string | null;
  coverImageUrl: string;
  supportedPlatforms: GameStationType[];
  supportsOnline: boolean;
  popularityScore: number;
  normalizedKey: string | null;
  aliases: GameIndexAlias[];
}

export interface ResolvedGameMatch {
  game: IndexedCatalogGame;
  score: number;
  matchType: TextMatchType;
  matchedTerm: string;
}

export interface MatchedGameStationDto {
  id: string;
  name: string;
  stationType: string;
  isVip: boolean;
  hourlyPrice: number;
  finalPrice: number;
  isActive: boolean;
  isBookable: boolean;
  isAvailableInWindow: boolean | null;
}

export interface MatchedCenterGameDto {
  id: string;
  slug: string | null;
  title: string;
  titleFa: string | null;
  titleEn: string | null;
  category: string | null;
  coverImageUrl: string | null;
  supportsOnline: boolean;
  playMode: GamePlayMode;
  supportedPlatforms: string[];
  availablePlatforms: string[];
  activeStationCount: number;
  bookableStationCount: number;
  matchScore: number;
  matchedTerm: string | null;
  stations: MatchedGameStationDto[];
}

export interface CenterAvailabilitySummaryDto {
  checkedWindow: {
    startTime: string;
    endTime: string;
    durationHours: number;
  } | null;
  totalActiveStations: number;
  matchingActiveStations: number;
  availableMatchingStations: number | null;
  canBookOnline: boolean;
}

export interface SearchRelevanceBreakdownDto {
  totalScore: number;
  textScore: number;
  gameScore: number;
  deviceScore: number;
  geoScore: number;
  credibilityScore: number;
  operationalScore: number;
  matchType: TextMatchType;
}

export interface SearchGameCenterItemDto extends PublicGameCenterDto {
  distanceKm: number | null;
  matchedGames: MatchedCenterGameDto[];
  availabilitySummary: CenterAvailabilitySummaryDto;
  searchRelevance: SearchRelevanceBreakdownDto;
}

export interface SearchFacetBucketDto {
  key: string;
  label: string;
  count: number;
}

export interface SearchFacetsDto {
  cities: SearchFacetBucketDto[];
  deviceTypes: SearchFacetBucketDto[];
  amenities: SearchFacetBucketDto[];
  games: Array<{ id: string; slug: string | null; title: string; titleFa: string | null; count: number }>;
  priceRange: {
    min: number | null;
    max: number | null;
    currency: 'IRT';
  };
  openNowCount: number;
}

export interface ZeroResultSuggestionDto {
  type: 'DID_YOU_MEAN_GAME' | 'RELAX_FILTER' | 'NEARBY_CITY';
  label: string;
  filterKey?: string;
  suggestedValue?: string;
  estimatedCount?: number;
}

export interface SearchGameCentersResponseDto {
  data: SearchGameCenterItemDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  appliedFilters: Record<string, unknown>;
  resolvedGames: Array<{
    id: string;
    slug: string | null;
    title: string;
    titleFa: string | null;
    titleEn: string | null;
    category: string | null;
    matchType: TextMatchType;
    score: number;
  }>;
  facets?: SearchFacetsDto;
  suggestions?: ZeroResultSuggestionDto[];
}

export interface SearchSuggestGameDto {
  id: string;
  slug: string | null;
  title: string;
  titleFa: string | null;
  titleEn: string | null;
  category: string | null;
  coverImageUrl: string | null;
  supportedPlatforms: string[];
  centerCount: number;
  matchType: TextMatchType;
  score: number;
}

export interface SearchSuggestCenterDto {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  neighborhood: string | null;
  coverUrl: string | null;
  ratingAverage: number;
  isOpenNow: boolean;
  detailUrl: string;
  matchType: TextMatchType;
  score: number;
}

export interface SearchSuggestResponseDto {
  query: string;
  games: SearchSuggestGameDto[];
  gameCenters: SearchSuggestCenterDto[];
  locations: {
    cities: Array<{ name: string; count: number }>;
    neighborhoods: Array<{ name: string; city: string; count: number }>;
  };
  devices: Array<{ type: string; label: string }>;
}

export interface SearchCatalogGameItemDto {
  id: string;
  slug: string | null;
  title: string;
  titleFa: string | null;
  titleEn: string | null;
  category: string | null;
  genre: string | null;
  description: string | null;
  coverImageUrl: string;
  supportedPlatforms: string[];
  supportsOnline: boolean;
  popularityScore: number;
  aliases: string[];
  centerCount: number;
  matchScore: number;
}

export type PublicAmenity = PublicAmenityKey;
export type PublicImage = PublicGameCenterImageDto;
