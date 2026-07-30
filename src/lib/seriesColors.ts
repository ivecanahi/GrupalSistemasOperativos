// ============================================================
// PALETA DE COLORES PARA PROCESOS EN EL DIAGRAMA DE GANTT
// ============================================================
// Define 8 colores CSS personalizados para distinguir visualmente
// los procesos en todos los gráficos (Gantt, colas, etc.)

// Referencias a variables CSS definidas en index.css
export const SERIES_COLORS = [
  'var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)',
  'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)',
];

// Construye un mapa ID-del-proceso → color, en orden de primera aparición
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
