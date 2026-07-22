export const SERIES_COLORS = [
  'var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)',
  'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)',
];

export function buildColorMap(processIdsInFirstAppearanceOrder: string[]): Map<string, string> {
  const map = new Map<string, string>();
  let idx = 0;
  for (const id of processIdsInFirstAppearanceOrder) {
    if (!map.has(id)) {
      map.set(id, SERIES_COLORS[idx % SERIES_COLORS.length]);
      idx++;
    }
  }
  return map;
}
