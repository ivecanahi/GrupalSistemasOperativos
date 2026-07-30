// ============================================================
// CONSTRUCTOR DE REGISTRO CRONOLÓGICO DE EVENTOS
// ============================================================
// Genera una lista ordenada de eventos (llegada, inicio/fin de CPU,
// inicio/fin de E/S, finalización) a partir del resultado de la
// simulación. Se usa en el componente EventLog para mostrar la
// secuencia completa de la ejecución.

import type { ProcessInput, SchedulingResult } from '../types/scheduling';

// Un evento individual en la línea de tiempo
export interface ScheduleEvent {
  time: number;           // Momento en que ocurre
  processId: string;      // Proceso involucrado
  kind: 'arrival' | 'cpu-start' | 'cpu-end' | 'io-start' | 'io-end' | 'finish';
  label: string;          // Texto descriptivo en español
}

// Prioridad para ordenar eventos que ocurren en el mismo instante
const KIND_PRIORITY: Record<ScheduleEvent['kind'], number> = {
  arrival: 0,
  'cpu-end': 1,
  'io-end': 2,
  'io-start': 3,
  'cpu-start': 4,
  finish: 5,
};

// Construye el registro completo de eventos
export function buildEventLog(processes: ProcessInput[], result: SchedulingResult): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];

  // Eventos de llegada
  for (const p of processes) {
    events.push({ time: p.arrivalTime, processId: p.id, kind: 'arrival', label: `${p.id} llega al sistema (t=${p.arrivalTime})` });
  }

  // Eventos de inicio/fin de CPU
  for (const slice of result.timeline) {
    events.push({ time: slice.start, processId: slice.processId, kind: 'cpu-start', label: `${slice.processId} comienza a ejecutar en CPU (t=${slice.start})` });
    events.push({ time: slice.end, processId: slice.processId, kind: 'cpu-end', label: `${slice.processId} deja la CPU (t=${slice.end})` });
  }

  // Eventos de inicio/fin de E/S
  for (const slice of result.ioTimeline ?? []) {
    events.push({ time: slice.start, processId: slice.processId, kind: 'io-start', label: `${slice.processId} entra a E/S (t=${slice.start})` });
    events.push({ time: slice.end, processId: slice.processId, kind: 'io-end', label: `${slice.processId} vuelve de E/S (t=${slice.end})` });
  }

  // Eventos de finalización
  for (const pr of result.processResults) {
    events.push({ time: pr.finishTime, processId: pr.processId, kind: 'finish', label: `${pr.processId} finaliza su ejecución (t=${pr.finishTime})` });
  }

  // Ordena por tiempo, luego por tipo de evento, luego por ID
  events.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    if (KIND_PRIORITY[a.kind] !== KIND_PRIORITY[b.kind]) return KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind];
    return a.processId.localeCompare(b.processId);
  });

  return events;
}
