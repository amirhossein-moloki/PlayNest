/**
 * Normalizes a phone number to E.164-like format starting with +98 for Iran or + for international.
 * @param phone - The phone number string to normalize.
 * @returns The normalized phone number string.
 */
export const normalizePhone = (phone: string): string => {
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (hasPlus) {
    return `+${digitsOnly}`;
  }

  if (digitsOnly.startsWith('00')) {
    return `+${digitsOnly.slice(2)}`;
  }

  if (digitsOnly.startsWith('0')) {
    return `+98${digitsOnly.slice(1)}`;
  }

  return `+${digitsOnly}`;
};
