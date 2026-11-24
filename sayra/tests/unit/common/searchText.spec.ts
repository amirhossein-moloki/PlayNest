import { GameStationType } from '@prisma/client';
import {
  buildPersianArabicSearchVariants,
  calculateHaversineDistanceKm,
  damerauLevenshtein,
  getGeoBoundingBox,
  isValidCoordinatePair,
  normalizeSearchText,
  parseSearchDeviceAlias,
  scoreTextMatch,
  slugifyGameTitle,
  toCompactSearchKey,
  tokenizeSearchQuery,
  trigramSimilarity,
} from '../../../src/common/utils/searchText';

describe('searchText utility', () => {
  describe('normalizeSearchText & Persian/Arabic/digit unification', () => {
    it('normalizes Arabic Yeh/Kaf, tashkeel, tatweel, ZWNJ, punctuation, and Persian/Arabic digits', () => {
      expect(normalizeSearchText('فيفا ٢٦')).toBe('فیفا 26');
      expect(normalizeSearchText('فیفا ۲۶')).toBe('فیفا 26');
      expect(normalizeSearchText('كالافْ دِيُوتيـی')).toBe('کالاف دیوتیی');
      expect(normalizeSearchText('گیم\u200cنت آرشا')).toBe('گیم نت ارشا');
      expect(normalizeSearchText('Grand Theft Auto: V (PC)!')).toBe('grand theft auto v pc');
      expect(normalizeSearchText('')).toBe('');
    });

    it('builds spaceless compact search keys and URL-safe Unicode slugs', () => {
      expect(toCompactSearchKey('FC 26')).toBe('fc26');
      expect(toCompactSearchKey('گیم\u200cنت پارس')).toBe('گیمنتپارس');
      expect(slugifyGameTitle('Counter-Strike 2 / کانتر ۲')).toBe('counter-strike-2-کانتر-2');
      expect(tokenizeSearchQuery('فیفا ۲۶ فیفا 26')).toEqual(['فیفا', '26']);
    });

    it('generates Persian, Arabic, ZWNJ, Persian-digit, and compact SQL search variants', () => {
      const variants = buildPersianArabicSearchVariants('گیم نت فیفا 26');
      expect(variants).toEqual(
        expect.arrayContaining([
          'گیم نت فیفا 26',
          'گيم نت فيفا 26',
          'گیم نت فیفا ۲۶',
          'گیم\u200cنت فیفا 26',
          'گیمنتفیفا26',
        ])
      );
      expect(variants.length).toBeLessThanOrEqual(6);
      expect(buildPersianArabicSearchVariants('   ')).toEqual([]);
    });
  });

  describe('scoreTextMatch & guarded typo tolerance', () => {
    it('scores exact, compact, prefix, whole-word, and substring matches cleanly', () => {
      expect(scoreTextMatch('FIFA 26', 'fifa 26')).toEqual({
        matched: true,
        score: 100,
        matchType: 'exact',
      });
      expect(scoreTextMatch('fc26', 'FC 26').matchType).toBe('compact');
      expect(scoreTextMatch('valo', 'Valorant')).toMatchObject({
        matched: true,
        matchType: 'prefix',
      });
      expect(scoreTextMatch('دوتی', 'کالاف دیوتی مدرن')).toMatchObject({
        matched: true,
      });
    });

    it('matches guarded fuzzy typos for queries >= 4 chars and blocks unrelated short queries (< 4 chars)', () => {
      const typoMatch = scoreTextMatch('Valorent', 'Valorant');
      expect(typoMatch.matched).toBe(true);
      expect(typoMatch.matchType).toBe('fuzzy');
      expect(typoMatch.score).toBeGreaterThanOrEqual(50);

      // Short < 4 char query must NOT match loosely via fuzzy edit distance
      const shortMiss = scoreTextMatch('vrs', 'Fortnite');
      expect(shortMiss).toEqual({ matched: false, score: 0, matchType: 'none' });

      const fcShortMiss = scoreTextMatch('fc', 'GTA');
      expect(fcShortMiss.matched).toBe(false);
    });

    it('computes Damerau-Levenshtein distance and trigram similarity accurately', () => {
      expect(damerauLevenshtein('valorant', 'valoarnt')).toBe(1);
      expect(trigramSimilarity('counter strike', 'counter strike')).toBe(1);
      expect(trigramSimilarity('abcdef', 'xyz')).toBeLessThan(0.2);
    });
  });

  describe('geographic validation, Haversine distance, bounding box & device aliases', () => {
    it('rejects null, NaN, out-of-range, booleans, and (0, 0) coordinates', () => {
      expect(isValidCoordinatePair(35.6892, 51.389)).toBe(true);
      expect(isValidCoordinatePair('35.75', '51.41')).toBe(true);
      expect(isValidCoordinatePair(0, 0)).toBe(false);
      expect(isValidCoordinatePair(null, 51.389)).toBe(false);
      expect(isValidCoordinatePair(undefined, undefined)).toBe(false);
      expect(isValidCoordinatePair(95, 51)).toBe(false);
      expect(isValidCoordinatePair(35, 190)).toBe(false);
      expect(isValidCoordinatePair(Number.NaN, 51)).toBe(false);
    });

    it('computes realistic Tehran-to-Karaj Haversine distance and valid bounding boxes', () => {
      const km = calculateHaversineDistanceKm(35.6892, 51.389, 35.8327, 50.9915);
      expect(km).toBeGreaterThan(35);
      expect(km).toBeLessThan(45);

      const box = getGeoBoundingBox(35.6892, 51.389, 10);
      expect(box.minLat).toBeLessThan(35.6892);
      expect(box.maxLat).toBeGreaterThan(35.6892);
      expect(box.minLng).toBeLessThan(51.389);
      expect(box.maxLng).toBeGreaterThan(51.389);
    });

    it('parses bilingual device aliases strictly for search filters', () => {
      expect(parseSearchDeviceAlias('ps5')).toBe(GameStationType.PLAYSTATION_5);
      expect(parseSearchDeviceAlias('پی اس ۵')).toBe(GameStationType.PLAYSTATION_5);
      expect(parseSearchDeviceAlias('پلی\u200cاستیشن 4')).toBe(GameStationType.PLAYSTATION_4);
      expect(parseSearchDeviceAlias('pc')).toBe(GameStationType.PC);
      expect(parseSearchDeviceAlias('وی آر')).toBe(GameStationType.VR);
      expect(parseSearchDeviceAlias('unknown-console')).toBeNull();
    });
  });
});
