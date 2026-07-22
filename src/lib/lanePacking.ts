import type { QueueSlice } from '../types/scheduling';

export interface PackedSlice extends QueueSlice {
  track: number; // 0-indexed sub-row within the lane
}

/**
 * Greedy interval-packing ("meeting rooms") algorithm: assigns each slice to
 * the lowest-numbered track whose previously assigned slice has already
 * ended by the time this slice starts.
 */
export function packIntervals(slices: QueueSlice[]): PackedSlice[] {
  const sorted = [...slices].sort((a, b) => a.start - b.start || a.end - b.end);

  const trackEnds: number[] = [];
  const packed: PackedSlice[] = [];

  for (const slice of sorted) {
    let track = trackEnds.findIndex(end => end <= slice.start);
    if (track === -1) {
      track = trackEnds.length;
      trackEnds.push(slice.end);
    } else {
      trackEnds[track] = slice.end;
    }
    packed.push({ ...slice, track });
  }

  return packed;
}
