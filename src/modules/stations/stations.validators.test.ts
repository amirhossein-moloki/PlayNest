import { createServiceSchema } from './stations.validators';

describe('GameStation Validators', () => {
  describe('createServiceSchema', () => {
    const validData = {
      body: {
        name: 'Test GameStation',
        durationMinutes: 30,
        price: 50000,
        currency: 'IRR',
        isActive: true,
      },
    };

    it('should pass with valid data', () => {
      const result = createServiceSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should fail if name is empty', () => {
      const invalidData = { ...validData, body: { ...validData.body, name: '' } };
      const result = createServiceSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should fail if duration is not a positive integer', () => {
      const invalidData = { ...validData, body: { ...validData.body, durationMinutes: 0 } };
      const result = createServiceSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should fail if price is negative', () => {
      const invalidData = { ...validData, body: { ...validData.body, price: -100 } };
      const result = createServiceSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should fail if currency code is not 3 letters', () => {
      const invalidData = { ...validData, body: { ...validData.body, currency: 'IR' } };
      const result = createServiceSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should pass if isActive is not provided', () => {
      const dataWithoutIsActive = {
        body: {
          name: 'Test GameStation',
          durationMinutes: 30,
          price: 50000,
          currency: 'IRR',
        },
      };
      const result = createServiceSchema.safeParse(dataWithoutIsActive);
      expect(result.success).toBe(true);
    });
  });
});
