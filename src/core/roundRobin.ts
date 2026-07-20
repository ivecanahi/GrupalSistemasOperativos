import type { ProcessInput, SchedulingResult, ExecutionSlice, ProcessResult } from '../types/scheduling';

/**
 * Enqueue all processes whose arrivalTime has been reached or passed.
 * Returns the new index in the sorted array after processing.
 */
function enqueueArrived(
  sorted: { id: string; arrivalTime: number }[],
  startIdx: number,
  currentTime: number,
  completed: Set<string>,
  queue: string[],
): number {
  let idx = startIdx;
  while (idx < sorted.length && sorted[idx].arrivalTime <= currentTime) {
    if (!completed.has(sorted[idx].id)) {
      queue.push(sorted[idx].id);
    }
    idx++;
  }
  return idx;
}

/**
 * Round Robin scheduling with a runtime-configured quantum.
 *
 * Uses a FIFO circular ready queue. Each process runs for at most `quantum`
 * time units per turn. If remaining burst exceeds `quantum` the process is
 * preempted and requeued with reduced remaining burst.
 *
 * When the ready queue is empty and processes have not yet arrived, the clock
 * jumps to the next arrival — no execution slice is produced for idle gaps.
 *
 * When a quantum expires at the exact instant a new process arrives, the new
 * arrival is enqueued BEFORE the preempted process (Silberschatz convention).
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
    };
  }

  // Sort by arrivalTime so we can process arrivals sequentially in one pass
  const sorted = [...processes]
    .map(p => ({ id: p.id, arrivalTime: p.arrivalTime, burstTime: p.burstTime }))
    .sort((a, b) => a.arrivalTime - b.arrivalTime);

  let nextArrivalIdx = 0;

  // FIFO ready queue (circular, by process id)
  const queue: string[] = [];

  // Per-process state
  const remaining = new Map<string, number>();
  for (const p of processes) remaining.set(p.id, p.burstTime);

  const completed = new Set<string>();
  const firstStart = new Map<string, number>();
  const finishTime = new Map<string, number>();
  const timeline: ExecutionSlice[] = [];

  let currentTime = 0;

  // Seed the queue with processes that arrive at t=0
  nextArrivalIdx = enqueueArrived(sorted, nextArrivalIdx, currentTime, completed, queue);

  while (completed.size < processes.length) {
    // ---- Idle gap: nothing ready, jump to next arrival ----
    if (queue.length === 0) {
      if (nextArrivalIdx >= sorted.length) break; // safety
      currentTime = sorted[nextArrivalIdx].arrivalTime;
      nextArrivalIdx = enqueueArrived(sorted, nextArrivalIdx, currentTime, completed, queue);
      continue;
    }

    // ---- Dispatch next ready process ----
    const pid = queue.shift()!;

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

    // Silberschatz: new arrivals enqueued BEFORE the preempted process
    nextArrivalIdx = enqueueArrived(sorted, nextArrivalIdx, currentTime, completed, queue);

    if (rem - runTime <= 0) {
      completed.add(pid);
      finishTime.set(pid, currentTime);
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
    const waiting = turnaround - p.burstTime;

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
  };
}
