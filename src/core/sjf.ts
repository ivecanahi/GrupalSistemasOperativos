import type { ProcessInput, SchedulingResult, ExecutionSlice, ProcessResult, QueueSlice } from '../types/scheduling';
import { normalizeIoOperations } from './ioOperations';

interface ProcState {
  index: number;
  opIndex: number;
  cpuConsumed: number;
  stage: 'running' | 'done';
  /**
   * Gate for readiness while `stage === 'running'`: `arrivalTime` before the
   * process has ever run, or the completion time of its most recent I/O
   * wait once it has returned from one.
   */
  nextReadyTime: number;
}

/**
 * Pick the shortest current-phase duration among ready candidates.
 * Ties broken by earliest readyTime (arrivalTime for never-yet-run
 * processes, I/O-completion time for I/O returnees), then ascending id.
 */
function selectShortest(
  ready: number[],
  processes: ProcessInput[],
  durationOf: (i: number) => number,
  readyTimeOf: (i: number) => number,
): number {
  let sel = ready[0];
  for (let i = 1; i < ready.length; i++) {
    const idx = ready[i];
    const durCmp = durationOf(idx) - durationOf(sel);
    if (durCmp < 0) {
      sel = idx;
    } else if (durCmp === 0) {
      const readyCmp = readyTimeOf(idx) - readyTimeOf(sel);
      if (readyCmp < 0) {
        sel = idx;
      } else if (readyCmp === 0 && processes[idx].id < processes[sel].id) {
        sel = idx;
      }
    }
  }
  return sel;
}

/**
 * Non-preemptive Shortest Job First scheduling, with optional multi-op I/O
 * interruption (any number of I/O operations per process, including zero
 * or one — which degrades exactly to legacy behavior).
 *
 * For processes without I/O, behavior is identical to plain SJF: shortest
 * burst first among arrived, ties broken by earliest arrivalTime then
 * ascending id, idle gaps jump the clock to the next arrival.
 *
 * For a process with one or more I/O operations (see `normalizeIoOperations`),
 * its burst is split into CPU phases separated by I/O waits; the CPU is
 * released during each I/O wait so other ready processes can run. Once an
 * I/O operation completes, the process becomes ready again to run its next
 * CPU phase.
 */
export function runSJF(processes: ProcessInput[]): SchedulingResult {
  if (processes.length === 0) {
    return {
      timeline: [],
      processResults: [],
      averageWaitingTime: 0,
      averageTurnaroundTime: 0,
      ioTimeline: [],
    };
  }

  const n = processes.length;
  const allOps = processes.map(normalizeIoOperations);

  const states: ProcState[] = processes.map((p, i) => ({
    index: i,
    opIndex: 0,
    cpuConsumed: 0,
    stage: 'running',
    nextReadyTime: p.arrivalTime,
  }));

  let completedCount = 0;
  let currentTime = 0;

  const timeline: ExecutionSlice[] = [];
  const ioTimeline: QueueSlice[] = [];
  const firstStart = new Map<string, number>();
  const finishTime = new Map<string, number>();

  const durationOf = (i: number): number => {
    const st = states[i];
    const ops = allOps[i];
    return st.opIndex < ops.length
      ? ops[st.opIndex].after - st.cpuConsumed
      : processes[i].burstTime - st.cpuConsumed;
  };
  const readyTimeOf = (i: number): number => states[i].nextReadyTime;

  while (completedCount < n) {
    const ready: number[] = [];
    for (let i = 0; i < n; i++) {
      const st = states[i];
      if (st.stage === 'running' && st.nextReadyTime <= currentTime) {
        ready.push(i);
      }
    }

    if (ready.length === 0) {
      let nextTime = Infinity;
      for (let i = 0; i < n; i++) {
        const st = states[i];
        if (st.stage === 'running' && st.nextReadyTime < nextTime) {
          nextTime = st.nextReadyTime;
        }
      }
      currentTime = nextTime;
      continue;
    }

    const sel = selectShortest(ready, processes, durationOf, readyTimeOf);
    const p = processes[sel];
    const st = states[sel];
    const ops = allOps[sel];
    const dur = durationOf(sel);
    const startTime = currentTime;
    const end = startTime + dur;

    timeline.push({ processId: p.id, start: startTime, end });
    if (!firstStart.has(p.id)) firstStart.set(p.id, startTime);

    st.cpuConsumed += dur;

    if (st.opIndex < ops.length) {
      // This phase ended by hitting an I/O trigger.
      const op = ops[st.opIndex];
      const ioStart = end;
      const ioEnd = end + op.duration;
      ioTimeline.push({ processId: p.id, start: ioStart, end: ioEnd });
      st.opIndex += 1;

      if (st.cpuConsumed === p.burstTime) {
        st.stage = 'done';
        finishTime.set(p.id, ioEnd);
        completedCount++;
      } else {
        st.nextReadyTime = ioEnd;
      }
    } else {
      st.stage = 'done';
      finishTime.set(p.id, end);
      completedCount++;
    }

    currentTime = end;
  }

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
    averageWaitingTime: sumWaiting / n,
    averageTurnaroundTime: sumTurnaround / n,
    ioTimeline,
  };
}
