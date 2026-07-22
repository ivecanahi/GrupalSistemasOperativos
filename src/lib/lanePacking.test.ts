import { describe, it, expect } from 'vitest';
import { packIntervals } from './lanePacking';
import type { QueueSlice } from '../types/scheduling';

describe('packIntervals', () => {
  it('assigns track 0 to all slices when there are no overlaps', () => {
    const slices: QueueSlice[] = [
      { processId: 'A', start: 0, end: 2 },
      { processId: 'B', start: 2, end: 4 },
      { processId: 'C', start: 4, end: 6 },
    ];

    const packed = packIntervals(slices);

    expect(packed.every(s => s.track === 0)).toBe(true);
  });

  it('assigns two overlapping slices to tracks 0 and 1', () => {
    const slices: QueueSlice[] = [
      { processId: 'A', start: 0, end: 5 },
      { processId: 'B', start: 2, end: 4 },
    ];

    const packed = packIntervals(slices);

    const trackA = packed.find(s => s.processId === 'A')!.track;
    const trackB = packed.find(s => s.processId === 'B')!.track;
    expect(new Set([trackA, trackB])).toEqual(new Set([0, 1]));
  });

  it('assigns three-way overlap to three distinct tracks', () => {
    const slices: QueueSlice[] = [
      { processId: 'A', start: 0, end: 5 },
      { processId: 'B', start: 1, end: 5 },
      { processId: 'C', start: 2, end: 5 },
    ];

    const packed = packIntervals(slices);

    const tracks = new Set(packed.map(s => s.track));
    expect(tracks.size).toBe(3);
  });

  it('reuses an earlier-freed track for a later non-overlapping slice', () => {
    const slices: QueueSlice[] = [
      { processId: 'A', start: 0, end: 2 },
      { processId: 'B', start: 0, end: 5 },
      { processId: 'C', start: 2, end: 4 },
    ];

    const packed = packIntervals(slices);

    const trackA = packed.find(s => s.processId === 'A')!.track;
    const trackB = packed.find(s => s.processId === 'B')!.track;
    const trackC = packed.find(s => s.processId === 'C')!.track;

    // A and B overlap so must differ; C starts exactly when A ends (2) so it
    // can reuse A's track.
    expect(trackA).not.toBe(trackB);
    expect(trackC).toBe(trackA);
  });
});
