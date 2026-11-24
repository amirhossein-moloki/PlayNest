import {
  AllowedDomainRuleType,
  SessionActorType,
  ShortLinkCampaignStatus,
  ShortLinkClickClassification,
  ShortLinkOwnerType,
  ShortLinkStatus,
  ShortLinkTargetCategory,
} from '@prisma/client';
import { QrErrorCorrectionLevel, QrOutputFormat } from './qrCode.generator';

export interface ShortLinkActor {
  id: string;
  actorId: string;
  actorType: SessionActorType;
  gamingCenterId?: string;
  role?: string;
  isSuperuser?: boolean;
}

export interface ShortLinkQrConfig {
  errorCorrectionLevel?: QrErrorCorrectionLevel;
  foreground?: string;
  background?: string;
  margin?: number;
  size?: number;
}

export interface CachedShortLinkPayload {
  id: string;
  code: string;
  normalizedCode: string;
  destinationUrl: string;
  destinationHost: string;
  status: ShortLinkStatus;
  redirectStatusCode: number;
  expiresAt: string | null;
  maxClicks: number | null;
  totalClicks: number;
  deletedAt: string | null;
  gamingCenterId: string | null;
  campaignId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  appendUtmParams: boolean;
  campaign: {
    id: string;
    status: ShortLinkCampaignStatus;
    startsAt: string | null;
    endsAt: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmTerm: string | null;
    utmContent: string | null;
  } | null;
}

export interface ShortLinkClickEventJobData {
  shortLinkId: string;
  campaignId: string | null;
  gamingCenterId: string | null;
  clickedAt: string;
  classification: ShortLinkClickClassification;
  isUniqueVisitor: boolean;
  visitorHash: string;
  deviceType: string;
  os: string;
  browser: string;
  countryCode: string | null;
  region: string | null;
  referrer: string | null;
  referrerDomain: string | null;
  trafficSource: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  botReason: string | null;
}

export interface ShortLinkPublicSummaryDto {
  id: string;
  code: string;
  shortUrl: string;
  isCustomCode: boolean;
  destinationUrl: string;
  destinationHost: string;
  title: string | null;
  description: string | null;
  targetCategory: ShortLinkTargetCategory;
  targetEntityId: string | null;
  ownerType: ShortLinkOwnerType;
  gamingCenterId: string | null;
  ownerUserId: string | null;
  campaignId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  appendUtmParams: boolean;
  status: ShortLinkStatus;
  redirectStatusCode: number;
  expiresAt: Date | null;
  maxClicks: number | null;
  qrConfig: ShortLinkQrConfig | null;
  totalClicks: number;
  validClicks: number;
  uniqueClicks: number;
  duplicateClicks: number;
  botClicks: number;
  suspiciousClicks: number;
  lastClickedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShortLinkDomainRuleDto {
  id: string;
  domain: string;
  ruleType: AllowedDomainRuleType;
  includeSubdomains: boolean;
  isActive: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface QrRequestParams {
  format: QrOutputFormat;
  size: number;
  margin: number;
  ecc: QrErrorCorrectionLevel;
  fg?: string;
  bg?: string;
  download: boolean;
}
