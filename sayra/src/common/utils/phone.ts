/**
 * Normalizes a phone number to E.164-like format starting with +98 for Iran or + for international.
 * Formats like 09..., +989..., 989..., 00989... are all uniformly converted to +989...
 * @param phone - The phone number string to normalize.
 * @returns The normalized phone number string.
 */
export const normalizePhone = (phone: string): string => {
  const trimmed = phone.trim();
  const digitsOnly = trimmed.replace(/\D/g, '');

  // International starting with 00 (e.g. 0098912...)
  if (trimmed.startsWith('00') || digitsOnly.startsWith('00')) {
    const stripped = digitsOnly.replace(/^00/, '');
    return `+${stripped}`;
  }

  // Already starting with +
  if (trimmed.startsWith('+')) {
    return `+${digitsOnly}`;
  }

  // Iranian numbers starting with 0 (e.g. 0912...)
  if (digitsOnly.startsWith('0')) {
    return `+98${digitsOnly.slice(1)}`;
  }

  // Iranian numbers starting with 98 (e.g. 98912...)
  if (digitsOnly.startsWith('98') && digitsOnly.length >= 12) {
    return `+${digitsOnly}`;
  }

  // Iranian numbers entered without leading 0 or 98 (e.g. 9123456789)
  if (digitsOnly.startsWith('9') && digitsOnly.length === 10) {
    return `+98${digitsOnly}`;
  }

  return `+${digitsOnly}`;
};

/**
 * Returns all potential representations of a phone number (e.g. +98912..., 0912..., 98912..., 0098912..., 912...).
 * Useful for matching historical or unnormalized records in database queries.
 * @param phone - Any phone number string.
 * @returns Array of unique string variants.
 */
export const getPhoneVariants = (phone: string): string[] => {
  const trimmed = phone.trim();
  const digitsOnly = trimmed.replace(/\D/g, '');
  const variants = new Set<string>();

  if (trimmed) {
    variants.add(trimmed);
  }

  const normalized = normalizePhone(phone);
  variants.add(normalized);

  // If Iranian number (+989...)
  if (normalized.startsWith('+989')) {
    const raw9 = normalized.slice(3); // e.g. 9123456789
    variants.add(`0${raw9}`);          // e.g. 09123456789
    variants.add(`98${raw9}`);         // e.g. 989123456789
    variants.add(`+98${raw9}`);        // e.g. +989123456789
    variants.add(`0098${raw9}`);       // e.g. 00989123456789
    variants.add(raw9);                // e.g. 9123456789
  } else if (digitsOnly) {
    variants.add(digitsOnly);
    variants.add(`+${digitsOnly}`);
  }

  return Array.from(variants);
};
