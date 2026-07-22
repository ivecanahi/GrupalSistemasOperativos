/**
 * Picks 'light' or 'dark' text based on relative luminance of a hex background
 * color, so labels stay legible against any per-process palette color.
 * CSS custom-property references (e.g. 'var(--series-1)') fall back to 'light'
 * since their resolved color can't be inspected here — callers that need this
 * to matter (QueueSection) are given resolved hex values via colorMap.
 */
export function pickTextColor(backgroundColor: string): 'light' | 'dark' {
  const hex = backgroundColor.trim().match(/^#([0-9a-fA-F]{6})$/);
  if (!hex) return 'light';

  const r = parseInt(hex[1].slice(0, 2), 16);
  const g = parseInt(hex[1].slice(2, 4), 16);
  const b = parseInt(hex[1].slice(4, 6), 16);

  // Perceived-brightness (YIQ) formula: above the midpoint the background
  // reads as light, so dark text wins the contrast; below it, keep white text.
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? 'dark' : 'light';
}
