import { GameStationType } from '@prisma/client';

const ARABIC_CHAR_MAP: Record<string, string> = {
  '\u064a': '\u06cc', // ي -> ی
  '\u0649': '\u06cc', // ى -> ی
  '\u0626': '\u06cc', // ئ -> ی
  '\u0643': '\u06a9', // ك -> ک
  '\u0629': '\u0647', // ة -> ه
  '\u06c0': '\u0647', // ۀ -> ه
  '\u0623': '\u0627', // أ -> ا
  '\u0625': '\u0627', // إ -> ا
  '\u0622': '\u0627', // آ -> ا
  '\u0624': '\u0648', // ؤ -> و
};

const PERSIAN_TO_ARABIC_CHARS: Record<string, string> = {
  '\u06cc': '\u064a', // ی -> ي
  '\u06a9': '\u0643', // ک -> ك
};

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

const COMPOUND_ZWNJ_WORDS: Array<[string, string]> = [
  ['گیم نت', 'گیم\u200cنت'],
  ['گیمنت', 'گیم\u200cنت'],
  ['گیم سنتر', 'گیم\u200cسنتر'],
  ['پلی استیشن', 'پلی\u200cاستیشن'],
  ['ایکس باکس', 'ایکس\u200cباکس'],
  ['می باشد', 'می\u200cباشد'],
];

/**
 * Normalizes Persian, Arabic, and English text for search matching:
 * - Unifies Arabic characters (ي, ك, ة, أ, إ, آ, ئ, ى) to Persian equivalents
 * - Strips Arabic diacritics/tashkeel and tatweel
 * - Converts Persian and Arabic-Indic digits to ASCII digits
 * - Replaces ZWNJ and punctuation with single spaces, lowercases Latin text
 */
export function normalizeSearchText(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let result = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const code = ch.charCodeAt(0);

    // Strip Arabic tashkeel / diacritics and tatweel
    if ((code >= 0x064b && code <= 0x065f) || code === 0x0670 || code === 0x0640) {
      continue;
    }

    // ZWNJ -> space
    if (code === 0x200c || code === 0x200d) {
      result += ' ';
      continue;
    }

    // Persian / Arabic-Indic digits -> ASCII
    const persianIdx = PERSIAN_DIGITS.indexOf(ch);
    if (persianIdx !== -1) {
      result += String(persianIdx);
      continue;
    }
    const arabicIdx = ARABIC_INDIC_DIGITS.indexOf(ch);
    if (arabicIdx !== -1) {
      result += String(arabicIdx);
      continue;
    }

    // Arabic -> Persian letter mapping
    if (ARABIC_CHAR_MAP[ch]) {
      result += ARABIC_CHAR_MAP[ch];
      continue;
    }

    result += ch;
  }

  return result
    .toLowerCase()
    .replace(/[-_/.:,;!?()[\]{}'"«»؛،؟|+#*&~`@$^=\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Produces a compact spaceless key for matching variants like "FC 26" vs "fc26" or "گیم نت" vs "گیمنت".
 */
export function toCompactSearchKey(input: string): string {
  return normalizeSearchText(input).replace(/\s+/g, '');
}

/**
 * Generates a URL-safe slug preserving Unicode letters/digits while stripping punctuation.
 */
export function slugifyGameTitle(input: string): string {
  const normalized = normalizeSearchText(input);
  if (!normalized) {
    return '';
  }
  return normalized
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Splits normalized query text into unique non-empty tokens.
 */
export function tokenizeSearchQuery(input: string): string[] {
  const normalized = normalizeSearchText(input);
  if (!normalized) {
    return [];
  }
  return Array.from(new Set(normalized.split(' ').filter(Boolean)));
}

function toPersianDigits(input: string): string {
  return input.replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

/**
 * Builds up to 6 deduplicated string variants for SQL ILIKE / Prisma `contains` queries
 * against legacy database columns that may store Arabic ی/ک, Persian digits, or ZWNJ.
 */
export function buildPersianArabicSearchVariants(input: string): string[] {
  const trimmed = typeof input === 'string' ? input.trim() : '';
  if (!trimmed) {
    return [];
  }

  const variants: string[] = [];
  const add = (val: string) => {
    const clean = val.trim();
    if (clean && !variants.includes(clean)) {
      variants.push(clean);
    }
  };

  // 1. Original trimmed
  add(trimmed);

  // 2. Normalized Persian + ASCII digits
  const normalized = normalizeSearchText(trimmed);
  add(normalized);

  // 3. Arabic ي/ك variant of normalized text
  let arabicVariant = '';
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    arabicVariant += PERSIAN_TO_ARABIC_CHARS[ch] ?? ch;
  }
  if (arabicVariant !== normalized) {
    add(arabicVariant);
  }

  // 4. Persian digits variant
  if (/[0-9]/.test(normalized)) {
    add(toPersianDigits(normalized));
  }

  // 5. ZWNJ compound variant (e.g., "گیم نت" -> "گیم‌نت")
  for (const [spaced, zwnj] of COMPOUND_ZWNJ_WORDS) {
    if (normalized.includes(spaced)) {
      add(normalized.replace(new RegExp(spaced, 'g'), zwnj));
    }
  }

  // 6. Compact spaceless variant when query contains spaces
  if (normalized.includes(' ')) {
    const compact = normalized.replace(/\s+/g, '');
    if (compact.length >= 3) {
      add(compact);
    }
  }

  return variants.slice(0, 6);
}

/**
 * Computes Optimal String Alignment (restricted Damerau-Levenshtein) edit distance.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;
  if (a === b) return 0;

  const dp: number[][] = Array.from({ length: lenA + 1 }, () => new Array<number>(lenB + 1).fill(0));
  for (let i = 0; i <= lenA; i++) dp[i][0] = i;
  for (let j = 0; j <= lenB; j++) dp[0][j] = j;

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, dp[i - 2][j - 2] + cost);
      }
      dp[i][j] = val;
    }
  }

  return dp[lenA][lenB];
}

function buildTrigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const grams = new Set<string>();
  for (let i = 0; i <= padded.length - 3; i++) {
    grams.add(padded.slice(i, i + 3));
  }
  return grams;
}

/**
 * Computes Dice coefficient similarity on character 3-grams in [0, 1].
 */
export function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const gramsA = buildTrigrams(a);
  const gramsB = buildTrigrams(b);
  let intersection = 0;
  for (const g of gramsA) {
    if (gramsB.has(g)) intersection += 1;
  }
  return (2 * intersection) / (gramsA.size + gramsB.size);
}

export type TextMatchType = 'exact' | 'compact' | 'prefix' | 'word' | 'substring' | 'fuzzy' | 'none';

export interface TextMatchScore {
  matched: boolean;
  score: number;
  matchType: TextMatchType;
}

function hasWholeWord(text: string, term: string): boolean {
  if (!text || !term) return false;
  if (text === term) return true;
  return ` ${text} `.includes(` ${term} `);
}

function maxEditDistanceForLength(len: number): number {
  if (len <= 3) return 0;
  if (len <= 6) return 1;
  return 2;
}

function scoreSingleTokenFuzzy(token: string, targetTokens: string[]): number {
  if (token.length < 4) return 0;
  const maxDist = maxEditDistanceForLength(token.length);
  let best = 0;

  for (const cand of targetTokens) {
    if (!cand) continue;
    if (cand === token) return 100;
    if (cand.startsWith(token)) {
      best = Math.max(best, 88);
      continue;
    }
    if (cand.includes(token)) {
      best = Math.max(best, 74);
      continue;
    }
    const lenRatio = Math.min(token.length, cand.length) / Math.max(token.length, cand.length);
    if (lenRatio < 0.5) continue;

    const dist = damerauLevenshtein(token, cand);
    if (dist <= maxDist) {
      const sim = 1 - dist / Math.max(token.length, cand.length);
      best = Math.max(best, Math.round(52 + sim * 14));
      continue;
    }

    const triSim = trigramSimilarity(token, cand);
    if (triSim >= 0.45) {
      best = Math.max(best, Math.round(50 + triSim * 15));
    }
  }

  return best;
}

/**
 * Scores how well a query string matches a target label/title with Persian/Arabic normalization,
 * compact key matching ("fc 26" vs "fc26"), multi-token coverage, and guarded typo tolerance.
 */
export function scoreTextMatch(query: string, target: string): TextMatchScore {
  const normQuery = normalizeSearchText(query);
  const normTarget = normalizeSearchText(target);
  if (!normQuery || !normTarget) {
    return { matched: false, score: 0, matchType: 'none' };
  }

  if (normQuery === normTarget) {
    return { matched: true, score: 100, matchType: 'exact' };
  }

  const compactQuery = normQuery.replace(/\s+/g, '');
  const compactTarget = normTarget.replace(/\s+/g, '');

  if (compactQuery === compactTarget) {
    return { matched: true, score: 96, matchType: 'compact' };
  }

  if (normQuery.length >= 2 && (normTarget.startsWith(normQuery) || compactTarget.startsWith(compactQuery))) {
    return { matched: true, score: 88, matchType: 'prefix' };
  }

  if (hasWholeWord(normTarget, normQuery)) {
    return { matched: true, score: 82, matchType: 'word' };
  }

  if (normQuery.length >= 2 && (normTarget.includes(normQuery) || compactTarget.includes(compactQuery))) {
    return { matched: true, score: 72, matchType: 'substring' };
  }

  const queryTokens = normQuery.split(' ').filter(Boolean);
  const targetTokens = normTarget.split(' ').filter(Boolean);

  // Multi-token coverage check
  if (queryTokens.length >= 2) {
    let matchedCount = 0;
    let totalTokenScore = 0;
    for (const qt of queryTokens) {
      if (targetTokens.includes(qt)) {
        matchedCount += 1;
        totalTokenScore += 90;
      } else if (qt.length >= 2 && targetTokens.some((tt) => tt.startsWith(qt) || tt.includes(qt))) {
        matchedCount += 1;
        totalTokenScore += 76;
      } else {
        const fuzzyScore = scoreSingleTokenFuzzy(qt, targetTokens);
        if (fuzzyScore > 0) {
          matchedCount += 1;
          totalTokenScore += fuzzyScore;
        }
      }
    }

    if (matchedCount === queryTokens.length) {
      const avg = Math.round(totalTokenScore / queryTokens.length);
      return {
        matched: true,
        score: Math.min(86, Math.max(68, avg)),
        matchType: 'word',
      };
    }
  }

  // Fuzzy / typo match only for queries >= 4 characters (or compact length >= 4)
  if (compactQuery.length < 4) {
    return { matched: false, score: 0, matchType: 'none' };
  }

  const candidates = new Set<string>([normTarget, compactTarget, ...targetTokens]);
  // Add adjacent two-word windows for queries like "valornt pro" or "fc 26" typos
  for (let i = 0; i < targetTokens.length - 1; i++) {
    candidates.add(`${targetTokens[i]} ${targetTokens[i + 1]}`);
    candidates.add(`${targetTokens[i]}${targetTokens[i + 1]}`);
  }

  let bestFuzzyScore = 0;
  for (const cand of candidates) {
    if (!cand) continue;
    const minLen = Math.min(compactQuery.length, cand.length);
    const maxLen = Math.max(compactQuery.length, cand.length);
    if (minLen / maxLen < 0.5) continue;

    // Compare both normQuery and compactQuery against candidate
    const comparePairs: Array<[string, string]> = [
      [normQuery, cand],
      [compactQuery, cand.replace(/\s+/g, '')],
    ];

    for (const [qStr, cStr] of comparePairs) {
      if (!qStr || !cStr) continue;
      const dist = damerauLevenshtein(qStr, cStr);
      const maxDist = maxEditDistanceForLength(qStr.length);
      if (dist <= maxDist) {
        const sim = 1 - dist / Math.max(qStr.length, cStr.length);
        bestFuzzyScore = Math.max(bestFuzzyScore, Math.round(52 + sim * 14));
      } else {
        const triSim = trigramSimilarity(qStr, cStr);
        if (triSim >= 0.45) {
          bestFuzzyScore = Math.max(bestFuzzyScore, Math.round(50 + triSim * 15));
        }
      }
    }
  }

  if (bestFuzzyScore >= 50) {
    return { matched: true, score: Math.min(66, bestFuzzyScore), matchType: 'fuzzy' };
  }

  return { matched: false, score: 0, matchType: 'none' };
}

/**
 * Validates geographic coordinate pairs, rejecting nulls, NaN, out-of-bounds, and (0,0) placeholders.
 */
export function isValidCoordinatePair(lat: unknown, lng: unknown): boolean {
  if (
    lat === null ||
    lat === undefined ||
    lat === '' ||
    typeof lat === 'boolean' ||
    lng === null ||
    lng === undefined ||
    lng === '' ||
    typeof lng === 'boolean'
  ) {
    return false;
  }

  const latNum = Number(lat);
  const lngNum = Number(lng);

  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return false;
  }

  if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
    return false;
  }

  if (latNum === 0 && lngNum === 0) {
    return false;
  }

  return true;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Computes great-circle Haversine distance in kilometers, rounded to 2 decimal places.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
}

/**
 * Computes an approximate lat/lng bounding box for fast SQL pre-filtering before exact Haversine distance.
 */
export function getGeoBoundingBox(
  lat: number,
  lng: number,
  radiusKm: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI);
  const cosLat = Math.max(0.01, Math.abs(Math.cos(toRadians(lat))));
  const lngDelta = latDelta / cosLat;

  return {
    minLat: Math.max(-90, lat - latDelta),
    maxLat: Math.min(90, lat + latDelta),
    minLng: Math.max(-180, lng - lngDelta),
    maxLng: Math.min(180, lng + lngDelta),
  };
}

const SEARCH_DEVICE_ALIAS_MAP: Record<string, GameStationType> = {
  pc: GameStationType.PC,
  'پی سی': GameStationType.PC,
  کامپیوتر: GameStationType.PC,
  ps5: GameStationType.PLAYSTATION_5,
  'ps 5': GameStationType.PLAYSTATION_5,
  playstation5: GameStationType.PLAYSTATION_5,
  'playstation 5': GameStationType.PLAYSTATION_5,
  playstation_5: GameStationType.PLAYSTATION_5,
  'پی اس 5': GameStationType.PLAYSTATION_5,
  'پلی استیشن 5': GameStationType.PLAYSTATION_5,
  ps4: GameStationType.PLAYSTATION_4,
  'ps 4': GameStationType.PLAYSTATION_4,
  playstation4: GameStationType.PLAYSTATION_4,
  'playstation 4': GameStationType.PLAYSTATION_4,
  playstation_4: GameStationType.PLAYSTATION_4,
  'پی اس 4': GameStationType.PLAYSTATION_4,
  'پلی استیشن 4': GameStationType.PLAYSTATION_4,
  xbox: GameStationType.XBOX,
  'xbox series x': GameStationType.XBOX,
  'xbox series s': GameStationType.XBOX,
  'ایکس باکس': GameStationType.XBOX,
  switch: GameStationType.SWITCH,
  'nintendo switch': GameStationType.SWITCH,
  سوییچ: GameStationType.SWITCH,
  نینتندو: GameStationType.SWITCH,
  vr: GameStationType.VR,
  'وی ار': GameStationType.VR,
  'واقعیت مجازی': GameStationType.VR,
};

/**
 * Resolves friendly public search device labels (e.g. "ps5", "پی اس ۵", "PLAYSTATION 5") to Prisma GameStationType.
 */
export function parseSearchDeviceAlias(input: unknown): GameStationType | null {
  if (typeof input !== 'string') {
    return null;
  }
  const normalized = normalizeSearchText(input);
  if (!normalized) {
    return null;
  }
  if (SEARCH_DEVICE_ALIAS_MAP[normalized]) {
    return SEARCH_DEVICE_ALIAS_MAP[normalized];
  }
  const compact = normalized.replace(/\s+/g, '');
  if (SEARCH_DEVICE_ALIAS_MAP[compact]) {
    return SEARCH_DEVICE_ALIAS_MAP[compact];
  }
  return null;
}
