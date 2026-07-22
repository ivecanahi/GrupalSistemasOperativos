import { describe, it, expect } from 'vitest';
import { runMLQ } from './mlq';
import { runSJF } from './sjf';
import { runRoundRobin } from './roundRobin';
import type { ProcessInput, SchedulingResult } from '../types/scheduling';

describe('runMLQ — Multilevel Queue Scheduling (SJF queue + RR queue, fixed priority)', () => {
  // =========================================================
  // Edge case: empty process list
  // =========================================================
  it('returns an empty result for an empty process list', () => {
    const result: SchedulingResult = runMLQ([], 4, 'SJF');

    expect(result.timeline).toHaveLength(0);
    expect(result.processResults).toHaveLength(0);
    expect(result.averageWaitingTime).toBe(0);
    expect(result.averageTurnaroundTime).toBe(0);
    expect(result.ioTimeline).toEqual([]);
  });

  // =========================================================
  // Regression: all processes in the SJF queue == plain runSJF
  // =========================================================
  it('produces an identical result to runSJF when every process is in the SJF queue', () => {
    const base: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 8 },
      { id: 'B', name: 'B', arrivalTime: 1, burstTime: 4 },
      { id: 'C', name: 'C', arrivalTime: 2, burstTime: 2 },
    ];
    const withQueue: ProcessInput[] = base.map(p => ({ ...p, queue: 'SJF' }));

    const mlqResult = runMLQ(withQueue, 3, 'RR');
    const sjfResult = runSJF(base);

    expect(mlqResult.timeline).toEqual(sjfResult.timeline);
    expect(mlqResult.ioTimeline).toEqual(sjfResult.ioTimeline);
    expect(mlqResult.processResults).toEqual(sjfResult.processResults);
    expect(mlqResult.averageWaitingTime).toBe(sjfResult.averageWaitingTime);
    expect(mlqResult.averageTurnaroundTime).toBe(sjfResult.averageTurnaroundTime);
  });

  // =========================================================
  // Regression: all processes in the RR queue == plain runRoundRobin
  // =========================================================
  it('produces an identical result to runRoundRobin when every process is in the RR queue', () => {
    const base: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 10 },
      { id: 'B', name: 'B', arrivalTime: 4, burstTime: 2 },
      { id: 'C', name: 'C', arrivalTime: 4, burstTime: 10 },
    ];
    const withQueue: ProcessInput[] = base.map(p => ({ ...p, queue: 'RR' }));

    const mlqResult = runMLQ(withQueue, 4, 'SJF');
    const rrResult = runRoundRobin(base, 4);

    expect(mlqResult.timeline).toEqual(rrResult.timeline);
    expect(mlqResult.ioTimeline).toEqual(rrResult.ioTimeline);
    expect(mlqResult.processResults).toEqual(rrResult.processResults);
    expect(mlqResult.averageWaitingTime).toBe(rrResult.averageWaitingTime);
    expect(mlqResult.averageTurnaroundTime).toBe(rrResult.averageTurnaroundTime);
  });

  // =========================================================
  // Mixed queues, priorityQueue: 'SJF'
  // Proves: RR-queue process is not interrupted mid-quantum-slice;
  // SJF-queue process dispatched at the very next decision point;
  // RR resumes with its remaining time preserved (not restarted).
  // =========================================================
  it('lets SJF-queue win at the next dispatch boundary without interrupting an in-progress RR quantum slice', () => {
    const processes: ProcessInput[] = [
      { id: 'R1', name: 'R1', arrivalTime: 0, burstTime: 10, queue: 'RR' },
      { id: 'S1', name: 'S1', arrivalTime: 2, burstTime: 3, queue: 'SJF' },
    ];

    const result = runMLQ(processes, 4, 'SJF');

    // R1's quantum slice [0,4) is NOT interrupted at t=2 when S1 arrives.
    // S1 dispatched right after, at t=4 (next decision point).
    // R1 resumes at t=7 with remaining=6 (not restarted at burstTime=10).
    expect(result.timeline).toEqual([
      { processId: 'R1', start: 0, end: 4 },
      { processId: 'S1', start: 4, end: 7 },
      { processId: 'R1', start: 7, end: 11 },
      { processId: 'R1', start: 11, end: 13 },
    ]);

    const rR1 = result.processResults.find(r => r.processId === 'R1')!;
    expect(rR1.finishTime).toBe(13);
    expect(rR1.turnaroundTime).toBe(13);
    expect(rR1.waitingTime).toBe(3); // 13 - 0 - 10

    const rS1 = result.processResults.find(r => r.processId === 'S1')!;
    expect(rS1.startTime).toBe(4);
    expect(rS1.finishTime).toBe(7);
    expect(rS1.turnaroundTime).toBe(5); // 7 - 2
    expect(rS1.waitingTime).toBe(2); // 5 - 3
  });

  // =========================================================
  // Mixed queues, priorityQueue: 'RR' (symmetric)
  // Proves: RR queue keeps the CPU over a waiting SJF-queue
  // process for as long as RR has anyone ready; SJF-queue only
  // runs once RR-queue is completely drained.
  // =========================================================
  it('lets RR-queue keep the CPU over a waiting SJF-queue process until RR-queue drains', () => {
    const processes: ProcessInput[] = [
      { id: 'R1', name: 'R1', arrivalTime: 0, burstTime: 8, queue: 'RR' },
      { id: 'S1', name: 'S1', arrivalTime: 1, burstTime: 2, queue: 'SJF' },
    ];

    const result = runMLQ(processes, 3, 'RR');

    // R1 monopolizes the CPU across 3 quanta ([0,3), [3,6), [6,8)) even
    // though S1 is ready from t=1. S1 only runs once R1 has finished.
    expect(result.timeline).toEqual([
      { processId: 'R1', start: 0, end: 3 },
      { processId: 'R1', start: 3, end: 6 },
      { processId: 'R1', start: 6, end: 8 },
      { processId: 'S1', start: 8, end: 10 },
    ]);

    const rR1 = result.processResults.find(r => r.processId === 'R1')!;
    expect(rR1.finishTime).toBe(8);
    expect(rR1.turnaroundTime).toBe(8);
    expect(rR1.waitingTime).toBe(0);

    const rS1 = result.processResults.find(r => r.processId === 'S1')!;
    expect(rS1.finishTime).toBe(10);
    expect(rS1.turnaroundTime).toBe(9); // 10 - 1
    expect(rS1.waitingTime).toBe(7); // 9 - 2
  });

  // =========================================================
  // I/O interaction with cross-queue priority: a process mid-I/O
  // is NOT a ready candidate, so the other queue gets the CPU
  // even while it would normally be lower priority.
  // =========================================================
  it('lets the non-priority queue run while the priority-queue process is doing I/O, for both queues having I/O', () => {
    const processes: ProcessInput[] = [
      {
        id: 'S1',
        name: 'S1',
        arrivalTime: 0,
        burstTime: 5,
        queue: 'SJF',
        ioOperations: [{ after: 2, duration: 5 }],
      },
      {
        id: 'R1',
        name: 'R1',
        arrivalTime: 0,
        burstTime: 6,
        queue: 'RR',
        ioOperations: [{ after: 3, duration: 2 }],
      },
    ];

    const result = runMLQ(processes, 10, 'SJF');

    // S1 (priority=SJF) runs phase1 [0,2), goes to io [2,7).
    // While S1 is in io (not a ready candidate), R1 (RR, "lower priority")
    // gets the CPU: [2,5), then goes to its own io [5,7).
    // Both ios end at t=7: S1 (priority) wins the tie and runs phase2 [7,10).
    // R1 resumes afterward [10,13), remaining preserved (not restarted).
    expect(result.timeline).toEqual([
      { processId: 'S1', start: 0, end: 2 },
      { processId: 'R1', start: 2, end: 5 },
      { processId: 'S1', start: 7, end: 10 },
      { processId: 'R1', start: 10, end: 13 },
    ]);
    expect(result.ioTimeline).toEqual([
      { processId: 'S1', start: 2, end: 7 },
      { processId: 'R1', start: 5, end: 7 },
    ]);

    const rS1 = result.processResults.find(r => r.processId === 'S1')!;
    expect(rS1.finishTime).toBe(10);
    expect(rS1.turnaroundTime).toBe(10);
    expect(rS1.waitingTime).toBe(0); // 10 - 5 - 5

    const rR1 = result.processResults.find(r => r.processId === 'R1')!;
    expect(rR1.finishTime).toBe(13);
    expect(rR1.turnaroundTime).toBe(13);
    expect(rR1.waitingTime).toBe(5); // 13 - 6 - 2
  });

  // =========================================================
  // waitingTime/turnaroundTime formulas hold for both queues
  // =========================================================
  it('computes waitingTime = turnaround - burstTime - sumIo and turnaroundTime = finish - arrival for both queues', () => {
    const processes: ProcessInput[] = [
      { id: 'S1', name: 'S1', arrivalTime: 0, burstTime: 4, queue: 'SJF' },
      { id: 'R1', name: 'R1', arrivalTime: 0, burstTime: 6, queue: 'RR' },
    ];

    const result = runMLQ(processes, 3, 'SJF');

    for (const r of result.processResults) {
      const input = processes.find(p => p.id === r.processId)!;
      expect(r.turnaroundTime).toBe(r.finishTime - input.arrivalTime);
      const sumIo = (input.ioOperations ?? []).reduce((s, op) => s + op.duration, 0);
      expect(r.waitingTime).toBe(r.turnaroundTime - input.burstTime - sumIo);
    }

    const expectedAvgWaiting =
      result.processResults.reduce((s, r) => s + r.waitingTime, 0) / result.processResults.length;
    const expectedAvgTurnaround =
      result.processResults.reduce((s, r) => s + r.turnaroundTime, 0) / result.processResults.length;
    expect(result.averageWaitingTime).toBe(expectedAvgWaiting);
    expect(result.averageTurnaroundTime).toBe(expectedAvgTurnaround);
  });

  // =========================================================
  // Default queue: a process with no explicit `queue` defaults to SJF
  // =========================================================
  it('defaults a process without an explicit queue field to the SJF queue', () => {
    const withDefault: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 5 }, // no `queue` field
      { id: 'B', name: 'B', arrivalTime: 0, burstTime: 3, queue: 'SJF' },
    ];
    const explicitEquivalent: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 5, queue: 'SJF' },
      { id: 'B', name: 'B', arrivalTime: 0, burstTime: 3, queue: 'SJF' },
    ];

    const resultDefault = runMLQ(withDefault, 4, 'RR');
    const resultExplicit = runMLQ(explicitEquivalent, 4, 'RR');
    const sjfResult = runSJF(withDefault);

    expect(resultDefault.timeline).toEqual(resultExplicit.timeline);
    expect(resultDefault.timeline).toEqual(sjfResult.timeline);
    expect(resultDefault.processResults).toEqual(sjfResult.processResults);
  });

  // =========================================================
  // Edge case: quantum <= 0 throws
  // =========================================================
  it('throws when quantum is zero or negative', () => {
    const processes: ProcessInput[] = [{ id: 'A', name: 'A', arrivalTime: 0, burstTime: 3, queue: 'RR' }];

    expect(() => runMLQ(processes, 0, 'SJF')).toThrow();
    expect(() => runMLQ(processes, -1, 'SJF')).toThrow();
  });
});
