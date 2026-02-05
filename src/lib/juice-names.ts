/**
 * Exotic juice names for tournament naming.
 * Cycle through these in order for each new tournament in a series.
 */
export const JUICE_NAMES = [
  'Yuzu',
  'Calamansi',
  'Guava',
  'Passion Fruit',
  'Lychee',
  'Tamarind',
  'Soursop',
  'Mangosteen',
  'Prickly Pear',
  'Acerola',
  'Kumquat',
  'Dragonfruit',
  'Starfruit',
  'Rambutan',
  'Jackfruit',
  'Pomelo',
  'Feijoa',
  'Cherimoya',
  'Sapodilla',
  'Persimmon',
] as const;

/**
 * Get the next juice name for a series based on the current order index.
 */
export function getJuiceName(seriesOrder: number): string {
  return JUICE_NAMES[seriesOrder % JUICE_NAMES.length];
}

/**
 * Emoji for each juice (for visual flair).
 */
const JUICE_EMOJIS: Record<string, string> = {
  'Yuzu': '🍋',
  'Calamansi': '🍊',
  'Guava': '🍈',
  'Passion Fruit': '💛',
  'Lychee': '🩷',
  'Tamarind': '🟤',
  'Soursop': '🥝',
  'Mangosteen': '🍇',
  'Prickly Pear': '🌵',
  'Acerola': '🍒',
  'Kumquat': '🟠',
  'Dragonfruit': '🐉',
  'Starfruit': '⭐',
  'Rambutan': '🔴',
  'Jackfruit': '🟡',
  'Pomelo': '🍈',
  'Feijoa': '🥬',
  'Cherimoya': '🍏',
  'Sapodilla': '🫐',
  'Persimmon': '🧡',
};

export function getJuiceEmoji(name: string): string {
  return JUICE_EMOJIS[name] || '🧃';
}
