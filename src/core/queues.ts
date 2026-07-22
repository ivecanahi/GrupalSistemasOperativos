import type { ProcessInput, ExecutionSlice, QueueSlice, QueueTimelines } from '../types/scheduling';

/**
 * Derive the CPU / ready / I/O queue timelines from the engine's own
 * `cpuTimeline` and `ioTimeline`.
 *
 * - `cpu`: the CPU timeline slices, copied as QueueSlice.
 * - `io`: the engine's ioTimeline, copied as-is (already correct).
 * - `ready`: for each process, the gaps between its arrival/previous own
 *   CPU slice end and the start of its next own CPU slice (time spent
 *   waiting for the CPU). When a gap's start coincides with the start of
 *   one of the process's own io intervals (I/O always begins exactly when
 *   the preceding CPU phase ends), the visible ready portion of that gap
 *   is only the remainder after the io interval ends.
 */
export function buildQueueTimelines(
  processes: ProcessInput[],
  cpuTimeline: ExecutionSlice[],
  ioTimeline: QueueSlice[],
): QueueTimelines {
  const cpu: QueueSlice[] = cpuTimeline.map(s => ({
    processId: s.processId,
    start: s.start,
    end: s.end,
  }));

  const io: QueueSlice[] = ioTimeline.map(s => ({ ...s }));

  const ready: QueueSlice[] = [];
  for (const p of processes) {
    const ownSlices = cpuTimeline
      .filter(s => s.processId === p.id)
      .sort((a, b) => a.start - b.start);

    if (ownSlices.length === 0) continue;

    const ownIo = io.filter(s => s.processId === p.id);

    let cursor = p.arrivalTime;
    for (const slice of ownSlices) {
      if (slice.start >= cursor) {
        const ioAtCursor = ownIo.find(s => s.start === cursor);
        if (ioAtCursor) {
          if (ioAtCursor.end < slice.start) {
            ready.push({ processId: p.id, start: ioAtCursor.end, end: slice.start });
          }
        } else {
          ready.push({ processId: p.id, start: cursor, end: slice.start });
        }
      }
      cursor = slice.end;
    }
  }

  return { cpu, ready, io };
}
