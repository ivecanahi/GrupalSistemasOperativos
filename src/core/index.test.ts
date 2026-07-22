import { describe, it, expect } from 'vitest';
import { schedule } from './index';
import type { ProcessInput, SchedulerConfig } from '../types/scheduling';

describe('schedule() — dispatcher', () => {
  // =========================================================
  // Task 1.14: schedule() dispatches correctly and validates RR quantum
  // =========================================================
  it('should dispatch to runSJF for SJF algorithm and produce correct timeline [1.14]', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 5 },
    ];
    const config: SchedulerConfig = { algorithm: 'SJF' };

    const result = schedule(processes, config);

    expect(result.timeline).toHaveLength(1);
    expect(result.timeline[0].processId).toBe('A');
    expect(result.timeline[0].start).toBe(0);
    expect(result.timeline[0].end).toBe(5);

    expect(result.processResults).toHaveLength(1);
    expect(result.processResults[0].waitingTime).toBe(0);
    expect(result.processResults[0].turnaroundTime).toBe(5);
  });

  it('should dispatch to runRoundRobin for RR algorithm with valid quantum [1.14]', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 3 },
    ];
    const config: SchedulerConfig = { algorithm: 'RR', quantum: 4 };

    const result = schedule(processes, config);

    expect(result.timeline).toHaveLength(1);
    expect(result.timeline[0].processId).toBe('A');
  });

  it('should throw when RR quantum is undefined [1.14]', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 3 },
    ];
    const config: SchedulerConfig = { algorithm: 'RR' };

    expect(() => schedule(processes, config)).toThrow('quantum');
  });

  it('should throw when RR quantum is zero or negative [1.14]', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 3 },
    ];

    expect(() => schedule(processes, { algorithm: 'RR', quantum: 0 })).toThrow('quantum');
    expect(() => schedule(processes, { algorithm: 'RR', quantum: -1 })).toThrow('quantum');
    expect(() => schedule(processes, { algorithm: 'RR', quantum: -5 })).toThrow('quantum');
  });

  // =========================================================
  // Task 1.15: Verify existing schedule() satisfies specs
  // =========================================================
  it('should handle empty process list for both algorithms [1.15]', () => {
    const sjfResult = schedule([], { algorithm: 'SJF' });
    expect(sjfResult.timeline).toHaveLength(0);
    expect(sjfResult.processResults).toHaveLength(0);

    const rrResult = schedule([], { algorithm: 'RR', quantum: 4 });
    expect(rrResult.timeline).toHaveLength(0);
    expect(rrResult.processResults).toHaveLength(0);
  });

  it('should run SJF ignoring quantum when present in config [1.15]', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 3 },
    ];
    // Quantum is ignored for SJF
    const result = schedule(processes, { algorithm: 'SJF', quantum: 999 });

    expect(result.timeline).toHaveLength(1);
    expect(result.timeline[0].end).toBe(3);
  });

  // =========================================================
  // I/O burst: finishTime/turnaroundTime extended, waitingTime unchanged
  // =========================================================
  it('extends finishTime/turnaroundTime by ioBurstTime and leaves waitingTime unchanged', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 5, ioBurstTime: 4 },
    ];

    const result = schedule(processes, { algorithm: 'SJF' });

    expect(result.processResults[0].finishTime).toBe(9); // 5 (cpu) + 4 (io)
    expect(result.processResults[0].turnaroundTime).toBe(9);
    expect(result.processResults[0].waitingTime).toBe(0);
  });

  it('recomputes averageTurnaroundTime to reflect I/O adjustment, averageWaitingTime unchanged', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 5, ioBurstTime: 4 },
      { id: 'B', name: 'B', arrivalTime: 5, burstTime: 3 },
    ];

    const result = schedule(processes, { algorithm: 'SJF' });

    // A: turnaround 9 (5 cpu + 4 io), B: turnaround 3 (no io)
    expect(result.averageTurnaroundTime).toBe((9 + 3) / 2);
    expect(result.averageWaitingTime).toBe(0);
  });

  it('populates result.queues with cpu/ready/io arrays', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 5, ioBurstTime: 4 },
    ];

    const result = schedule(processes, { algorithm: 'SJF' });

    expect(result.queues).toBeDefined();
    expect(result.queues!.cpu).toEqual([{ processId: 'A', start: 0, end: 5 }]);
    expect(result.queues!.ready).toEqual([{ processId: 'A', start: 0, end: 0 }]);
    expect(result.queues!.io).toEqual([{ processId: 'A', start: 5, end: 9 }]);
  });

  it('mid-burst I/O (ioTriggerAfter) flows end-to-end through schedule() into queues', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 6, ioBurstTime: 3, ioTriggerAfter: 2 },
    ];

    const result = schedule(processes, { algorithm: 'SJF' });

    // phase1 [0,2), io [2,5), phase2 [5,9)
    expect(result.timeline).toEqual([
      { processId: 'A', start: 0, end: 2 },
      { processId: 'A', start: 5, end: 9 },
    ]);
    expect(result.queues!.io).toEqual([{ processId: 'A', start: 2, end: 5 }]);
    expect(result.processResults[0].finishTime).toBe(9);
    expect(result.processResults[0].turnaroundTime).toBe(9);
    expect(result.processResults[0].waitingTime).toBe(0);
  });

  // =========================================================
  // MLQ dispatch
  // =========================================================
  it('dispatches to runMLQ for MLQ algorithm and produces a combined timeline', () => {
    const processes: ProcessInput[] = [
      { id: 'S1', name: 'S1', arrivalTime: 0, burstTime: 4, queue: 'SJF' },
      { id: 'R1', name: 'R1', arrivalTime: 0, burstTime: 6, queue: 'RR' },
    ];
    const config: SchedulerConfig = { algorithm: 'MLQ', quantum: 3, priorityQueue: 'SJF' };

    const result = schedule(processes, config);

    expect(result.timeline.length).toBeGreaterThan(0);
    expect(result.processResults).toHaveLength(2);
    expect(result.queues).toBeDefined();
  });

  it('throws a clear Spanish error when MLQ quantum is missing', () => {
    const processes: ProcessInput[] = [{ id: 'A', name: 'A', arrivalTime: 0, burstTime: 3 }];
    const config: SchedulerConfig = { algorithm: 'MLQ' };

    expect(() => schedule(processes, config)).toThrow('quantum');
  });

  it('throws a clear Spanish error when MLQ quantum is zero or negative', () => {
    const processes: ProcessInput[] = [{ id: 'A', name: 'A', arrivalTime: 0, burstTime: 3 }];

    expect(() => schedule(processes, { algorithm: 'MLQ', quantum: 0 })).toThrow('quantum');
    expect(() => schedule(processes, { algorithm: 'MLQ', quantum: -1 })).toThrow('quantum');
  });

  it('defaults priorityQueue to SJF when omitted for MLQ', () => {
    const processes: ProcessInput[] = [
      { id: 'S1', name: 'S1', arrivalTime: 0, burstTime: 4, queue: 'SJF' },
      { id: 'R1', name: 'R1', arrivalTime: 0, burstTime: 6, queue: 'RR' },
    ];

    const withDefault = schedule(processes, { algorithm: 'MLQ', quantum: 3 });
    const withExplicitSjf = schedule(processes, { algorithm: 'MLQ', quantum: 3, priorityQueue: 'SJF' });

    expect(withDefault.timeline).toEqual(withExplicitSjf.timeline);
  });

  it('a process without ioBurstTime has identical results to before (regression safety)', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 5 },
      { id: 'B', name: 'B', arrivalTime: 1, burstTime: 3 },
    ];

    const result = schedule(processes, { algorithm: 'SJF' });

    expect(result.processResults).toEqual([
      { processId: 'A', arrivalTime: 0, startTime: 0, finishTime: 5, waitingTime: 0, turnaroundTime: 5 },
      { processId: 'B', arrivalTime: 1, startTime: 5, finishTime: 8, waitingTime: 4, turnaroundTime: 7 },
    ]);
    expect(result.averageTurnaroundTime).toBe((5 + 7) / 2);
  });
});
