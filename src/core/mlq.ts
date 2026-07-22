import type {
  ProcessInput,
  SchedulingResult,
  ExecutionSlice,
  ProcessResult,
  QueueSlice,
  QueueAssignment,
} from '../types/scheduling';
import { normalizeIoOperations } from './ioOperations';

interface SjfProcState {
  opIndex: number;
  cpuConsumed: number;
  stage: 'running' | 'done';
  /** Gate for readiness while `stage === 'running'` — mirrors sjf.ts's ProcState. */
  nextReadyTime: number;
}

interface PendingIo {
  processId: string;
  readyAt: number;
  /** Remaining time to run in the NEXT phase once (re-)enqueued; 0 means the process is done once this I/O completes. */
  nextRemaining: number;
}

interface ReadyCandidate {
  id: string;
  readyTime: number;
  resetRemaining?: number;
}

/**
 * Multilevel Queue Scheduling (Silberschatz model): processes are split into
 * two independently-scheduled queues — one following non-preemptive SJF's
 * rules, the other Round Robin's rules — which compete for the CPU under a
 * FIXED PRIORITY policy. Whichever queue has fixed priority always wins the
 * CPU when it has a ready process; the other queue only runs when the
 * priority queue has no ready candidate (empty, or its next process is
 * mid-I/O). Both queues reuse the exact per-process phase/I/O state
 * machines of `sjf.ts`/`roundRobin.ts`, but the master loop below dispatches
 * only ONE unit of work at a time from whichever queue is currently active,
 * then re-evaluates — so preemption between queues only ever happens at
 * dispatch boundaries, never mid-slice.
 */
export function runMLQ(
  processes: ProcessInput[],
  quantum: number,
  priorityQueue: QueueAssignment,
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

  const sjfProcesses = processes.filter(p => (p.queue ?? 'SJF') === 'SJF');
  const rrProcesses = processes.filter(p => (p.queue ?? 'SJF') === 'RR');

  const timeline: ExecutionSlice[] = [];
  const ioTimeline: QueueSlice[] = [];
  const firstStart = new Map<string, number>();
  const finishTime = new Map<string, number>();

  // ===================================================================
  // SJF-queue state (mirrors sjf.ts's inner loop body exactly)
  // ===================================================================
  const sjfN = sjfProcesses.length;
  const sjfOps = sjfProcesses.map(normalizeIoOperations);
  const sjfStates: SjfProcState[] = sjfProcesses.map(p => ({
    opIndex: 0,
    cpuConsumed: 0,
    stage: 'running',
    nextReadyTime: p.arrivalTime,
  }));
  let sjfCompletedCount = 0;

  const sjfDurationOf = (i: number): number => {
    const st = sjfStates[i];
    const ops = sjfOps[i];
    return st.opIndex < ops.length
      ? ops[st.opIndex].after - st.cpuConsumed
      : sjfProcesses[i].burstTime - st.cpuConsumed;
  };
  const sjfReadyTimeOf = (i: number): number => sjfStates[i].nextReadyTime;

  function sjfReadyCandidates(currentTime: number): number[] {
    const ready: number[] = [];
    for (let i = 0; i < sjfN; i++) {
      const st = sjfStates[i];
      if (st.stage === 'running' && st.nextReadyTime <= currentTime) ready.push(i);
    }
    return ready;
  }

  function selectShortestSjf(ready: number[]): number {
    let sel = ready[0];
    for (let k = 1; k < ready.length; k++) {
      const idx = ready[k];
      const durCmp = sjfDurationOf(idx) - sjfDurationOf(sel);
      if (durCmp < 0) {
        sel = idx;
      } else if (durCmp === 0) {
        const readyCmp = sjfReadyTimeOf(idx) - sjfReadyTimeOf(sel);
        if (readyCmp < 0) {
          sel = idx;
        } else if (readyCmp === 0 && sjfProcesses[idx].id < sjfProcesses[sel].id) {
          sel = idx;
        }
      }
    }
    return sel;
  }

  /** Runs the selected SJF-queue candidate's current phase to completion, pushes its slice/io, and returns the new currentTime. */
  function dispatchSjfOnce(currentTime: number): number {
    const ready = sjfReadyCandidates(currentTime);
    const sel = selectShortestSjf(ready);
    const p = sjfProcesses[sel];
    const st = sjfStates[sel];
    const ops = sjfOps[sel];
    const dur = sjfDurationOf(sel);
    const startTime = currentTime;
    const end = startTime + dur;

    timeline.push({ processId: p.id, start: startTime, end });
    if (!firstStart.has(p.id)) firstStart.set(p.id, startTime);

    st.cpuConsumed += dur;

    if (st.opIndex < ops.length) {
      const op = ops[st.opIndex];
      const ioStart = end;
      const ioEnd = end + op.duration;
      ioTimeline.push({ processId: p.id, start: ioStart, end: ioEnd });
      st.opIndex += 1;

      if (st.cpuConsumed === p.burstTime) {
        st.stage = 'done';
        finishTime.set(p.id, ioEnd);
        sjfCompletedCount++;
      } else {
        st.nextReadyTime = ioEnd;
      }
    } else {
      st.stage = 'done';
      finishTime.set(p.id, end);
      sjfCompletedCount++;
    }

    return end;
  }

  // ===================================================================
  // RR-queue state (mirrors roundRobin.ts's inner loop body exactly)
  // ===================================================================
  const rrSorted = [...rrProcesses]
    .map(p => ({ id: p.id, arrivalTime: p.arrivalTime, burstTime: p.burstTime }))
    .sort((a, b) => a.arrivalTime - b.arrivalTime);
  let rrNextArrivalIdx = 0;
  const rrQueue: string[] = [];
  const rrProcessMap = new Map(rrProcesses.map(p => [p.id, p]));
  const rrOps = new Map(rrProcesses.map(p => [p.id, normalizeIoOperations(p)]));
  const rrOpIndex = new Map<string, number>();
  const rrCpuConsumed = new Map<string, number>();
  for (const p of rrProcesses) {
    rrOpIndex.set(p.id, 0);
    rrCpuConsumed.set(p.id, 0);
  }

  function rrCurrentPhaseDuration(pid: string): number {
    const p = rrProcessMap.get(pid)!;
    const ops = rrOps.get(pid)!;
    const idx = rrOpIndex.get(pid)!;
    const consumed = rrCpuConsumed.get(pid)!;
    return idx < ops.length ? ops[idx].after - consumed : p.burstTime - consumed;
  }

  const rrRemaining = new Map<string, number>();
  for (const p of rrProcesses) rrRemaining.set(p.id, rrCurrentPhaseDuration(p.id));

  const rrPendingIo: PendingIo[] = [];
  const rrCompleted = new Set<string>();
  let rrCompletedCount = 0;

  /** Merges due fresh arrivals and I/O-returns into the RR fifo by (readyTime, id) — same Silberschatz ordering as roundRobin.ts. */
  function rrEnqueueReady(now: number): void {
    const candidates: ReadyCandidate[] = [];

    while (rrNextArrivalIdx < rrSorted.length && rrSorted[rrNextArrivalIdx].arrivalTime <= now) {
      const arr = rrSorted[rrNextArrivalIdx];
      if (!rrCompleted.has(arr.id)) {
        candidates.push({ id: arr.id, readyTime: arr.arrivalTime });
      }
      rrNextArrivalIdx++;
    }

    const stillPending: PendingIo[] = [];
    for (const io of rrPendingIo) {
      if (io.readyAt <= now) {
        if (io.nextRemaining > 0) {
          candidates.push({ id: io.processId, readyTime: io.readyAt, resetRemaining: io.nextRemaining });
        } else {
          rrCompleted.add(io.processId);
          finishTime.set(io.processId, io.readyAt);
          rrCompletedCount++;
        }
      } else {
        stillPending.push(io);
      }
    }
    rrPendingIo.length = 0;
    rrPendingIo.push(...stillPending);

    candidates.sort((a, b) => (a.readyTime !== b.readyTime ? a.readyTime - b.readyTime : (a.id < b.id ? -1 : 1)));

    for (const c of candidates) {
      if (c.resetRemaining !== undefined) {
        rrRemaining.set(c.id, c.resetRemaining);
      }
      rrQueue.push(c.id);
    }
  }

  /** Runs the RR-queue's front process for min(remaining, quantum), pushes its slice, and returns the new currentTime. Only callable when rrQueue is non-empty. */
  function dispatchRrOnce(currentTime: number): number {
    const pid = rrQueue.shift()!;
    const p = rrProcessMap.get(pid)!;

    if (!firstStart.has(pid)) firstStart.set(pid, currentTime);

    const rem = rrRemaining.get(pid)!;
    const runTime = Math.min(rem, quantum);

    timeline.push({ processId: pid, start: currentTime, end: currentTime + runTime });
    const newTime = currentTime + runTime;

    rrRemaining.set(pid, rem - runTime);
    rrCpuConsumed.set(pid, rrCpuConsumed.get(pid)! + runTime);

    // Silberschatz: new arrivals / I/O-returns enqueued BEFORE the preempted process
    rrEnqueueReady(newTime);

    if (rem - runTime <= 0) {
      const ops = rrOps.get(pid)!;
      const idx = rrOpIndex.get(pid)!;

      if (idx < ops.length) {
        const op = ops[idx];
        const ioReadyAt = newTime + op.duration;
        rrOpIndex.set(pid, idx + 1);
        ioTimeline.push({ processId: pid, start: newTime, end: ioReadyAt });

        if (rrCpuConsumed.get(pid) === p.burstTime) {
          rrPendingIo.push({ processId: pid, readyAt: ioReadyAt, nextRemaining: 0 });
        } else {
          const nextIdx = idx + 1;
          const nextOp = nextIdx < ops.length ? ops[nextIdx] : undefined;
          const nextRemaining = nextOp
            ? nextOp.after - rrCpuConsumed.get(pid)!
            : p.burstTime - rrCpuConsumed.get(pid)!;
          rrPendingIo.push({ processId: pid, readyAt: ioReadyAt, nextRemaining });
        }
      } else {
        rrCompleted.add(pid);
        finishTime.set(pid, newTime);
        rrCompletedCount++;
      }
    } else {
      rrQueue.push(pid);
    }

    return newTime;
  }

  // Seed the RR fifo with processes that arrive at t=0
  rrEnqueueReady(0);

  // ===================================================================
  // Master loop: dispatch ONE unit of work at a time from whichever queue
  // is active under the fixed-priority policy, then re-evaluate.
  // ===================================================================
  let currentTime = 0;
  const totalProcesses = processes.length;
  let completedCount = 0;

  while (completedCount < totalProcesses) {
    // Pull in any due RR arrivals/io-returns into the RR fifo first.
    rrEnqueueReady(currentTime);
    completedCount = sjfCompletedCount + rrCompletedCount;
    if (completedCount >= totalProcesses) break;

    const sjfReady = sjfReadyCandidates(currentTime).length > 0;
    const rrReady = rrQueue.length > 0;

    const activeQueue: 'SJF' | 'RR' | null =
      priorityQueue === 'SJF'
        ? sjfReady
          ? 'SJF'
          : rrReady
            ? 'RR'
            : null
        : rrReady
          ? 'RR'
          : sjfReady
            ? 'SJF'
            : null;

    if (activeQueue === null) {
      // Nobody ready anywhere — jump the clock to the earliest next event
      // across BOTH queues: next SJF-queue arrival/io-return, next RR-queue
      // arrival/io-return.
      let nextTime = Infinity;
      for (let i = 0; i < sjfN; i++) {
        const st = sjfStates[i];
        if (st.stage === 'running' && st.nextReadyTime < nextTime) {
          nextTime = st.nextReadyTime;
        }
      }
      if (rrNextArrivalIdx < rrSorted.length) {
        nextTime = Math.min(nextTime, rrSorted[rrNextArrivalIdx].arrivalTime);
      }
      for (const io of rrPendingIo) {
        nextTime = Math.min(nextTime, io.readyAt);
      }
      if (nextTime === Infinity) break; // safety net — should not happen
      currentTime = nextTime;
      continue;
    }

    currentTime = activeQueue === 'SJF' ? dispatchSjfOnce(currentTime) : dispatchRrOnce(currentTime);
    completedCount = sjfCompletedCount + rrCompletedCount;
  }

  // ===================================================================
  // Build processResults for ALL processes, preserving ORIGINAL input order
  // ===================================================================
  const processResults: ProcessResult[] = [];
  for (const p of processes) {
    const startTime = firstStart.get(p.id)!;
    const finish = finishTime.get(p.id)!;
    const turnaroundTime = finish - p.arrivalTime;
    const sumIo = normalizeIoOperations(p).reduce((s, op) => s + op.duration, 0);
    const waitingTime = turnaroundTime - p.burstTime - sumIo;

    processResults.push({
      processId: p.id,
      arrivalTime: p.arrivalTime,
      startTime,
      finishTime: finish,
      waitingTime,
      turnaroundTime,
    });
  }

  const sumWaiting = processResults.reduce((s, r) => s + r.waitingTime, 0);
  const sumTurnaround = processResults.reduce((s, r) => s + r.turnaroundTime, 0);

  return {
    timeline,
    processResults,
    averageWaitingTime: sumWaiting / totalProcesses,
    averageTurnaroundTime: sumTurnaround / totalProcesses,
    ioTimeline,
  };
}
