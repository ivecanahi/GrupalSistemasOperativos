import type { ProcessInput, SchedulingResult } from '../types/scheduling';

export interface ScheduleEvent {
  time: number;
  processId: string;
  kind: 'arrival' | 'cpu-start' | 'cpu-end' | 'io-start' | 'io-end' | 'finish';
  label: string;
}

const KIND_PRIORITY: Record<ScheduleEvent['kind'], number> = {
  arrival: 0,
  'cpu-end': 1,
  'io-end': 2,
  'io-start': 3,
  'cpu-start': 4,
  finish: 5,
};

export function buildEventLog(processes: ProcessInput[], result: SchedulingResult): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];

  for (const p of processes) {
    events.push({
      time: p.arrivalTime,
      processId: p.id,
      kind: 'arrival',
      label: `${p.id} llega al sistema (t=${p.arrivalTime})`,
    });
  }

  for (const slice of result.timeline) {
    events.push({
      time: slice.start,
      processId: slice.processId,
      kind: 'cpu-start',
      label: `${slice.processId} comienza a ejecutar en CPU (t=${slice.start})`,
    });
    events.push({
      time: slice.end,
      processId: slice.processId,
      kind: 'cpu-end',
      label: `${slice.processId} deja la CPU (t=${slice.end})`,
    });
  }

  for (const slice of result.ioTimeline ?? []) {
    events.push({
      time: slice.start,
      processId: slice.processId,
      kind: 'io-start',
      label: `${slice.processId} entra a E/S (t=${slice.start})`,
    });
    events.push({
      time: slice.end,
      processId: slice.processId,
      kind: 'io-end',
      label: `${slice.processId} vuelve de E/S (t=${slice.end})`,
    });
  }

  for (const pr of result.processResults) {
    events.push({
      time: pr.finishTime,
      processId: pr.processId,
      kind: 'finish',
      label: `${pr.processId} finaliza su ejecución (t=${pr.finishTime})`,
    });
  }

  events.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    if (KIND_PRIORITY[a.kind] !== KIND_PRIORITY[b.kind]) {
      return KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind];
    }
    return a.processId.localeCompare(b.processId);
  });

  return events;
}
