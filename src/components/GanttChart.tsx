// ============================================================
// DIAGRAMA DE GANTT — Línea de tiempo única de CPU
// ============================================================
// Muestra la ocupación de la CPU a lo largo del tiempo.
// Cada proceso se representa con un color distinto.
// Los espacios idle (sin proceso ejecutándose) se muestran
// con un patrón rayado.

import type { ExecutionSlice } from '../types/scheduling';
import { buildColorMap } from '../lib/seriesColors';

// ============================================================
// CONTRATO FROZEN (no modificar): la firma acepta SOLO un array
// de ExecutionSlice (tramos de CPU). El colorMap se construye aquí
// mismo a partir del timeline, no se recibe como prop.
// ============================================================
interface GanttChartProps { timeline: ExecutionSlice[]; }

// Punto de CONSTRUCCIÓN del Gantt: esta función recibe el timeline
// devuelto por el motor de scheduling (sjf/roundRobin/mlq) y devuelve
// el JSX que renderiza la barra horizontal de ocupación de CPU.
export function GanttChart({ timeline }: GanttChartProps) {
  // Estado vacío: si no hay slices, devolver placeholder sin excepciones.
  if (timeline.length === 0) {
    return <div className="gantt-empty">No hay procesos para mostrar</div>;
  }

  // --- PUNTO DE BUILD 1: ESCALA PROPORCIONAL ---
  // El tiempo total = el mayor 'end' entre todos los slices.
  // 'scale' convierte unidades de tiempo a porcentaje (0..100%) para
  // que el ancho de cada barra sea proporcional a su duración.
  const totalEnd = Math.max(...timeline.map(s => s.end));
  const scale = totalEnd > 0 ? 100 / totalEnd : 1;

  // --- PUNTO DE BUILD 2: COLORES POR PROCESO ---
  // buildColorMap asigna 1 de 8 colores CSS (--series-1..8) por orden
  // de primera aparición. Un mismo processId recibe siempre el mismo
  // color en todos sus slices (requisito del spec gantt-visualization).
  const colorMap = buildColorMap(timeline.map(s => s.processId));

  // --- PUNTO DE BUILD 3: ANOTACIÓN DE CADA SLICE ---
  // Aquí se "construyen" los datos visuales de cada tramo de CPU:
  //  - color: el color asignado al proceso dueño del slice
  //  - w:     ancho en % = (end - start) * scale  → proporcional a su duración
  //  - l:     posición izquierda en % = start * scale → dónde empieza en la barra
  const annotated = timeline.map(s => ({
    ...s,
    color: colorMap.get(s.processId)!,
    w: (s.end - s.start) * scale,
    l: s.start * scale,
  }));

  // Caso borde: toda la simulación dura 0 (slice de duración 0).
  // Se dibuja un slice a ancho 100% evitando división por cero.
  if (totalEnd === 0) {
    return (
      <div className="gantt">
        {annotated.map((s, i) => (
          <div key={i} className="gantt-slice" data-slice data-color={s.color} data-width="100"
            style={{ background: s.color, width: '100%', left: 0 }} />
        ))}
      </div>
    );
  }

  // --- PUNTO DE BUILD 4: DETECCIÓN DE HUECOS IDLE ---
  // Se recorren los slices en orden con un 'cursor' temporal.
  // Si un slice empieza DESPUÉS del cursor, ese intervalo [cursor, start)
  // es CPU ociosa (idle) y se registra como hueco. Al final se agrega un
  // hueco final si el último slice no llega a totalEnd.
  // Cada hueco se dibuja como <div class="gantt-idle"> (patrón rayado en CSS),
  // DISTINTO de los slices de ejecución (requisito del spec).
  const gaps: { l: number; w: number }[] = [];
  let cursor = 0;
  for (const s of annotated) {
    if (s.start > cursor) gaps.push({ l: cursor * scale, w: (s.start - cursor) * scale });
    cursor = s.end;
  }
  if (cursor < totalEnd) gaps.push({ l: cursor * scale, w: (totalEnd - cursor) * scale });

  // --- PUNTO DE DIBUJO (RENDER) ---
  // Se renderiza un contenedor .gantt con posición relativa. Dentro:
  //  1) los huecos idle (<div class="gantt-idle">) posicionados con left/width en %
  //  2) los slices de ejecución (<div class="gantt-slice">) pintados con el color
  //     del proceso, con left/width en % y el id del proceso como etiqueta.
  // Todo se posiciona con porcentajes → la barra es responsive (ancho del padre).
  return (
    <div className="gantt">
      {gaps.map((g, i) => (
        <div key={`idle-${i}`} className="gantt-idle" data-idle
          style={{ left: `${g.l}%`, width: `${g.w}%` }} />
      ))}
      {annotated.map((s, i) => (
        <div key={i} className="gantt-slice" data-slice data-color={s.color} data-width={s.w.toFixed(4)}
          style={{ left: `${s.l}%`, width: `${s.w}%`, background: s.color }}>
          {s.processId}
        </div>
      ))}
    </div>
  );
}
