import { createGamingCenterSchema, updateGamingCenterSchema } from '../../../../src/modules/gamingCenter/gamingCenter.validation';

describe('Gaming Center Zod Validation (FIND-04 Bounded Arrays)', () => {
  describe('createGamingCenterSchema', () => {
    it('should pass with an array at maximum permitted size (100 items)', () => {
      const validGames = Array.from({ length: 100 }, (_, i) => `Game ${i + 1}`);
      const payload = {
        name: 'Test Gaming Center',
        slug: 'test-center',
        ownerId: 'owner-123',
        games: validGames,
      };

      const result = createGamingCenterSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should fail with an array exceeding maximum size (101 items)', () => {
      const oversizedGames = Array.from({ length: 101 }, (_, i) => `Game ${i + 1}`);
      const payload = {
        name: 'Test Gaming Center',
        slug: 'test-center',
        ownerId: 'owner-123',
        games: oversizedGames,
      };

      const result = createGamingCenterSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Games list cannot exceed 100 items');
      }
    });

    it('should allow empty games array', () => {
      const payload = {
        name: 'Test Gaming Center',
        slug: 'test-center',
        ownerId: 'owner-123',
        games: [],
      };

      const result = createGamingCenterSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe('updateGamingCenterSchema', () => {
    it('should reject oversized games array on update', () => {
      const oversizedGames = Array.from({ length: 101 }, (_, i) => `Game ${i + 1}`);
      const payload = {
        games: oversizedGames,
      };

      const result = updateGamingCenterSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Games list cannot exceed 100 items');
      }
    });
  });
});
