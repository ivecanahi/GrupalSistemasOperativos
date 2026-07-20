import type { ProcessInput, SchedulingResult, ExecutionSlice, ProcessResult } from '../types/scheduling';

/**
 * Pick the index of the shortest-burst process among ready candidates.
 * Ties broken by earliest arrivalTime, then ascending id.
 */
function selectShortestBurst(
  ready: number[],
  processes: ProcessInput[],
): number {
  let sel = ready[0];
  for (let i = 1; i < ready.length; i++) {
    const idx = ready[i];
    const curr = processes[sel];
    const cand = processes[idx];

    const burstCmp = cand.burstTime - curr.burstTime;
    if (burstCmp < 0) {
      sel = idx;
    } else if (burstCmp === 0) {
      const arrivalCmp = cand.arrivalTime - curr.arrivalTime;
      if (arrivalCmp < 0) {
        sel = idx;
      } else if (arrivalCmp === 0 && cand.id < curr.id) {
        sel = idx;
      }
    }
  }
  return sel;
}

/**
 * Find the earliest arrivalTime among incomplete processes.
 * Returns Infinity when none remain (should not happen in practice).
 */
function nextArrivalTime(
  processes: ProcessInput[],
  done: boolean[],
): number {
  let next = Infinity;
  for (let i = 0; i < processes.length; i++) {
    if (!done[i] && processes[i].arrivalTime < next) {
      next = processes[i].arrivalTime;
    }
  }
  return next;
}

/**
 * Non-preemptive Shortest Job First scheduling.
 *
 * At each decision point, among processes that have arrived and not yet run,
 * selects the one with the shortest burstTime. Ties broken by earliest
 * arrivalTime, then ascending id.
 *
 * Idle gaps (no process arrived at currentTime) produce no execution slices —
 * the clock jumps to the next arrival.
 */
export function runSJF(processes: ProcessInput[]): SchedulingResult {
  if (processes.length === 0) {
    return {
      timeline: [],
      processResults: [],
      averageWaitingTime: 0,
      averageTurnaroundTime: 0,
    };
  }

  const n = processes.length;
  const done = new Array<boolean>(n).fill(false);
  let completedCount = 0;
  let currentTime = 0;

  const timeline: ExecutionSlice[] = [];
  const resultMap = new Map<string, ProcessResult>();

  while (completedCount < n) {
    // Gather ready processes (arrived + not done)
    const ready: number[] = [];
    for (let i = 0; i < n; i++) {
      if (!done[i] && processes[i].arrivalTime <= currentTime) {
        ready.push(i);
      }
    }

    if (ready.length === 0) {
      // Idle gap — jump clock to next arrival
      currentTime = nextArrivalTime(processes, done);
      continue;
    }

    const sel = selectShortestBurst(ready, processes);
    const p = processes[sel];
    const startTime = currentTime;
    const finishTime = startTime + p.burstTime;

    timeline.push({
      processId: p.id,
      start: startTime,
      end: finishTime,
    });

    resultMap.set(p.id, {
      processId: p.id,
      arrivalTime: p.arrivalTime,
      startTime,
      finishTime,
      waitingTime: startTime - p.arrivalTime,
      turnaroundTime: finishTime - p.arrivalTime,
    });

    done[sel] = true;
    completedCount++;
    currentTime = finishTime;
  }

  // Build results preserving input order
  const processResults: ProcessResult[] = [];
  for (const p of processes) {
    const r = resultMap.get(p.id);
    if (r) processResults.push(r);
  }

  const sumWaiting = processResults.reduce((s, r) => s + r.waitingTime, 0);
  const sumTurnaround = processResults.reduce((s, r) => s + r.turnaroundTime, 0);

  return {
    timeline,
    processResults,
    averageWaitingTime: sumWaiting / n,
    averageTurnaroundTime: sumTurnaround / n,
  };
}
