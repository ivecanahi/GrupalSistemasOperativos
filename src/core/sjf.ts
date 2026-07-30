// ============================================================
// ALGORITMO SJF (Shortest Job First) — No apropiativo
// ============================================================
// SJF no apropiativo: selecciona siempre el proceso listo con
// la ráfaga de CPU más corta restante y lo ejecuta hasta que
// termina o hasta que hace una E/S. Soporta múltiples
// operaciones de E/S por proceso.

import type { ProcessInput, SchedulingResult, ExecutionSlice, ProcessResult, QueueSlice } from '../types/scheduling';
import { normalizeIoOperations } from './ioOperations';

// Estado interno de cada proceso durante la simulación
interface ProcState {

// Selecciona el proceso con menor ráfaga restante entre los listos
// Desempate: menor readyTime, luego menor id

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
  /**
   * Monotonic order for FIFO tie-breaking: set at arrival for fresh processes,
   * and updated when entering I/O so processes returning from I/O keep their
   * entry order (first-entered-I/O returns first when readyTimes collide).
   */
  fifoOrder: number;
}

/**
 * Pick the shortest remaining CPU work among ready candidates.
 * Ties broken by earliest readyTime.
 * If both are fresh arrivals (never run before): ascending id.
 * If one or both are I/O returnees: FIFO order (who entered I/O earlier).
 */
function selectShortest(
  ready: number[],
  processes: ProcessInput[],
  remainingWorkOf: (i: number) => number,
  readyTimeOf: (i: number) => number,
  fifoOrderOf: (i: number) => number,
  hasRunBefore: (i: number) => boolean,
): number {
  let sel = ready[0];
  for (let i = 1; i < ready.length; i++) {
    const idx = ready[i];
    const durCmp = remainingWorkOf(idx) - remainingWorkOf(sel);
    if (durCmp < 0) {
      sel = idx;
    } else if (durCmp === 0) {
      const readyCmp = readyTimeOf(idx) - readyTimeOf(sel);
      if (readyCmp < 0) {
        sel = idx;
      } else if (readyCmp === 0) {
        const selFresh = !hasRunBefore(sel);
        const idxFresh = !hasRunBefore(idx);
        if (selFresh && idxFresh) {
          // Both fresh: tie-break by id (spec requirement)
          if (processes[idx].id < processes[sel].id) sel = idx;
        } else {
          // At least one I/O returnee: FIFO order wins
          const fifoCmp = fifoOrderOf(idx) - fifoOrderOf(sel);
          if (fifoCmp < 0) {
            sel = idx;
          } else if (fifoCmp === 0 && processes[idx].id < processes[sel].id) {
            sel = idx;
          }
        }
      }
    }
  }
  return sel;
}

// Motor principal SJF: ejecuta la simulación completa
export function runSJF(processes: ProcessInput[]): SchedulingResult {
  if (processes.length === 0) {
    return {
      timeline: [], processResults: [],
      averageWaitingTime: 0, averageTurnaroundTime: 0,
      ioTimeline: [],
    };
  }

  const n = processes.length;
  const allOps = processes.map(normalizeIoOperations); // Normaliza E/S de cada proceso


  // Inicializa estados: cada proceso comienza en su arrivalTime
  let nextFifoOrder = 0;
  const states: ProcState[] = processes.map((p, i) => ({
    index: i,
    opIndex: 0,
    cpuConsumed: 0,
    stage: 'running',
    nextReadyTime: p.arrivalTime,
    fifoOrder: nextFifoOrder++,
  }));

  let completedCount = 0;
  let currentTime = 0;

  const timeline: ExecutionSlice[] = [];    // Línea de tiempo de CPU
  const ioTimeline: QueueSlice[] = [];      // Intervalos de E/S
  const firstStart = new Map<string, number>(); // Primera vez que cada proceso usa CPU
  const finishTime = new Map<string, number>(); // Cuándo terminó cada proceso

  // Funciones auxiliares para conocer estado de cada proceso
  const durationOf = (i: number): number => {
    const st = states[i];
    const ops = allOps[i];
    return st.opIndex < ops.length
      ? ops[st.opIndex].after - st.cpuConsumed
      : processes[i].burstTime - st.cpuConsumed;
  };
  const remainingWorkOf = (i: number): number => processes[i].burstTime - states[i].cpuConsumed;
  const readyTimeOf = (i: number): number => states[i].nextReadyTime;
  const fifoOrderOf = (i: number): number => states[i].fifoOrder;
  const hasRunBefore = (i: number): boolean => states[i].cpuConsumed > 0;

  // Bucle principal: mientras queden procesos por completar
  while (completedCount < n) {
    // Recolecta procesos listos (llegaron o volvieron de E/S)
    const ready: number[] = [];
    for (let i = 0; i < n; i++) {
      const st = states[i];
      if (st.stage === 'running' && st.nextReadyTime <= currentTime) {
        ready.push(i);
      }
    }

    // Si nadie está listo → salto temporal (idle) hasta el próximo evento
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

    // Selecciona el más corto y lo ejecuta hasta completar su fase actual
    const sel = selectShortest(ready, processes, remainingWorkOf, readyTimeOf, fifoOrderOf, hasRunBefore);
    const p = processes[sel];
    const st = states[sel];
    const ops = allOps[sel];
    const dur = durationOf(sel);
    const startTime = currentTime;
    const end = startTime + dur;

    timeline.push({ processId: p.id, start: startTime, end });
    if (!firstStart.has(p.id)) firstStart.set(p.id, startTime);

    st.cpuConsumed += dur;

    // Verifica si esta fase terminó por una operación de E/S
    if (st.opIndex < ops.length) {
      const op = ops[st.opIndex];
      const ioStart = end;
      const ioEnd = end + op.duration;
      ioTimeline.push({ processId: p.id, start: ioStart, end: ioEnd });
      st.opIndex += 1;

      if (st.cpuConsumed === p.burstTime) {
        // Terminó justo al completar la E/S
        st.stage = 'done';
        finishTime.set(p.id, ioEnd);
        completedCount++;
      } else {
        st.nextReadyTime = ioEnd; // Vuelve a la cola de listos después de la E/S
        st.nextReadyTime = ioEnd;
        st.fifoOrder = nextFifoOrder++; // Vuelve a la cola de listos después de la E/S
      }
    } else {
      st.stage = 'done';
      finishTime.set(p.id, end);
      completedCount++;
    }

    currentTime = end;
  }

  // Construye resultados por proceso: waiting y turnaround
  const processResults: ProcessResult[] = [];
  for (const p of processes) {
    const startTime = firstStart.get(p.id)!;
    const finish = finishTime.get(p.id)!;
    const turnaroundTime = finish - p.arrivalTime;
    const sumIo = normalizeIoOperations(p).reduce((s, op) => s + op.duration, 0);
    const waitingTime = turnaroundTime - p.burstTime - sumIo;

    processResults.push({
      processId: p.id, arrivalTime: p.arrivalTime,
      startTime, finishTime: finish,
      waitingTime, turnaroundTime,
    });
  }

  // Promedios finales
  const sumWaiting = processResults.reduce((s, r) => s + r.waitingTime, 0);
  const sumTurnaround = processResults.reduce((s, r) => s + r.turnaroundTime, 0);

  return {
    timeline, processResults,
    averageWaitingTime: sumWaiting / n,
    averageTurnaroundTime: sumTurnaround / n,
    ioTimeline,
  };
}
