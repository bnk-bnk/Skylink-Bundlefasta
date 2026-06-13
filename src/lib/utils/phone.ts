/**
 * Normalizes Kenyan mobile numbers to E.164 format (2547XXXXXXXX or 2541XXXXXXXX).
 * Throws an error if the number format is invalid.
 */
export function normalizeKenyanPhone(phone: string): string {
  if (!phone) {
    throw new Error('Phone number is required');
  }

  // Remove any spaces, hyphens, parentheses, and leading plus sign
  let clean = phone.trim().replace(/[^\d+]/g, '');

  if (clean.startsWith('+')) {
    clean = clean.slice(1);
  }

  // Case 1: 2547XXXXXXXX or 2541XXXXXXXX (12 digits)
  if (clean.startsWith('254') && clean.length === 12) {
    const mainPart = clean.slice(3);
    if (/^[71]\d{8}$/.test(mainPart)) {
      return clean;
    }
  }

  // Case 2: 07XXXXXXXX or 01XXXXXXXX (10 digits)
  if (clean.startsWith('0') && clean.length === 10) {
    const mainPart = clean.slice(1);
    if (/^[71]\d{8}$/.test(mainPart)) {
      return `254${mainPart}`;
    }
  }

  // Case 3: 7XXXXXXXX or 1XXXXXXXX (9 digits)
  if (clean.length === 9 && /^[71]\d{8}$/.test(clean)) {
    return `254${clean}`;
  }

  throw new Error(`Invalid Kenyan phone number: "${phone}"`);
}
