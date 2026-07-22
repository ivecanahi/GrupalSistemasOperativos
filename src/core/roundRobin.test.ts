import { describe, it, expect } from 'vitest';
import { runRoundRobin } from './roundRobin';
import type { ProcessInput, SchedulingResult } from '../types/scheduling';

describe('runRoundRobin', () => {
  // =========================================================
  // Task 1.8: Process finishes within quantum — not requeued
  // =========================================================
  it('should let a process finish within its quantum (not requeued) [1.8]', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 3 },
    ];
    const quantum = 5;

    const result: SchedulingResult = runRoundRobin(processes, quantum);

    // A runs to completion in one slice
    expect(result.timeline).toHaveLength(1);
    expect(result.timeline[0].processId).toBe('A');
    expect(result.timeline[0].start).toBe(0);
    expect(result.timeline[0].end).toBe(3);

    // Process result reflects correct metrics
    expect(result.processResults).toHaveLength(1);
    expect(result.processResults[0].startTime).toBe(0);
    expect(result.processResults[0].finishTime).toBe(3);
    expect(result.processResults[0].waitingTime).toBe(0);
    expect(result.processResults[0].turnaroundTime).toBe(3);
  });

  // Triangulation: multiple processes, some finish within quantum
  it('should handle multiple processes where one finishes within quantum [1.8]', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 2 },
      { id: 'B', name: 'B', arrivalTime: 0, burstTime: 7 },
    ];
    const quantum = 4;

    const result: SchedulingResult = runRoundRobin(processes, quantum);

    // A finishes in its first quantum [0,2]
    // Then B runs [2,6] (4 units), preempted, requeued
    // Then A is done, B runs [6,9] (remaining 3)
    expect(result.timeline[0].processId).toBe('A');
    expect(result.timeline[0].end).toBe(2);

    const rA = result.processResults.find(r => r.processId === 'A')!;
    expect(rA.finishTime).toBe(2);
    expect(rA.waitingTime).toBe(0); // arrived at 0, started at 0
    expect(rA.turnaroundTime).toBe(2);

    const rB = result.processResults.find(r => r.processId === 'B')!;
    expect(rB.finishTime).toBe(9);
    expect(rB.turnaroundTime).toBe(9); // 9 - 0
  });

  // =========================================================
  // Task 1.9: Process exceeds quantum — preempted and requeued
  // =========================================================
  it('should preempt a process that exceeds the quantum [1.9]', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 7 },
    ];
    const quantum = 5;

    const result: SchedulingResult = runRoundRobin(processes, quantum);

    // A runs [0,5] (preempted), then [5,7] (finishes)
    expect(result.timeline).toHaveLength(2);
    expect(result.timeline[0].processId).toBe('A');
    expect(result.timeline[0].start).toBe(0);
    expect(result.timeline[0].end).toBe(5);
    expect(result.timeline[1].processId).toBe('A');
    expect(result.timeline[1].start).toBe(5);
    expect(result.timeline[1].end).toBe(7);
  });

  // Triangulation: two processes both exceeding quantum
  it('should round-robin between two processes that exceed quantum [1.9]', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 6 },
      { id: 'B', name: 'B', arrivalTime: 0, burstTime: 9 },
    ];
    const quantum = 4;

    const result: SchedulingResult = runRoundRobin(processes, quantum);

    // Timeline: A[0,4], B[4,8], A[8,10] (remaining 2), B[10,15] (remaining 5)
    // A runs [10, ...] wait let me recalculate
    // A(0,6) B(0,9) q=4
    // t=0: A runs [0,4], remaining A=2, requeued
    // t=4: B runs [4,8], remaining B=5, requeued
    // t=8: A runs [8,10] (remaining 2 <= 4, finishes)
    // t=10: B runs [10,14] (remaining 1... wait, B had 5 remaining, runs 4, remaining 1)
    // Actually, B remaining after t=8 run is 9-4=5. At t=10, B runs min(5,4)=4, [10,14], remaining 1
    // t=14: B runs [14,15], finishes

    expect(result.timeline.map(s => `${s.processId}[${s.start},${s.end})`)).toEqual([
      'A[0,4)',
      'B[4,8)',
      'A[8,10)',
      'B[10,14)',
      'B[14,15)',
    ]);

    const rA = result.processResults.find(r => r.processId === 'A')!;
    expect(rA.finishTime).toBe(10);
    expect(rA.turnaroundTime).toBe(10);
    expect(rA.waitingTime).toBe(4); // 10 - 0 - 6 = 4

    const rB = result.processResults.find(r => r.processId === 'B')!;
    expect(rB.finishTime).toBe(15);
    expect(rB.turnaroundTime).toBe(15);
    expect(rB.waitingTime).toBe(6); // 15 - 0 - 9 = 6
  });

  // =========================================================
  // Task 1.10: Idle gap when queue empty and next arrival pending
  // =========================================================
  it('should jump to next arrival when ready queue is empty [1.10]', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 5, burstTime: 3 },
    ];
    const quantum = 4;

    const result: SchedulingResult = runRoundRobin(processes, quantum);

    expect(result.timeline).toHaveLength(1);
    expect(result.timeline[0].processId).toBe('A');
    expect(result.timeline[0].start).toBe(5);
    expect(result.timeline[0].end).toBe(8);
  });

  // Triangulation: idle gap after preemption of all processes
  it('should create idle gap when all processes finish and later arrival exists [1.10]', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 2 },
      { id: 'B', name: 'B', arrivalTime: 7, burstTime: 1 },
    ];
    const quantum = 3;

    const result: SchedulingResult = runRoundRobin(processes, quantum);

    // A runs [0,2] (finishes within quantum)
    // Queue empty at t=2, jump to t=7 (B's arrival)
    // B runs [7,8] (finishes within quantum)
    expect(result.timeline).toHaveLength(2);
    expect(result.timeline[0].processId).toBe('A');
    expect(result.timeline[0].end).toBe(2);
    expect(result.timeline[1].processId).toBe('B');
    expect(result.timeline[1].start).toBe(7);
    expect(result.timeline[1].end).toBe(8);
  });

  // =========================================================
  // Task 1.11: Simultaneous arrival + quantum expiry
  // Silberschatz convention: new arrival Y enqueued BEFORE requeued X
  // =========================================================
  it('should enqueue new arrival Y before requeued X at simultaneous expiry [1.11]', () => {
    const processes: ProcessInput[] = [
      { id: 'X', name: 'X', arrivalTime: 0, burstTime: 8 },
      { id: 'Y', name: 'Y', arrivalTime: 4, burstTime: 4 },
    ];
    const quantum = 4;

    const result: SchedulingResult = runRoundRobin(processes, quantum);

    // t=0: X runs [0,4], quantum expires at t=4
    // t=4: Y arrives and X's quantum expires simultaneously
    // Y enqueued before X requeued → Y runs next
    // X runs [0,4], Y runs [4,8], X runs [8,12]
    expect(result.timeline).toHaveLength(3);
    expect(result.timeline[0].processId).toBe('X');
    expect(result.timeline[0].start).toBe(0);
    expect(result.timeline[0].end).toBe(4);
    expect(result.timeline[1].processId).toBe('Y');
    expect(result.timeline[1].start).toBe(4);
    expect(result.timeline[1].end).toBe(8);
    expect(result.timeline[2].processId).toBe('X');
    expect(result.timeline[2].start).toBe(8);
    expect(result.timeline[2].end).toBe(12);

    // Verify Y's process result
    const rY = result.processResults.find(r => r.processId === 'Y')!;
    expect(rY.startTime).toBe(4);
    expect(rY.finishTime).toBe(8);
    expect(rY.waitingTime).toBe(0);
    expect(rY.turnaroundTime).toBe(4);
  });

  // Triangulation: multiple simultaneous arrivals at different quantum boundaries
  it('should handle multiple arrivals at quantum boundaries [1.11]', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 10 },
      { id: 'B', name: 'B', arrivalTime: 4, burstTime: 2 },
      { id: 'C', name: 'C', arrivalTime: 4, burstTime: 10 },
    ];
    const quantum = 4;

    const result: SchedulingResult = runRoundRobin(processes, quantum);

    // A runs [0,4] (expires at t=4)
    // At t=4: B and C arrive simultaneously
    // Queue order: B (arrived), C (arrived), A (requeued)
    // B runs [4,6] (finishes within quantum)
    // C runs [6,10] (preempted, remaining 6)
    // A runs [10,14] (remaining 6... wait, A had 10-4=6 remaining, runs 4, remaining 2)
    // Wait, let me redo this.

    // After t=4: ready queue = [B, C, A] (B and C arrived, A requeued)
    // t=4-6: B runs (burst=2), finishes
    // t=6: ready queue = [C, A]
    // t=6-10: C runs (quantum=4, remaining 10-4=6), preempted
    // t=10: ready queue = [A, C]
    // t=10-14: A runs (remaining 6, runs 4, remaining 2), preempted
    // t=14: ready queue = [C, A]
    // t=14-18: C runs (remaining 6, runs 4, remaining 2), preempted
    // t=18: ready queue = [A, C]
    // t=18-20: A runs (remaining 2, finishes)
    // t=20: ready queue = [C]
    // t=20-22: C runs (remaining 2, finishes)

    // Key verification: Silberschatz convention — at t=4, B and C arrive
    // before A is requeued, so queue = [B, C, A] and B runs next
    expect(result.timeline[1].processId).toBe('B');

    const rB = result.processResults.find(r => r.processId === 'B')!;
    expect(rB.startTime).toBe(4);
    expect(rB.finishTime).toBe(6);
  });

  // =========================================================
  // Edge cases
  // =========================================================
  it('should return empty result for empty process list', () => {
    const result: SchedulingResult = runRoundRobin([], 5);

    expect(result.timeline).toHaveLength(0);
    expect(result.processResults).toHaveLength(0);
    expect(result.averageWaitingTime).toBe(0);
    expect(result.averageTurnaroundTime).toBe(0);
  });

  it('should handle zero quantum by throwing', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 3 },
    ];

    expect(() => runRoundRobin(processes, 0)).toThrow();
    expect(() => runRoundRobin(processes, -1)).toThrow();
  });

  // =========================================================
  // Mid-burst I/O interruption
  // =========================================================
  describe('mid-burst I/O interruption', () => {
    it('preempts mid-quantum before reaching the I/O trigger point, then resumes phase1 later', () => {
      // A: burstTime=6, ioTriggerAfter=5 (io triggers after 5 units of CPU), quantum=3
      // t=0: A runs [0,3) (quantum expires before reaching ioTriggerAfter=5), remaining phase1 = 2, requeued
      // t=3: A runs again [3,5) (remaining phase1 = 2 <= quantum), phase1 exhausted -> io starts
      const processes: ProcessInput[] = [
        { id: 'A', name: 'A', arrivalTime: 0, burstTime: 6, ioBurstTime: 4, ioTriggerAfter: 5 },
      ];
      const quantum = 3;

      const result = runRoundRobin(processes, quantum);

      expect(result.timeline).toEqual([
        { processId: 'A', start: 0, end: 3 },
        { processId: 'A', start: 3, end: 5 },
        { processId: 'A', start: 9, end: 10 }, // io [5,9), phase2 (1 unit) runs [9,10)
      ]);
      expect(result.ioTimeline).toEqual([{ processId: 'A', start: 5, end: 9 }]);
    });

    it('completes phase1 across several quanta, goes to io, then resumes phase2 across several quanta', () => {
      // A: burstTime=10, ioTriggerAfter=4, ioBurstTime=6, quantum=2
      // phase1 (4 units): [0,2), [2,4) -> io [4,10)
      // phase2 (6 units): [10,12), [12,14), [14,16)
      const processes: ProcessInput[] = [
        { id: 'A', name: 'A', arrivalTime: 0, burstTime: 10, ioBurstTime: 6, ioTriggerAfter: 4 },
      ];
      const quantum = 2;

      const result = runRoundRobin(processes, quantum);

      expect(result.timeline).toEqual([
        { processId: 'A', start: 0, end: 2 },
        { processId: 'A', start: 2, end: 4 },
        { processId: 'A', start: 10, end: 12 },
        { processId: 'A', start: 12, end: 14 },
        { processId: 'A', start: 14, end: 16 },
      ]);
      expect(result.ioTimeline).toEqual([{ processId: 'A', start: 4, end: 10 }]);

      const rA = result.processResults[0];
      expect(rA.finishTime).toBe(16);
      expect(rA.turnaroundTime).toBe(16);
      expect(rA.waitingTime).toBe(0); // 16 - 10 (burst) - 6 (io) = 0
    });

    it('lets another ready process get CPU time during the first process I/O wait', () => {
      // A: burstTime=4, ioTriggerAfter=2, ioBurstTime=10, quantum=5
      // A runs [0,2) (phase1, whole phase1 within quantum), io starts [2,12)
      // B arrives at 3 (during A's io) and runs its own burst while CPU is free
      const processes: ProcessInput[] = [
        { id: 'A', name: 'A', arrivalTime: 0, burstTime: 4, ioBurstTime: 10, ioTriggerAfter: 2 },
        { id: 'B', name: 'B', arrivalTime: 3, burstTime: 3 },
      ];
      const quantum = 5;

      const result = runRoundRobin(processes, quantum);

      const aIo = result.ioTimeline!.find(s => s.processId === 'A')!;
      expect(aIo).toEqual({ processId: 'A', start: 2, end: 12 });

      const bSlice = result.timeline.find(s => s.processId === 'B')!;
      expect(bSlice).toEqual({ processId: 'B', start: 3, end: 6 });
      expect(bSlice.start).toBeGreaterThanOrEqual(aIo.start);
      expect(bSlice.end).toBeLessThanOrEqual(aIo.end);
    });

    it('merges an arrival and an I/O-return that become ready at the same instant by readyTime then id', () => {
      // A: burstTime=4, ioTriggerAfter=2, ioBurstTime=2 -> A's io ends at t=4 (phase1 [0,2), io [2,4))
      // B arrives at t=4 (fresh arrival) at the exact same instant A's io completes
      // Merge order: readyTime tie (both 4) -> ascending id -> A before B
      const processes: ProcessInput[] = [
        { id: 'A', name: 'A', arrivalTime: 0, burstTime: 4, ioBurstTime: 2, ioTriggerAfter: 2 },
        { id: 'B', name: 'B', arrivalTime: 4, burstTime: 3 },
      ];
      const quantum = 5;

      const result = runRoundRobin(processes, quantum);

      // A: phase1 [0,2), io [2,4), phase2 (2 units) ready at t=4 alongside B's arrival at t=4
      // Deterministic merge order: id 'A' < 'B' -> A dispatched before B
      expect(result.timeline).toEqual([
        { processId: 'A', start: 0, end: 2 },
        { processId: 'A', start: 4, end: 6 },
        { processId: 'B', start: 6, end: 9 },
      ]);
    });
  });

  // =========================================================
  // Multi-op I/O: several I/O operations per process
  // =========================================================
  describe('multi-op I/O (several operations per process)', () => {
    it('cycles through multiple CPU-phase/I/O-wait cycles under quantum preemption', () => {
      // A: burstTime=10, ops=[{after:2,dur:3},{after:5,dur:4},{after:8,dur:2}], quantum=1
      // phase1 (2 units) needs 2 quanta: [0,1),[1,2) -> io [2,5)
      // phase2 (3 units) needs 3 quanta: [5,6),[6,7),[7,8) -> io [8,12)
      // phase3 (3 units) needs 3 quanta: [12,13),[13,14),[14,15) -> io [15,17)
      // phase4 (2 units) needs 2 quanta: [17,18),[18,19) -> done at 19
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
      const quantum = 1;

      const result = runRoundRobin(processes, quantum);

      expect(result.ioTimeline).toEqual([
        { processId: 'A', start: 2, end: 5 },
        { processId: 'A', start: 8, end: 12 },
        { processId: 'A', start: 15, end: 17 },
      ]);
      const rA = result.processResults[0];
      expect(rA.finishTime).toBe(19);
      expect(rA.turnaroundTime).toBe(19);
      expect(rA.waitingTime).toBe(19 - 10 - (3 + 4 + 2));
    });

    it('lets a second ready process get CPU time during each of the first process I/O waits', () => {
      const processes: ProcessInput[] = [
        {
          id: 'A',
          name: 'A',
          arrivalTime: 0,
          burstTime: 6,
          ioOperations: [
            { after: 2, duration: 3 },
            { after: 4, duration: 2 },
          ],
        },
        { id: 'B', name: 'B', arrivalTime: 3, burstTime: 2 },
      ];
      const quantum = 5;

      const result = runRoundRobin(processes, quantum);

      // A: phase1 [0,2), io [2,5)
      // B arrives at 3 while A is doing io -> B runs [3,5)
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
      const quantum = 5;

      const result = runRoundRobin(processes, quantum);

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
      const quantum = 10;

      const result = runRoundRobin(processes, quantum);
      const rA = result.processResults[0];

      // phase1 [0,3), io1 [3,5), phase2 [5,8), io2 [8,13), phase3 [13,15)
      expect(rA.finishTime).toBe(15);
      expect(rA.turnaroundTime).toBe(15);
      expect(rA.waitingTime).toBe(rA.turnaroundTime - 8 - 7);
    });
  });
});
