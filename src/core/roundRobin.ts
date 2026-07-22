import type { ProcessInput, SchedulingResult, ExecutionSlice, ProcessResult, QueueSlice } from '../types/scheduling';
import { normalizeIoOperations } from './ioOperations';

interface PendingIo {
  processId: string;
  readyAt: number;
  /** Remaining time to run in the NEXT phase once (re-)enqueued; 0 means the process is done once this I/O completes (no further CPU phase). */
  nextRemaining: number;
}

interface ReadyCandidate {
  id: string;
  readyTime: number;
  /** Remaining time to run in the NEXT phase once (re-)enqueued, or undefined for fresh arrivals (uses existing `remaining`). */
  resetRemaining?: number;
}

/**
 * Round Robin scheduling with a runtime-configured quantum, extended with
 * optional multi-op I/O interruption (any number of I/O operations per
 * process, including zero or one — which degrades exactly to legacy
 * behavior).
 *
 * For processes without I/O, behavior is identical to plain RR: FIFO
 * circular ready queue, preemption/requeue on quantum expiry, idle gaps
 * jump the clock to the next arrival, and simultaneous arrival-vs-requeue
 * ties resolve with new arrivals enqueued before the preempted process
 * (Silberschatz convention).
 *
 * For a process with one or more I/O operations (see `normalizeIoOperations`),
 * once its current CPU phase is exhausted it leaves the ready queue
 * entirely and enters I/O; the CPU is released so other ready processes
 * can run. Once I/O completes, the process becomes ready again (merged
 * with fresh arrivals by `readyTime` ascending, then `id` ascending) to
 * run its next CPU phase.
 */
export function runRoundRobin(
  processes: ProcessInput[],
  quantum: number,
): SchedulingResult {
  if (quantum <= 0) {
    throw new Error('Quantum must be positive');
  }

  if (processes.length === 0) {
    return {
      timeline: [],
      processResults: [],
      averageWaitingTime: 0,
      averageTurnaroundTime: 0,
      ioTimeline: [],
    };
  }

  // Sort by arrivalTime so we can process arrivals sequentially in one pass
  const sorted = [...processes]
    .map(p => ({ id: p.id, arrivalTime: p.arrivalTime, burstTime: p.burstTime }))
    .sort((a, b) => a.arrivalTime - b.arrivalTime);

  let nextArrivalIdx = 0;

  // FIFO ready queue (circular, by process id)
  const queue: string[] = [];

  const processMap = new Map(processes.map(p => [p.id, p]));
  const ops = new Map(processes.map(p => [p.id, normalizeIoOperations(p)]));
  const opIndex = new Map<string, number>();
  const cpuConsumed = new Map<string, number>();
  for (const p of processes) {
    opIndex.set(p.id, 0);
    cpuConsumed.set(p.id, 0);
  }

  function currentPhaseDuration(pid: string): number {
    const p = processMap.get(pid)!;
    const processOps = ops.get(pid)!;
    const idx = opIndex.get(pid)!;
    const consumed = cpuConsumed.get(pid)!;
    return idx < processOps.length ? processOps[idx].after - consumed : p.burstTime - consumed;
  }

  // Per-process state: remaining time in the CURRENT phase
  const remaining = new Map<string, number>();
  for (const p of processes) remaining.set(p.id, currentPhaseDuration(p.id));

  const pendingIo: PendingIo[] = [];

  const completed = new Set<string>();
  const firstStart = new Map<string, number>();
  const finishTime = new Map<string, number>();
  const timeline: ExecutionSlice[] = [];
  const ioTimeline: QueueSlice[] = [];

  let currentTime = 0;

  /**
   * Collects fresh arrivals and I/O-returns that are ready at `currentTime`,
   * merge-sorts them by (readyTime asc, id asc), and pushes them onto the
   * queue in that order. Processes whose I/O return has `nextRemaining===0`
   * (no further CPU phase remains) complete here directly instead of being
   * enqueued.
   */
  function enqueueReady(now: number): void {
    const candidates: ReadyCandidate[] = [];

    while (nextArrivalIdx < sorted.length && sorted[nextArrivalIdx].arrivalTime <= now) {
      const arr = sorted[nextArrivalIdx];
      if (!completed.has(arr.id)) {
        candidates.push({ id: arr.id, readyTime: arr.arrivalTime });
      }
      nextArrivalIdx++;
    }

    const stillPending: PendingIo[] = [];
    for (const io of pendingIo) {
      if (io.readyAt <= now) {
        if (io.nextRemaining > 0) {
          candidates.push({ id: io.processId, readyTime: io.readyAt, resetRemaining: io.nextRemaining });
        } else {
          completed.add(io.processId);
          finishTime.set(io.processId, io.readyAt);
        }
      } else {
        stillPending.push(io);
      }
    }
    pendingIo.length = 0;
    pendingIo.push(...stillPending);

    candidates.sort((a, b) => (a.readyTime !== b.readyTime ? a.readyTime - b.readyTime : (a.id < b.id ? -1 : 1)));

    for (const c of candidates) {
      if (c.resetRemaining !== undefined) {
        remaining.set(c.id, c.resetRemaining);
      }
      queue.push(c.id);
    }
  }

  // Seed the queue with processes that arrive at t=0
  enqueueReady(currentTime);

  while (completed.size < processes.length) {
    // ---- Idle gap: nothing ready, jump to next arrival or next I/O return ----
    if (queue.length === 0) {
      let nextTime = Infinity;
      if (nextArrivalIdx < sorted.length) {
        nextTime = Math.min(nextTime, sorted[nextArrivalIdx].arrivalTime);
      }
      for (const io of pendingIo) {
        nextTime = Math.min(nextTime, io.readyAt);
      }
      if (nextTime === Infinity) break; // safety
      currentTime = nextTime;
      enqueueReady(currentTime);
      continue;
    }

    // ---- Dispatch next ready process ----
    const pid = queue.shift()!;
    const p = processMap.get(pid)!;

    if (!firstStart.has(pid)) {
      firstStart.set(pid, currentTime);
    }

    const rem = remaining.get(pid)!;
    const runTime = Math.min(rem, quantum);

    timeline.push({
      processId: pid,
      start: currentTime,
      end: currentTime + runTime,
    });
    currentTime += runTime;

    remaining.set(pid, rem - runTime);
    cpuConsumed.set(pid, cpuConsumed.get(pid)! + runTime);

    // Silberschatz: new arrivals / I/O-returns enqueued BEFORE the preempted process
    enqueueReady(currentTime);

    if (rem - runTime <= 0) {
      const processOps = ops.get(pid)!;
      const idx = opIndex.get(pid)!;

      if (idx < processOps.length) {
        const op = processOps[idx];
        const ioReadyAt = currentTime + op.duration;
        opIndex.set(pid, idx + 1);
        ioTimeline.push({ processId: pid, start: currentTime, end: ioReadyAt });

        if (cpuConsumed.get(pid) === p.burstTime) {
          pendingIo.push({ processId: pid, readyAt: ioReadyAt, nextRemaining: 0 });
        } else {
          const nextIdx = idx + 1;
          const nextOp = nextIdx < processOps.length ? processOps[nextIdx] : undefined;
          const nextRemaining = nextOp
            ? nextOp.after - cpuConsumed.get(pid)!
            : p.burstTime - cpuConsumed.get(pid)!;
          pendingIo.push({ processId: pid, readyAt: ioReadyAt, nextRemaining });
        }
        // Not enqueued now, and not completed now — even if nextRemaining
        // === 0, completion happens later inside enqueueReady when
        // ioReadyAt is reached.
      } else {
        completed.add(pid);
        finishTime.set(pid, currentTime);
      }
    } else {
      queue.push(pid);
    }
  }

  // ---- Build results preserving input order ----
  const processResults: ProcessResult[] = [];
  for (const p of processes) {
    const start = firstStart.get(p.id)!;
    const finish = finishTime.get(p.id)!;
    const turnaround = finish - p.arrivalTime;
    const sumIo = normalizeIoOperations(p).reduce((s, op) => s + op.duration, 0);
    const waiting = turnaround - p.burstTime - sumIo;

    processResults.push({
      processId: p.id,
      arrivalTime: p.arrivalTime,
      startTime: start,
      finishTime: finish,
      waitingTime: waiting,
      turnaroundTime: turnaround,
    });
  }

  const sumWaiting = processResults.reduce((s, r) => s + r.waitingTime, 0);
  const sumTurnaround = processResults.reduce((s, r) => s + r.turnaroundTime, 0);

  return {
    timeline,
    processResults,
    averageWaitingTime: sumWaiting / processes.length,
    averageTurnaroundTime: sumTurnaround / processes.length,
    ioTimeline,
  };
}
