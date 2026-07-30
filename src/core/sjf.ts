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
  index: number;           // Índice en el arreglo original
  opIndex: number;         // Índice de la operación de E/S actual
  cpuConsumed: number;     // Cuánto CPU ha consumido hasta ahora
  stage: 'running' | 'done'; // Estado del proceso
  nextReadyTime: number;   // Cuándo estará listo (arrival o fin de E/S)
}

// Selecciona el proceso con menor ráfaga restante entre los listos
// Desempate: menor readyTime, luego menor id
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
  const states: ProcState[] = processes.map((p, i) => ({
    index: i, opIndex: 0, cpuConsumed: 0,
    stage: 'running', nextReadyTime: p.arrivalTime,
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
    const sel = selectShortest(ready, processes, remainingWorkOf, readyTimeOf);
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
