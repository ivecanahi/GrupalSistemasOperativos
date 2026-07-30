// ============================================================
// ALGORITMO MLQ (Multilevel Queue) — SJF + RR con prioridad fija
// ============================================================
// MLQ combina dos colas: una SJF (no apropiativo) y una RR con
// quantum fijo. Una cola tiene prioridad fija sobre la otra:
// - Si la cola prioritaria tiene procesos listos, siempre gana la CPU.
// - La otra cola solo corre cuando la prioritaria no tiene nada listo.
// El bucle maestro despacha UNA unidad de trabajo a la vez y
// reevalúa, evitando desalojo a mitad de un slice.

import type {
  ProcessInput, SchedulingResult, ExecutionSlice,
  ProcessResult, QueueSlice, QueueAssignment,
} from '../types/scheduling';
import { normalizeIoOperations } from './ioOperations';

// Estado interno para la cola SJF
interface SjfProcState {
  opIndex: number;          // Índice de la operación E/S actual
  cpuConsumed: number;      // CPU consumido hasta ahora
  stage: 'running' | 'done';

  /** Gate for readiness while `stage === 'running'` — mirrors sjf.ts's ProcState. */
  nextReadyTime: number;
  /** Monotonic order for FIFO tie-breaking (arrival / I/O return order). Mirrors sjf.ts. */
  fifoOrder: number;
}

// Proceso haciendo E/S en la cola RR
interface PendingIo {
  processId: string;
  readyAt: number;
  nextRemaining: number;    // CPU restante para la siguiente fase
  order: number;            // Orden FIFO para desempate
}

// Candidato a entrar a la cola RR
interface ReadyCandidate {
  id: string;
  readyTime: number;
  resetRemaining?: number;
  order: number;
}

// Motor principal MLQ
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
      timeline: [], processResults: [],
      averageWaitingTime: 0, averageTurnaroundTime: 0,
      ioTimeline: [],
    };
  }

  // Separa procesos en dos colas según su asignación (default SJF)
  const sjfProcesses = processes.filter(p => (p.queue ?? 'SJF') === 'SJF');
  const rrProcesses = processes.filter(p => (p.queue ?? 'SJF') === 'RR');

  const timeline: ExecutionSlice[] = [];
  const ioTimeline: QueueSlice[] = [];
  const firstStart = new Map<string, number>();
  const finishTime = new Map<string, number>();

  // ──────────── ESTADO DE LA COLA SJF ────────────
  const sjfN = sjfProcesses.length;
  const sjfOps = sjfProcesses.map(normalizeIoOperations);
  let nextSjfFifoOrder = 0;
  const sjfStates: SjfProcState[] = sjfProcesses.map(p => ({
    opIndex: 0,
    cpuConsumed: 0,
    stage: 'running',
    nextReadyTime: p.arrivalTime,
    fifoOrder: nextSjfFifoOrder++,
  }));
  let sjfCompletedCount = 0;

  const sjfDurationOf = (i: number): number => {
    const st = sjfStates[i], ops = sjfOps[i];
    return st.opIndex < ops.length ? ops[st.opIndex].after - st.cpuConsumed : sjfProcesses[i].burstTime - st.cpuConsumed;
  };
  const sjfRemainingWorkOf = (i: number): number => sjfProcesses[i].burstTime - sjfStates[i].cpuConsumed;
  const sjfReadyTimeOf = (i: number): number => sjfStates[i].nextReadyTime;
  const sjfFifoOrderOf = (i: number): number => sjfStates[i].fifoOrder;
  const sjfHasRunBefore = (i: number): boolean => sjfStates[i].cpuConsumed > 0;

  function sjfReadyCandidates(currentTime: number): number[] {
    const ready: number[] = [];
    for (let i = 0; i < sjfN; i++) {
      if (sjfStates[i].stage === 'running' && sjfStates[i].nextReadyTime <= currentTime) ready.push(i);
    }
    return ready;
  }

  function selectShortestSjf(ready: number[]): number {
    let sel = ready[0];
    for (let k = 1; k < ready.length; k++) {
      const idx = ready[k];
      const durCmp = sjfRemainingWorkOf(idx) - sjfRemainingWorkOf(sel);
      if (durCmp < 0) sel = idx;
      else if (durCmp === 0) {
        const readyCmp = sjfReadyTimeOf(idx) - sjfReadyTimeOf(sel);
        if (readyCmp < 0) {
          sel = idx;
        } else if (readyCmp === 0) {
          const selFresh = !sjfHasRunBefore(sel);
          const idxFresh = !sjfHasRunBefore(idx);
          if (selFresh && idxFresh) {
            // Both fresh arrivals: tie-break by id (spec requirement)
            if (sjfProcesses[idx].id < sjfProcesses[sel].id) sel = idx;
          } else {
            // At least one I/O returnee: FIFO order wins
            const fifoCmp = sjfFifoOrderOf(idx) - sjfFifoOrderOf(sel);
            if (fifoCmp < 0) {
              sel = idx;
            } else if (fifoCmp === 0 && sjfProcesses[idx].id < sjfProcesses[sel].id) {
              sel = idx;
            }
          }
        }
      }
    }
    return sel;
  }

  // Despacha un proceso de la cola SJF hasta completar su fase actual
  function dispatchSjfOnce(currentTime: number): number {
    const ready = sjfReadyCandidates(currentTime);
    const sel = selectShortestSjf(ready);
    const p = sjfProcesses[sel], st = sjfStates[sel], ops = sjfOps[sel];
    const dur = sjfDurationOf(sel);
    const startTime = currentTime, end = startTime + dur;

    timeline.push({ processId: p.id, start: startTime, end });
    if (!firstStart.has(p.id)) firstStart.set(p.id, startTime);
    st.cpuConsumed += dur;

    if (st.opIndex < ops.length) {
      const op = ops[st.opIndex];
      const ioEnd = end + op.duration;
      ioTimeline.push({ processId: p.id, start: end, end: ioEnd });
      st.opIndex += 1;
      if (st.cpuConsumed === p.burstTime) {

        st.stage = 'done';
        finishTime.set(p.id, ioEnd);
        sjfCompletedCount++;
      } else {
        st.nextReadyTime = ioEnd;
        st.fifoOrder = nextSjfFifoOrder++; // record I/O entry order for FIFO tie-break on return
      }
    } else {
      st.stage = 'done'; finishTime.set(p.id, end); sjfCompletedCount++;
    }
    return end;
  }

  // ──────────── ESTADO DE LA COLA RR ────────────
  const rrSorted = [...rrProcesses]
    .map(p => ({ id: p.id, arrivalTime: p.arrivalTime, burstTime: p.burstTime }))
    .sort((a, b) => a.arrivalTime - b.arrivalTime);
  let rrNextArrivalIdx = 0;
  const rrQueue: string[] = [];
  const rrProcessMap = new Map(rrProcesses.map(p => [p.id, p]));
  const rrOps = new Map(rrProcesses.map(p => [p.id, normalizeIoOperations(p)]));
  const rrOpIndex = new Map<string, number>();
  const rrCpuConsumed = new Map<string, number>();
  for (const p of rrProcesses) { rrOpIndex.set(p.id, 0); rrCpuConsumed.set(p.id, 0); }

  function rrCurrentPhaseDuration(pid: string): number {
    const p = rrProcessMap.get(pid)!, ops = rrOps.get(pid)!, idx = rrOpIndex.get(pid)!, consumed = rrCpuConsumed.get(pid)!;
    return idx < ops.length ? ops[idx].after - consumed : p.burstTime - consumed;
  }

  const rrRemaining = new Map<string, number>();
  for (const p of rrProcesses) rrRemaining.set(p.id, rrCurrentPhaseDuration(p.id));

  const rrPendingIo: PendingIo[] = [];
  const rrCompleted = new Set<string>();
  let rrCompletedCount = 0;
  let nextOrder = 0;

  // Recolecta llegadas y retornos de E/S en la cola RR
  function rrEnqueueReady(now: number): void {
    const candidates: ReadyCandidate[] = [];
    while (rrNextArrivalIdx < rrSorted.length && rrSorted[rrNextArrivalIdx].arrivalTime <= now) {
      const arr = rrSorted[rrNextArrivalIdx];
      if (!rrCompleted.has(arr.id)) candidates.push({ id: arr.id, readyTime: arr.arrivalTime, order: nextOrder++ });
      rrNextArrivalIdx++;
    }
    const stillPending: PendingIo[] = [];
    for (const io of rrPendingIo) {
      if (io.readyAt <= now) {
        if (io.nextRemaining > 0) candidates.push({ id: io.processId, readyTime: io.readyAt, resetRemaining: io.nextRemaining, order: io.order });
        else { rrCompleted.add(io.processId); finishTime.set(io.processId, io.readyAt); rrCompletedCount++; }
      } else stillPending.push(io);
    }
    rrPendingIo.length = 0; rrPendingIo.push(...stillPending);
    candidates.sort((a, b) => (a.readyTime !== b.readyTime ? a.readyTime - b.readyTime : a.order - b.order));
    for (const c of candidates) {
      if (c.resetRemaining !== undefined) rrRemaining.set(c.id, c.resetRemaining);
      rrQueue.push(c.id);
    }
  }

  // Despacha un proceso de la cola RR por un quantum
  function dispatchRrOnce(currentTime: number): number {
    const pid = rrQueue.shift()!;
    const p = rrProcessMap.get(pid)!;
    if (!firstStart.has(pid)) firstStart.set(pid, currentTime);
    const rem = rrRemaining.get(pid)!, runTime = Math.min(rem, quantum);
    timeline.push({ processId: pid, start: currentTime, end: currentTime + runTime });
    const newTime = currentTime + runTime;
    rrRemaining.set(pid, rem - runTime);
    rrCpuConsumed.set(pid, rrCpuConsumed.get(pid)! + runTime);
    rrEnqueueReady(newTime);

    if (rem - runTime <= 0) {
      const ops = rrOps.get(pid)!, idx = rrOpIndex.get(pid)!;
      if (idx < ops.length) {
        const op = ops[idx], ioReadyAt = newTime + op.duration;
        rrOpIndex.set(pid, idx + 1);
        ioTimeline.push({ processId: pid, start: newTime, end: ioReadyAt });
        if (rrCpuConsumed.get(pid) === p.burstTime)
          rrPendingIo.push({ processId: pid, readyAt: ioReadyAt, nextRemaining: 0, order: nextOrder++ });
        else {
          const nextIdx = idx + 1, nextOp = nextIdx < ops.length ? ops[nextIdx] : undefined;
          rrPendingIo.push({ processId: pid, readyAt: ioReadyAt, nextRemaining: nextOp ? nextOp.after - rrCpuConsumed.get(pid)! : p.burstTime - rrCpuConsumed.get(pid)!, order: nextOrder++ });
        }
      } else { rrCompleted.add(pid); finishTime.set(pid, newTime); rrCompletedCount++; }
    } else rrQueue.push(pid);
    return newTime;
  }

  rrEnqueueReady(0); // Poblar cola RR con llegadas en t=0

  // ──────────── BUCLE MAESTRO ────────────
  // Despacha UNA unidad a la vez de la cola activa según la prioridad fija
  let currentTime = 0;
  const totalProcesses = processes.length;
  let completedCount = 0;

  while (completedCount < totalProcesses) {
    rrEnqueueReady(currentTime);
    completedCount = sjfCompletedCount + rrCompletedCount;
    if (completedCount >= totalProcesses) break;

    const sjfReady = sjfReadyCandidates(currentTime).length > 0;
    const rrReady = rrQueue.length > 0;

    // Política de prioridad fija: ¿qué cola ejecuta?
    const activeQueue: 'SJF' | 'RR' | null =
      priorityQueue === 'SJF'
        ? sjfReady ? 'SJF' : rrReady ? 'RR' : null
        : rrReady ? 'RR' : sjfReady ? 'SJF' : null;

    if (activeQueue === null) {
      // Nadie listo → salta al próximo evento (llegada o fin de E/S) en ambas colas
      let nextTime = Infinity;
      for (let i = 0; i < sjfN; i++) {
        const st = sjfStates[i];
        if (st.stage === 'running' && st.nextReadyTime < nextTime) nextTime = st.nextReadyTime;
      }
      if (rrNextArrivalIdx < rrSorted.length) nextTime = Math.min(nextTime, rrSorted[rrNextArrivalIdx].arrivalTime);
      for (const io of rrPendingIo) nextTime = Math.min(nextTime, io.readyAt);
      if (nextTime === Infinity) break;
      currentTime = nextTime;
      continue;
    }

    currentTime = activeQueue === 'SJF' ? dispatchSjfOnce(currentTime) : dispatchRrOnce(currentTime);
    completedCount = sjfCompletedCount + rrCompletedCount;
  }

  // Construye resultados preservando el orden original de entrada
  const processResults: ProcessResult[] = [];
  for (const p of processes) {
    const startTime = firstStart.get(p.id)!, finish = finishTime.get(p.id)!;
    const turnaroundTime = finish - p.arrivalTime;
    const sumIo = normalizeIoOperations(p).reduce((s, op) => s + op.duration, 0);
    const waitingTime = turnaroundTime - p.burstTime - sumIo;
    processResults.push({ processId: p.id, arrivalTime: p.arrivalTime, startTime, finishTime: finish, waitingTime, turnaroundTime });
  }

  const sumWaiting = processResults.reduce((s, r) => s + r.waitingTime, 0);
  const sumTurnaround = processResults.reduce((s, r) => s + r.turnaroundTime, 0);

  return {
    timeline, processResults,
    averageWaitingTime: sumWaiting / totalProcesses,
    averageTurnaroundTime: sumTurnaround / totalProcesses,
    ioTimeline,
  };
}
