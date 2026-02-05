/**
 * Euro formatting utilities.
 * All balances are stored as integer cents (e.g. 2000 = €20.00).
 * Display as whole euros by default unless displayDecimals is true.
 */

export function formatEuros(cents: number, showDecimals = false): string {
  if (showDecimals) {
    return `€${(cents / 100).toFixed(2)}`;
  }
  // Round to nearest euro for display
  const euros = Math.round(cents / 100);
  return `€${euros}`;
}

export function formatEurosCompact(cents: number): string {
  return formatEuros(cents, false);
}

/**
 * Get the minimum bid increment in cents based on current bid.
 * <€10 (1000c): +€1 (100c)
 * €10–€30 (1000-3000c): +€2 (200c)
 * €30–€60 (3000-6000c): +€5 (500c)
 * €60+ (6000c+): +€10 (1000c)
 */
export function getMinBidIncrement(currentBidCents: number): number {
  if (currentBidCents < 1000) return 100;
  if (currentBidCents < 3000) return 200;
  if (currentBidCents < 6000) return 500;
  return 1000;
}

/**
 * Clamp balance to zero if negative balances not allowed.
 */
export function clampBalance(cents: number, allowNegative: boolean): number {
  if (!allowNegative && cents < 0) return 0;
  return cents;
}
