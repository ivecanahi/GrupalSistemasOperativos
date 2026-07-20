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
});
