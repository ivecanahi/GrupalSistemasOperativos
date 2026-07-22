import { describe, it, expect } from 'vitest';
import { runSJF } from './sjf';
import type { ProcessInput, SchedulingResult } from '../types/scheduling';

describe('runSJF — Shortest Job First (non-preemptive)', () => {
  // =========================================================
  // Task 1.3: Shortest burst runs first among arrived
  // =========================================================
  it('should run the shortest burst first among arrived processes [1.3]', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 8 },
      { id: 'B', name: 'B', arrivalTime: 1, burstTime: 4 },
      { id: 'C', name: 'C', arrivalTime: 2, burstTime: 2 },
    ];

    const result: SchedulingResult = runSJF(processes);

    expect(result.timeline).toHaveLength(3);
    // A runs first (only process at t=0)
    expect(result.timeline[0].processId).toBe('A');
    expect(result.timeline[0].start).toBe(0);
    expect(result.timeline[0].end).toBe(8);
    // Then C (shortest burst among B/C at t=8)
    expect(result.timeline[1].processId).toBe('C');
    expect(result.timeline[1].start).toBe(8);
    expect(result.timeline[1].end).toBe(10);
    // Then B
    expect(result.timeline[2].processId).toBe('B');
    expect(result.timeline[2].start).toBe(10);
    expect(result.timeline[2].end).toBe(14);
  });

  // Task 1.3 triangulation: verify process results and averages
  it('should compute correct process results and averages [1.3]', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 8 },
      { id: 'B', name: 'B', arrivalTime: 1, burstTime: 4 },
      { id: 'C', name: 'C', arrivalTime: 2, burstTime: 2 },
    ];

    const result: SchedulingResult = runSJF(processes);

    expect(result.processResults).toHaveLength(3);

    const rA = result.processResults.find(r => r.processId === 'A')!;
    expect(rA.startTime).toBe(0);
    expect(rA.finishTime).toBe(8);
    expect(rA.waitingTime).toBe(0);
    expect(rA.turnaroundTime).toBe(8);

    const rC = result.processResults.find(r => r.processId === 'C')!;
    expect(rC.startTime).toBe(8);
    expect(rC.finishTime).toBe(10);
    expect(rC.waitingTime).toBe(6);  // 8 - 2
    expect(rC.turnaroundTime).toBe(8); // 10 - 2

    const rB = result.processResults.find(r => r.processId === 'B')!;
    expect(rB.startTime).toBe(10);
    expect(rB.finishTime).toBe(14);
    expect(rB.waitingTime).toBe(9);  // 10 - 1
    expect(rB.turnaroundTime).toBe(13); // 14 - 1

    expect(result.averageWaitingTime).toBeCloseTo(5, 5);
    expect(result.averageTurnaroundTime).toBeCloseTo(29 / 3, 5);
  });

  // =========================================================
  // Task 1.4: Tie-break by arrivalTime then ascending id
  // =========================================================
  it('should break ties by ascending id when burst and arrival match [1.4]', () => {
    const processes: ProcessInput[] = [
      { id: 'Z', name: 'Z', arrivalTime: 0, burstTime: 5 },
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 5 },
    ];

    const result: SchedulingResult = runSJF(processes);

    expect(result.timeline).toHaveLength(2);
    // 'A' < 'Z' lexicographically → A runs first
    expect(result.timeline[0].processId).toBe('A');
    expect(result.timeline[0].start).toBe(0);
    expect(result.timeline[0].end).toBe(5);
    expect(result.timeline[1].processId).toBe('Z');
    expect(result.timeline[1].start).toBe(5);
    expect(result.timeline[1].end).toBe(10);
  });

  it('should break ties by earliest arrivalTime on equal burst [1.4]', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 6 },
      { id: 'B', name: 'B', arrivalTime: 2, burstTime: 6 },
      { id: 'C', name: 'C', arrivalTime: 1, burstTime: 6 },
    ];

    // All have burstTime=6, so tie-break by arrivalTime: A(0), C(1), B(2)
    const result: SchedulingResult = runSJF(processes);

    expect(result.timeline[0].processId).toBe('A');
    expect(result.timeline[1].processId).toBe('C');
    expect(result.timeline[2].processId).toBe('B');
  });

  // =========================================================
  // Task 1.5: CPU idle gap before next arrival
  // =========================================================
  it('should jump to next arrival when none have arrived [1.5]', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 5, burstTime: 3 },
    ];

    const result: SchedulingResult = runSJF(processes);

    // No execution slices cover the idle gap [0, 5)
    expect(result.timeline).toHaveLength(1);
    expect(result.timeline[0].processId).toBe('A');
    expect(result.timeline[0].start).toBe(5);
    expect(result.timeline[0].end).toBe(8);
  });

  it('should handle idle gaps between process completions [1.5]', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 2 },
      { id: 'B', name: 'B', arrivalTime: 6, burstTime: 1 },
    ];

    const result: SchedulingResult = runSJF(processes);

    // A runs [0,2], then idle [2,6) — no slice, B runs [6,7]
    expect(result.timeline).toHaveLength(2);
    expect(result.timeline[0].processId).toBe('A');
    expect(result.timeline[0].start).toBe(0);
    expect(result.timeline[0].end).toBe(2);
    expect(result.timeline[1].processId).toBe('B');
    expect(result.timeline[1].start).toBe(6);
    expect(result.timeline[1].end).toBe(7);
  });

  it('should return empty result for no processes', () => {
    const result: SchedulingResult = runSJF([]);

    expect(result.timeline).toHaveLength(0);
    expect(result.processResults).toHaveLength(0);
    expect(result.averageWaitingTime).toBe(0);
    expect(result.averageTurnaroundTime).toBe(0);
  });

  // =========================================================
  // Mid-burst I/O interruption
  // =========================================================
  describe('mid-burst I/O interruption', () => {
    it('produces phase1, io, and phase2 slices for a single process with ioTriggerAfter', () => {
      const processes: ProcessInput[] = [
        { id: 'A', name: 'A', arrivalTime: 0, burstTime: 6, ioBurstTime: 3, ioTriggerAfter: 2 },
      ];

      const result: SchedulingResult = runSJF(processes);

      // phase1: [0,2), io: [2,5), phase2: [5,9)
      expect(result.timeline).toEqual([
        { processId: 'A', start: 0, end: 2 },
        { processId: 'A', start: 5, end: 9 },
      ]);
      expect(result.ioTimeline).toEqual([{ processId: 'A', start: 2, end: 5 }]);
    });

    it('lets an independent process run its own burst during another process I/O wait', () => {
      // A: phase1=2, io=10, phase2=2 (burstTime=4, ioTriggerAfter=2)
      // B arrives during A's io wait with a short burst
      const processes: ProcessInput[] = [
        { id: 'A', name: 'A', arrivalTime: 0, burstTime: 4, ioBurstTime: 10, ioTriggerAfter: 2 },
        { id: 'B', name: 'B', arrivalTime: 3, burstTime: 3 },
      ];

      const result: SchedulingResult = runSJF(processes);

      // A phase1 [0,2), io [2,12)
      // B arrives at 3, CPU is free (A is doing I/O) -> B runs [3,6)
      // A phase2 runs after io ends at 12 -> [12,14)
      const aIo = result.ioTimeline!.find(s => s.processId === 'A')!;
      expect(aIo).toEqual({ processId: 'A', start: 2, end: 12 });

      const bSlice = result.timeline.find(s => s.processId === 'B')!;
      expect(bSlice.start).toBeGreaterThanOrEqual(aIo.start);
      expect(bSlice.end).toBeLessThanOrEqual(aIo.end);
      expect(bSlice).toEqual({ processId: 'B', start: 3, end: 6 });

      const aPhase2 = result.timeline.find(s => s.processId === 'A' && s.start === 12)!;
      expect(aPhase2).toEqual({ processId: 'A', start: 12, end: 14 });
    });

    it('computes waitingTime/turnaroundTime subtracting both burstTime and ioBurstTime', () => {
      const processes: ProcessInput[] = [
        { id: 'A', name: 'A', arrivalTime: 0, burstTime: 6, ioBurstTime: 3, ioTriggerAfter: 2 },
      ];

      const result: SchedulingResult = runSJF(processes);
      const rA = result.processResults[0];

      // finishTime = 9 (phase2 ends at 9), turnaround = 9 - 0 = 9
      // waiting = turnaround - burstTime - ioBurstTime = 9 - 6 - 3 = 0
      expect(rA.finishTime).toBe(9);
      expect(rA.turnaroundTime).toBe(9);
      expect(rA.waitingTime).toBe(0);
    });

    it('behaves like legacy "I/O after full burst" when ioTriggerAfter is omitted', () => {
      const processes: ProcessInput[] = [
        { id: 'A', name: 'A', arrivalTime: 0, burstTime: 5, ioBurstTime: 4 },
      ];

      const result: SchedulingResult = runSJF(processes);

      // phase1Duration = burstTime (5), phase2Duration = 0 -> done right after io
      expect(result.timeline).toEqual([{ processId: 'A', start: 0, end: 5 }]);
      expect(result.ioTimeline).toEqual([{ processId: 'A', start: 5, end: 9 }]);
      expect(result.processResults[0].finishTime).toBe(9);
      expect(result.processResults[0].turnaroundTime).toBe(9);
      expect(result.processResults[0].waitingTime).toBe(0);
    });
  });

  // =========================================================
  // Multi-op I/O: several I/O operations per process
  // =========================================================
  describe('multi-op I/O (several operations per process)', () => {
    it('produces 4 CPU slices and 3 correctly-timed io slices for a process with 3 io operations', () => {
      // burst=10, ops=[{after:2,dur:3},{after:5,dur:4},{after:8,dur:2}]
      // phase durations: 2 ([0,2)), then 3 ([5,8)), then 3 ([12,15)), then 2 ([17,19))
      // io slices: [2,5) dur 3, [8,12) dur 4, [15,17) dur 2
      const processes: ProcessInput[] = [
        {
          id: 'A',
          name: 'A',
          arrivalTime: 0,
          burstTime: 10,
          ioOperations: [
            { after: 2, duration: 3 },
            { after: 5, duration: 4 },
            { after: 8, duration: 2 },
          ],
        },
      ];

      const result: SchedulingResult = runSJF(processes);

      expect(result.timeline).toEqual([
        { processId: 'A', start: 0, end: 2 },
        { processId: 'A', start: 5, end: 8 },
        { processId: 'A', start: 12, end: 15 },
        { processId: 'A', start: 17, end: 19 },
      ]);
      expect(result.ioTimeline).toEqual([
        { processId: 'A', start: 2, end: 5 },
        { processId: 'A', start: 8, end: 12 },
        { processId: 'A', start: 15, end: 17 },
      ]);

      const rA = result.processResults[0];
      expect(rA.finishTime).toBe(19);
      expect(rA.turnaroundTime).toBe(19);
      // waiting = turnaround - burstTime - sum(io durations) = 19 - 10 - 9 = 0
      expect(rA.waitingTime).toBe(0);
    });

    it('lets a concurrently-arriving second process run its own burst during each of the first process I/O waits', () => {
      const processes: ProcessInput[] = [
        {
          id: 'A',
          name: 'A',
          arrivalTime: 0,
          burstTime: 10,
          ioOperations: [
            { after: 2, duration: 3 },
            { after: 5, duration: 4 },
          ],
        },
        { id: 'B', name: 'B', arrivalTime: 3, burstTime: 2 },
      ];

      const result: SchedulingResult = runSJF(processes);

      // A: phase1 [0,2), io [2,5)
      // B arrives at 3 while A is doing io (CPU free) -> B runs [3,5)
      const bSlice = result.timeline.find(s => s.processId === 'B')!;
      expect(bSlice).toEqual({ processId: 'B', start: 3, end: 5 });

      const aIo1 = result.ioTimeline!.find(s => s.processId === 'A' && s.start === 2)!;
      expect(bSlice.start).toBeGreaterThanOrEqual(aIo1.start);
      expect(bSlice.end).toBeLessThanOrEqual(aIo1.end);
    });

    it('takes ioOperations precedence over legacy ioBurstTime/ioTriggerAfter when both are present', () => {
      const processes: ProcessInput[] = [
        {
          id: 'A',
          name: 'A',
          arrivalTime: 0,
          burstTime: 6,
          ioBurstTime: 99,
          ioTriggerAfter: 99,
          ioOperations: [{ after: 2, duration: 3 }],
        },
      ];

      const result: SchedulingResult = runSJF(processes);

      // Should use ioOperations (after:2, duration:3), not the legacy 99/99 values
      expect(result.timeline).toEqual([
        { processId: 'A', start: 0, end: 2 },
        { processId: 'A', start: 5, end: 9 },
      ]);
      expect(result.ioTimeline).toEqual([{ processId: 'A', start: 2, end: 5 }]);
    });

    it('correctly sums all io durations in the waitingTime/turnaroundTime formulas for multiple ops', () => {
      const processes: ProcessInput[] = [
        {
          id: 'A',
          name: 'A',
          arrivalTime: 0,
          burstTime: 8,
          ioOperations: [
            { after: 3, duration: 2 },
            { after: 6, duration: 5 },
          ],
        },
      ];

      const result: SchedulingResult = runSJF(processes);
      const rA = result.processResults[0];

      // phase1 [0,3), io1 [3,5), phase2 [5,8), io2 [8,13), phase3 [13,15)
      expect(rA.finishTime).toBe(15);
      expect(rA.turnaroundTime).toBe(15);
      // waiting = turnaround(15) - burstTime(8) - sumIo(2+5=7) = 0
      expect(rA.waitingTime).toBe(rA.turnaroundTime - 8 - 7);
    });
  });
});
