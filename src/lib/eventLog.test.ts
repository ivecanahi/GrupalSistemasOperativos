import { describe, it, expect } from 'vitest';
import { buildEventLog } from './eventLog';
import type { ProcessInput, SchedulingResult } from '../types/scheduling';

describe('buildEventLog', () => {
  it('produces [arrival, cpu-start, cpu-end, finish] for a simple no-io scenario', () => {
    const processes: ProcessInput[] = [
      { id: 'P1', name: 'P1', arrivalTime: 2, burstTime: 3 },
    ];
    const result: SchedulingResult = {
      timeline: [{ processId: 'P1', start: 2, end: 5 }],
      processResults: [
        { processId: 'P1', arrivalTime: 2, startTime: 2, finishTime: 5, waitingTime: 0, turnaroundTime: 3 },
      ],
      averageWaitingTime: 0,
      averageTurnaroundTime: 3,
    };

    const events = buildEventLog(processes, result);

    expect(events.map(e => e.kind)).toEqual(['arrival', 'cpu-start', 'cpu-end', 'finish']);
    expect(events[0]).toMatchObject({ time: 2, processId: 'P1', kind: 'arrival', label: 'P1 llega al sistema (t=2)' });
    expect(events[1]).toMatchObject({ time: 2, processId: 'P1', kind: 'cpu-start', label: 'P1 comienza a ejecutar en CPU (t=2)' });
    expect(events[2]).toMatchObject({ time: 5, processId: 'P1', kind: 'cpu-end', label: 'P1 deja la CPU (t=5)' });
    expect(events[3]).toMatchObject({ time: 5, processId: 'P1', kind: 'finish', label: 'P1 finaliza su ejecución (t=5)' });
  });

  it('produces the full 6-event sequence for a scenario with I/O', () => {
    const processes: ProcessInput[] = [
      { id: 'P1', name: 'P1', arrivalTime: 0, burstTime: 4, ioOperations: [{ after: 2, duration: 3 }] },
    ];
    const result: SchedulingResult = {
      timeline: [
        { processId: 'P1', start: 0, end: 2 },
        { processId: 'P1', start: 5, end: 7 },
      ],
      ioTimeline: [{ processId: 'P1', start: 2, end: 5 }],
      processResults: [
        { processId: 'P1', arrivalTime: 0, startTime: 0, finishTime: 7, waitingTime: 0, turnaroundTime: 7 },
      ],
      averageWaitingTime: 0,
      averageTurnaroundTime: 7,
    };

    const events = buildEventLog(processes, result);

    expect(events.map(e => e.kind)).toEqual([
      'arrival', 'cpu-start', 'cpu-end', 'io-start', 'io-end', 'cpu-start', 'cpu-end', 'finish',
    ]);
    expect(events.map(e => e.time)).toEqual([0, 0, 2, 2, 5, 5, 7, 7]);
  });

  it('tie-breaks simultaneous events by kind priority then ascending processId', () => {
    const processes: ProcessInput[] = [
      { id: 'P2', name: 'P2', arrivalTime: 3, burstTime: 2 },
      { id: 'P1', name: 'P1', arrivalTime: 3, burstTime: 2 },
    ];
    const result: SchedulingResult = {
      timeline: [
        { processId: 'P1', start: 1, end: 3 },
        { processId: 'P1', start: 3, end: 5 },
      ],
      processResults: [
        { processId: 'P1', arrivalTime: 3, startTime: 1, finishTime: 5, waitingTime: 0, turnaroundTime: 2 },
        { processId: 'P2', arrivalTime: 3, startTime: 3, finishTime: 3, waitingTime: 0, turnaroundTime: 0 },
      ],
      averageWaitingTime: 0,
      averageTurnaroundTime: 1,
    };

    const events = buildEventLog(processes, result);
    const atThree = events.filter(e => e.time === 3);

    // At t=3: cpu-end (P1) < finish (P2, but finish priority 5 > arrival 0)
    // Expected order by kind priority: arrival(P1)=0, arrival(P2)=0 tie-break by id -> P1, P2
    // cpu-end(P1)=1, cpu-start(P1)=4, finish(P2)=5
    expect(atThree.map(e => `${e.kind}:${e.processId}`)).toEqual([
      'arrival:P1',
      'arrival:P2',
      'cpu-end:P1',
      'cpu-start:P1',
      'finish:P2',
    ]);
  });

  it('produces an empty event log for an empty process list', () => {
    const result: SchedulingResult = {
      timeline: [],
      processResults: [],
      averageWaitingTime: 0,
      averageTurnaroundTime: 0,
    };

    expect(buildEventLog([], result)).toEqual([]);
  });
});
