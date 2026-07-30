// ============================================================
// DIAGRAMA DE GANTT POR PROCESO — Filas individuales
// ============================================================
// A diferencia de GanttChart.tsx (que dibuja UNA sola barra con
// todos los procesos apilados), este componente organiza el Gantt
// en FILAS: una fila por proceso, alineadas verticalmente sobre un
// mismo eje de tiempo compartido. Así se ve claramente cuándo cada
// proceso usó la CPU y cuándo estuvo esperando (huecos en su fila).
//
// Recibe:
//   - timeline:  ExecutionSlice[]  (los tramos de CPU que devolvió el motor de scheduling)
//   - colorMap:  Map<string,string> (color por proceso, COMPARTIDO con toda la UI)
//   - hideLegend?: boolean          (oculta la leyenda; por defecto false)
//
// La prop colorMap es compartida para que cada proceso conserve
// SIEMPRE el mismo color en la tabla, en las colas y aquí en el Gantt.

import type { ExecutionSlice } from '../types/scheduling';

// ============================================================
// CONTRATO del componente
// ============================================================
interface PerProcessGanttProps {
  timeline: ExecutionSlice[];
  colorMap: Map<string, string>;
  hideLegend?: boolean;
}

// Límite para generar marcas de tiempo enteras consecutivas en la regla.
// Si el timeline dura ≤ 40ms, se dibuja una marca por cada entero (0,1,2,...40).
// Si dura más, se espacian en pasos para no saturar la regla.
const MAX_INTEGER_TICK_SPAN = 40;

// ------------------------------------------------------------
// Utilidad: genera el array de marcas (ticks) para la regla de tiempo.
// Entrada: maxEnd = tiempo máximo del timeline.
// Salida:   numbers[] a dibujar como marcas en la regla.
// ------------------------------------------------------------
function buildTicks(maxEnd: number): number[] {
  if (maxEnd <= 0) return [0];
  // Caso corto: marcas enteras consecutivas (0..maxEnd).
  if (maxEnd <= MAX_INTEGER_TICK_SPAN) return Array.from({ length: Math.floor(maxEnd) + 1 }, (_, i) => i);
  // Caso largo: se elige un 'step' para no tener más de ~40 marcas.
  const step = Math.ceil(maxEnd / MAX_INTEGER_TICK_SPAN);
  const ticks: number[] = [];
  for (let t = 0; t <= maxEnd; t += step) ticks.push(t);
  // Asegura que la última marca caiga exactamente en maxEnd.
  if (ticks[ticks.length - 1] !== maxEnd) ticks.push(maxEnd);
  return ticks;
}

// Píxeles asignados a cada milisegundo para el ancho MÍNIMO del contenido.
// Si el timeline es muy largo, el contenido se vuelve scrolleable horizontalmente.
const PX_PER_MS = 48;

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export function PerProcessGantt({ timeline, colorMap, hideLegend = false }: PerProcessGanttProps) {

  // --- PUNTO DE BUILD 1: ORDEN DE PROCESOS ---
  // Recorre el timeline y registra cada processId la PRIMERA vez que aparece.
  // Ese orden define el orden vertical de las filas y de la leyenda.
  // (Estable y predecible: no depende de cómo llegaron los procesos.)
  const processOrder: string[] = [];
  for (const s of timeline) {
    if (!processOrder.includes(s.processId)) processOrder.push(s.processId);
  }

  // --- PUNTO DE BUILD 2: ESCALA Y EJE DE TIEMPO ---
  // maxEnd = instante final de toda la simulación (mayor 'end').
  // scale  = conversión de ms → porcentaje: 100 / maxEnd.
  // Así un slice que dura X ms ocupa el X/maxEnd % del ancho total
  // (ancho proporcional a la duración, requisito del spec de Gantt).
  const maxEnd = timeline.length > 0 ? Math.max(...timeline.map(s => s.end)) : 0;
  const scale = maxEnd > 0 ? 100 / maxEnd : 1;
  const ticks = buildTicks(maxEnd);
  // Ancho del contenido en px: garantiza un mínimo legible y activa el scroll horizontal si hace falta.
  const contentWidth = Math.max(maxEnd * PX_PER_MS, 1);

  return (
    <div className="per-process-gantt">
      <h2>Diagrama de Gantt (CPU)</h2>
      <p className="per-process-gantt-subtitle">
        Tramos de ejecución en CPU por proceso, alineados sobre un eje de tiempo compartido.
      </p>

      {/* --- ESTADO VACÍO: placeholder sin excepciones --- */}
      {timeline.length === 0 ? (
        <div className="gantt-empty">No hay procesos para mostrar</div>
      ) : (
        <>
          {/* --- DIBUJO: LEYENDA DE COLORES (ocultable) ---
              Muestra un swatch (cuadradito de color) por cada proceso en processOrder.
              El color viene del colorMap compartido, así coincide con la tabla y las colas.
              Se omite cuando hideLegend=true (en App.tsx pasamos hideLegend porque la
              tabla de procesos ya hace de leyenda con sus .process-color-dot). */}
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

          {/* --- DIBUJO: CUERPO (etiquetas + área scrolleable) ---
              Se divide en dos columnas:
                1) Etiquetas de procesos fijas a la izquierda (no scrollean)
                2) Área de filas que SÍ scrollea horizontalmente si el contenido es muy ancho */}
          <div className="per-process-gantt-body">
            {/* Columna 1: etiquetas de cada proceso (una por fila) */}
            <div className="per-process-gantt-labels">
              {processOrder.map(processId => (
                <span key={processId} className="per-process-gantt-row-label">{processId}</span>
              ))}
            </div>
            {/* Columna 2: área scrolleable con la regla + las filas del Gantt */}
            <div className="per-process-gantt-scroll">
              {/* minWidth garantiza el ancho mínimo (contentWidth px) → scroll horizontal si hace falta */}
              <div className="per-process-gantt-content" style={{ minWidth: `${contentWidth}px` }}>
                {/* --- DIBUJO: REGLA DE TIEMPO SUPERIOR ---
                    Marca cada 't' del array de ticks en la posición left = t * scale (%).
                    Es el eje horizontal compartido por todas las filas. */}
                <div className="per-process-gantt-ruler">
                  {ticks.map(t => (
                    <span key={t} className="queue-ruler-tick" style={{ left: `${t * scale}%` }}>{t}</span>
                  ))}
                </div>
                {/* --- DIBUJO: FILAS DEL GANTT (el núcleo del componente) ---
                    Por cada proceso en processOrder se crea una fila .per-process-gantt-track-row.
                    Dentro de esa fila, se filtran del timeline SOLO los slices de ese proceso
                    y se dibuja cada uno como un <div class="gantt-slice"> posicionado:
                      - left:    s.start * scale (%)      → inicio en el eje de tiempo
                      - width:   (s.end - s.start)*scale (%)  → ancho proporcional a la duración
                      - background: color del proceso (colorMap compartido)
                    Los huecos (donde el proceso NO tenía CPU) simplemente no tienen slice → se ven
                    como espacio vacío en esa fila, lo que representa visualmente el tiempo de espera. */}
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
