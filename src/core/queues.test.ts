import { describe, it, expect } from 'vitest';
import { buildQueueTimelines } from './queues';
import type { ProcessInput, ExecutionSlice, QueueSlice } from '../types/scheduling';

describe('buildQueueTimelines', () => {
  it('single process with no I/O produces empty ready and io lanes', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 5 },
    ];
    const cpuTimeline: ExecutionSlice[] = [{ processId: 'A', start: 0, end: 5 }];
    const ioTimeline: QueueSlice[] = [];

    const queues = buildQueueTimelines(processes, cpuTimeline, ioTimeline);

    expect(queues.cpu).toEqual([{ processId: 'A', start: 0, end: 5 }]);
    expect(queues.ready).toEqual([{ processId: 'A', start: 0, end: 0 }]);
    expect(queues.io).toEqual([]);
  });

  it('second process waiting for CPU produces a ready slice matching the gap', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 5 },
      { id: 'B', name: 'B', arrivalTime: 0, burstTime: 3 },
    ];
    const cpuTimeline: ExecutionSlice[] = [
      { processId: 'A', start: 0, end: 5 },
      { processId: 'B', start: 5, end: 8 },
    ];
    const ioTimeline: QueueSlice[] = [];

    const queues = buildQueueTimelines(processes, cpuTimeline, ioTimeline);

    expect(queues.ready).toEqual([
      { processId: 'A', start: 0, end: 0 },
      { processId: 'B', start: 0, end: 5 },
    ]);
  });

  it('process with io interval produces the correct io slice, copied from the engine', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 5, ioBurstTime: 4 },
    ];
    const cpuTimeline: ExecutionSlice[] = [{ processId: 'A', start: 0, end: 5 }];
    const ioTimeline: QueueSlice[] = [{ processId: 'A', start: 5, end: 9 }];

    const queues = buildQueueTimelines(processes, cpuTimeline, ioTimeline);

    expect(queues.io).toEqual([{ processId: 'A', start: 5, end: 9 }]);
  });

  it('process without io produces no io slice', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 5 },
      { id: 'B', name: 'B', arrivalTime: 5, burstTime: 3 },
    ];
    const cpuTimeline: ExecutionSlice[] = [
      { processId: 'A', start: 0, end: 5 },
      { processId: 'B', start: 5, end: 8 },
    ];
    const ioTimeline: QueueSlice[] = [];

    const queues = buildQueueTimelines(processes, cpuTimeline, ioTimeline);

    expect(queues.io).toEqual([]);
  });

  it('RR preempted process produces multiple ready gaps between its own slices', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 6 },
      { id: 'B', name: 'B', arrivalTime: 1, burstTime: 2 },
    ];
    // A: 0-2, B arrives at 1 and runs 2-4, A resumes 4-6, B... etc
    const cpuTimeline: ExecutionSlice[] = [
      { processId: 'A', start: 0, end: 2 },
      { processId: 'B', start: 2, end: 4 },
      { processId: 'A', start: 4, end: 6 },
      { processId: 'A', start: 6, end: 8 },
    ];
    const ioTimeline: QueueSlice[] = [];

    const queues = buildQueueTimelines(processes, cpuTimeline, ioTimeline);

    // A's own slices: [0,2), [4,6), [6,8) -> cursor starts at arrival 0
    // gap between 2 (end of first A slice) and 4 (start of second A slice)
    // B arrives at 1 but its own first slice starts at 2 -> gap [1,2)
    expect(queues.ready).toEqual([
      { processId: 'A', start: 0, end: 0 },
      { processId: 'A', start: 2, end: 4 },
      { processId: 'A', start: 6, end: 6 },
      { processId: 'B', start: 1, end: 2 },
    ]);
  });

  it('mid-burst I/O: the ready gap is only the remainder after the io interval ends', () => {
    // A: phase1 [0,2), io [2,5), phase2 [5,8)
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 5, ioBurstTime: 3, ioTriggerAfter: 2 },
    ];
    const cpuTimeline: ExecutionSlice[] = [
      { processId: 'A', start: 0, end: 2 },
      { processId: 'A', start: 5, end: 8 },
    ];
    const ioTimeline: QueueSlice[] = [{ processId: 'A', start: 2, end: 5 }];

    const queues = buildQueueTimelines(processes, cpuTimeline, ioTimeline);

    // A arrives at 0 and starts immediately -> instant ready slice [0,0)
    // gap [2,5) is fully covered by the io interval -> no other ready slice
    expect(queues.ready).toEqual([{ processId: 'A', start: 0, end: 0 }]);
    expect(queues.io).toEqual([{ processId: 'A', start: 2, end: 5 }]);
  });

  it('mid-burst I/O with another process interleaved: ready gap covers only the post-io remainder', () => {
    // A: phase1 [0,2), io [2,12), phase2 [12,14)
    // B runs [3,6) during A's io wait
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 4, ioBurstTime: 10, ioTriggerAfter: 2 },
      { id: 'B', name: 'B', arrivalTime: 3, burstTime: 3 },
    ];
    const cpuTimeline: ExecutionSlice[] = [
      { processId: 'A', start: 0, end: 2 },
      { processId: 'B', start: 3, end: 6 },
      { processId: 'A', start: 12, end: 14 },
    ];
    const ioTimeline: QueueSlice[] = [{ processId: 'A', start: 2, end: 12 }];

    const queues = buildQueueTimelines(processes, cpuTimeline, ioTimeline);

    // A arrives at 0 and starts immediately -> instant ready slice [0,0)
    // A's gap [2,12) starts exactly at its io interval's start -> no other ready slice for A
    expect(queues.ready.filter(s => s.processId === 'A')).toEqual([{ processId: 'A', start: 0, end: 0 }]);
    expect(queues.io).toEqual([{ processId: 'A', start: 2, end: 12 }]);
  });

  it('multi-op I/O: each gap aligns with at most one of the process own io intervals', () => {
    // A: phase1 [0,2), io1 [2,5), phase2 [5,8), io2 [8,12), phase3 [12,14)
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 5, ioOperations: [{ after: 2, duration: 3 }, { after: 5, duration: 4 }] },
    ];
    const cpuTimeline: ExecutionSlice[] = [
      { processId: 'A', start: 0, end: 2 },
      { processId: 'A', start: 5, end: 8 },
      { processId: 'A', start: 12, end: 14 },
    ];
    const ioTimeline: QueueSlice[] = [
      { processId: 'A', start: 2, end: 5 },
      { processId: 'A', start: 8, end: 12 },
    ];

    const queues = buildQueueTimelines(processes, cpuTimeline, ioTimeline);

    // A arrives at 0 and starts immediately -> instant ready slice [0,0)
    // Both gaps ([2,5) and [8,12)) are fully covered by their respective
    // io intervals -> no other ready slices for A
    expect(queues.ready.filter(s => s.processId === 'A')).toEqual([{ processId: 'A', start: 0, end: 0 }]);
    expect(queues.io).toEqual(ioTimeline);
  });

  it('legacy io-after-full-burst (no subsequent cpu slice) leaves io untouched, no ready gap connection', () => {
    const processes: ProcessInput[] = [
      { id: 'A', name: 'A', arrivalTime: 0, burstTime: 5, ioBurstTime: 4 },
      { id: 'B', name: 'B', arrivalTime: 6, burstTime: 2 },
    ];
    const cpuTimeline: ExecutionSlice[] = [
      { processId: 'A', start: 0, end: 5 },
      { processId: 'B', start: 6, end: 8 },
    ];
    const ioTimeline: QueueSlice[] = [{ processId: 'A', start: 5, end: 9 }];

    const queues = buildQueueTimelines(processes, cpuTimeline, ioTimeline);

    expect(queues.io).toEqual([{ processId: 'A', start: 5, end: 9 }]);
    // A arrives at 0 and starts immediately -> instant ready slice [0,0)
    // A has no gap after its only (last) slice, so no other ready entries for A
    expect(queues.ready.filter(s => s.processId === 'A')).toEqual([{ processId: 'A', start: 0, end: 0 }]);
  });
});
