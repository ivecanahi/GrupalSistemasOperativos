// ============================================================
// CONSTRUCTOR DE LÍNEAS DE TIEMPO DE COLAS
// ============================================================
// A partir de la línea de tiempo de CPU y de E/S generadas por
// el motor, deriva las tres colas visuales:
// - cpu: copia de la línea de CPU
// - io: copia de la línea de E/S
// - ready: intervalos donde cada proceso esperó en la cola de listos

import type { ProcessInput, ExecutionSlice, QueueSlice, QueueTimelines } from '../types/scheduling';

export function buildQueueTimelines(
  processes: ProcessInput[],
  cpuTimeline: ExecutionSlice[],
  ioTimeline: QueueSlice[],
): QueueTimelines {
  // Cola de CPU: copia directa
  const cpu: QueueSlice[] = cpuTimeline.map(s => ({
    processId: s.processId, start: s.start, end: s.end,
  }));

  // Cola de E/S: copia directa
  const io: QueueSlice[] = ioTimeline.map(s => ({ ...s }));

  // Mapa para búsqueda rápida de arrivalTime por ID
  const arrivalMap = new Map(processes.map(p => [p.id, p.arrivalTime]));

  // Cola de listos: para cada proceso, calcula los gaps entre
  // su llegada/fin de CPU anterior y el inicio de su siguiente slice de CPU
  const ready: QueueSlice[] = [];
  for (const p of processes) {
    const ownSlices = cpuTimeline
      .filter(s => s.processId === p.id)
      .sort((a, b) => a.start - b.start);

    const ownIo = io.filter(s => s.processId === p.id);
    let cursor = p.arrivalTime;

    for (const slice of ownSlices) {
      if (slice.start >= cursor) {
        // Si en cursor comienza una E/S, la parte visible de espera empieza donde termina la E/S
        const ioAtCursor = ownIo.find(s => s.start === cursor);
        if (ioAtCursor) {
          if (ioAtCursor.end <= slice.start) {
            ready.push({ processId: p.id, start: ioAtCursor.end, end: slice.start });
          }
        } else {
          ready.push({ processId: p.id, start: cursor, end: slice.start });
        }
      }
      cursor = slice.end;
    }
  }

  // Ordena: llegadas frescas (start === arrivalTime) primero, luego retornos de E/S
  ready.sort((a, b) => {
    const aArrival = arrivalMap.get(a.processId) ?? 0;
    const bArrival = arrivalMap.get(b.processId) ?? 0;
    const aFresh = a.start === aArrival;
    const bFresh = b.start === bArrival;
    if (aFresh && !bFresh) return -1;
    if (!aFresh && bFresh) return 1;
    return a.start - b.start || a.end - b.end;
  });

  return { cpu, ready, io };
}
