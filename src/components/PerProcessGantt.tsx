// ============================================================
// DIAGRAMA DE GANTT POR PROCESO — Filas individuales
// ============================================================
// Similar al GanttChart pero organizado en filas separadas:
// una fila por proceso, mostrando solo sus propios tramos de
// CPU. Incluye una leyenda de colores y una regla de tiempo.

import type { ExecutionSlice } from '../types/scheduling';

interface PerProcessGanttProps {
  timeline: ExecutionSlice[];
  colorMap: Map<string, string>;
  hideLegend?: boolean;
}

const MAX_INTEGER_TICK_SPAN = 40;

// Genera marcas de tiempo para la regla
function buildTicks(maxEnd: number): number[] {
  if (maxEnd <= 0) return [0];
  if (maxEnd <= MAX_INTEGER_TICK_SPAN) return Array.from({ length: Math.floor(maxEnd) + 1 }, (_, i) => i);
  const step = Math.ceil(maxEnd / MAX_INTEGER_TICK_SPAN);
  const ticks: number[] = [];
  for (let t = 0; t <= maxEnd; t += step) ticks.push(t);
  if (ticks[ticks.length - 1] !== maxEnd) ticks.push(maxEnd);
  return ticks;
}

const PX_PER_MS = 48; // Píxeles por milisegundo para el ancho mínimo

export function PerProcessGantt({ timeline, colorMap, hideLegend = false }: PerProcessGanttProps) {
  // Orden de los procesos (según primera aparición en timeline)
  const processOrder: string[] = [];
  for (const s of timeline) {
    if (!processOrder.includes(s.processId)) processOrder.push(s.processId);
  }

  const maxEnd = timeline.length > 0 ? Math.max(...timeline.map(s => s.end)) : 0;
  const scale = maxEnd > 0 ? 100 / maxEnd : 1;
  const ticks = buildTicks(maxEnd);
  const contentWidth = Math.max(maxEnd * PX_PER_MS, 1);

  return (
    <div className="per-process-gantt">
      <h2>Diagrama de Gantt (CPU)</h2>
      <p className="per-process-gantt-subtitle">
        Tramos de ejecución en CPU por proceso, alineados sobre un eje de tiempo compartido.
      </p>

      {timeline.length === 0 ? (
        <div className="gantt-empty">No hay procesos para mostrar</div>
      ) : (
        <>
          {/* Leyenda de colores (ocultable) */}
          {!hideLegend && (
            <div className="per-process-gantt-legend">
              {processOrder.map(processId => (
                <span key={processId} className="legend-entry" data-legend-entry={processId} data-color={colorMap.get(processId) ?? 'var(--series-1)'}>
                  <span className="legend-swatch" style={{ background: colorMap.get(processId) ?? 'var(--series-1)' }} />
                  {processId}
                </span>
              ))}
            </div>
          )}

          <div className="per-process-gantt-body">
            {/* Etiquetas de procesos a la izquierda */}
            <div className="per-process-gantt-labels">
              {processOrder.map(processId => (
                <span key={processId} className="per-process-gantt-row-label">{processId}</span>
              ))}
            </div>
            {/* Área scrolleable del diagrama */}
            <div className="per-process-gantt-scroll">
              <div className="per-process-gantt-content" style={{ minWidth: `${contentWidth}px` }}>
                {/* Regla de tiempo superior */}
                <div className="per-process-gantt-ruler">
                  {ticks.map(t => (
                    <span key={t} className="queue-ruler-tick" style={{ left: `${t * scale}%` }}>{t}</span>
                  ))}
                </div>
                {/* Filas: una por proceso */}
                <div className="per-process-gantt-rows">
                  {processOrder.map(processId => (
                    <div key={processId} className="per-process-gantt-track-row" data-row={processId}>
                      {timeline.filter(s => s.processId === processId).map((s, i) => (
                        <div key={i} className="gantt-slice" data-slice data-process={processId}
                          data-color={colorMap.get(processId) ?? 'var(--series-1)'}
                          data-width={((s.end - s.start) * scale).toFixed(4)}
                          style={{ left: `${s.start * scale}%`, width: `${(s.end - s.start) * scale}%`, background: colorMap.get(processId) ?? 'var(--series-1)' }}>
                          {s.processId}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
