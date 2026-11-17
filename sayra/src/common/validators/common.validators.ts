
import { z } from 'zod';

export const CUID_MESSAGE = 'Invalid ID format';

/**
 * Standard identifier regex:
 * Accepts 1 to 128 characters: letters, digits, underscores, and hyphens.
 * This supports:
 * - Prisma CUIDv1 (e.g. cjld2cjxh0000qzrmn831i7rn)
 * - CUIDv2 (e.g. tz4a98xxat96iws9zmbrgj3a)
 * - Standard UUIDs (e.g. 123e4567-e89b-12d3-a456-426614174000)
 * - Legacy and dataset seed identifiers (e.g. center_07, reservation_07_007, station_07_01)
 * Rejects whitespace, control characters, special punctuation, and empty strings.
 */
export const ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export const isValidId = (val: unknown): val is string => {
  return typeof val === 'string' && ID_REGEX.test(val);
};

export const idSchema = (message = 'Invalid ID format') =>
  z.string({ invalid_type_error: message })
    .trim()
    .min(1, { message })
    .max(128, { message: 'ID exceeds maximum allowed length' })
    .regex(ID_REGEX, { message });

export const idParamSchema = (paramName: string, message = 'Invalid ID format') =>
  z.object({
    params: z.object({
      [paramName]: idSchema(message),
    }),
  });
