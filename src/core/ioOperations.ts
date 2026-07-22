import type { IoOperation, ProcessInput } from '../types/scheduling';

/**
 * Normalizes a process's I/O configuration into an ordered list of
 * `IoOperation`s, regardless of whether it was expressed via the new
 * `ioOperations` field or the legacy `ioBurstTime`/`ioTriggerAfter` pair.
 *
 * - When `ioOperations` is a non-empty array, it takes precedence and is
 *   returned sorted by `after` ascending (defensive — callers may provide
 *   them out of order).
 * - Otherwise, when the legacy `ioBurstTime` is set, it is normalized into
 *   a single-element list, defaulting `after` to `burstTime` when
 *   `ioTriggerAfter` is omitted (I/O strictly after the full burst).
 * - Otherwise, an empty list (no I/O) is returned.
 */
export function normalizeIoOperations(p: ProcessInput): IoOperation[] {
  if (p.ioOperations && p.ioOperations.length > 0) {
    return [...p.ioOperations].sort((a, b) => a.after - b.after);
  }
  if (p.ioBurstTime && p.ioBurstTime > 0) {
    return [{ after: p.ioTriggerAfter ?? p.burstTime, duration: p.ioBurstTime }];
  }
  return [];
}
