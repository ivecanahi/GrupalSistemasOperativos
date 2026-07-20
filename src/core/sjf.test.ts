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
});
