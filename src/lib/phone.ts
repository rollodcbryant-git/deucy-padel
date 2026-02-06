/**
 * Normalize a phone number by stripping all non-digit characters
 * except a leading '+'. This gives consistent lookup in the DB.
 */
export function normalizePhone(raw: string): string {
  // Remove spaces, dashes, parens, dots
  const stripped = raw.replace(/[\s\-().]/g, '');
  // If it starts with '+', keep that and then only digits
  if (stripped.startsWith('+')) {
    return '+' + stripped.slice(1).replace(/\D/g, '');
  }
  return stripped.replace(/\D/g, '');
}

