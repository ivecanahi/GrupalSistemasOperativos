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
  * Controla cuándo el proceso está "listo" (ready) mientras stage === 'running':
  * - Si el proceso nunca ha corrido → es su arrivalTime (cuándo llegó al sistema)
  * - Si el proceso ya regresó de una espera de I/O → es el momento en que
   *   terminó esa espera de I/O (o sea, cuándo volvió a estar disponible)
  */
  nextReadyTime: number;
  
  /**
 * Un número que crece siempre hacia arriba (monotónico), usado para desempatar
 * en orden FIFO (el que llegó primero, se atiende primero):
 * - Para procesos nuevos: se asigna cuando el proceso llega (arrival)
 * - Cuando el proceso entra a I/O: se actualiza, para que al volver de I/O
 *   mantenga su lugar en la fila según CUÁNDO entró a I/O
 *  (así, si dos procesos "empatan" en nextReadyTime, gana el que entró
 *  primero a la cola de I/O, no el que salió primero)
 */
  fifoOrder: number;
}

/**
 * Selecciona el trabajo de CPU restante más corto entre los candidatos listos (ready).
 * Empates se resuelven por el readyTime más temprano.
 * Si ambos son llegadas nuevas (nunca han corrido antes): por id ascendente.
 * Si uno o ambos regresan de I/O: orden FIFO (quién entró primero a I/O).
 */
function selectShortest(
  ready: number[],                                  // índices de procesos listos para ejecutar
  processes: ProcessInput[],                         // lista completa de procesos
  remainingWorkOf: (i: number) => number,            // devuelve el trabajo restante del proceso i
  readyTimeOf: (i: number) => number,                // devuelve el momento en que el proceso i quedó listo
  fifoOrderOf: (i: number) => number,                // devuelve el orden FIFO de entrada a I/O del proceso i
  hasRunBefore: (i: number) => boolean,               // indica si el proceso i ya se ejecutó antes
): number {
  let sel = ready[0]; // se asume el primero como seleccionado inicial

  // Recorre el resto de los candidatos listos comparándolos con el seleccionado actual
  for (let i = 1; i < ready.length; i++) {
    const idx = ready[i];

    // Compara el trabajo restante: si idx tiene menos trabajo, gana idx
    const durCmp = remainingWorkOf(idx) - remainingWorkOf(sel);

    if (durCmp < 0) {
      // idx tiene menos trabajo restante que sel → idx pasa a ser el seleccionado
      sel = idx;
    } else if (durCmp === 0) {
      // Empate en trabajo restante: desempatar por readyTime (quién llegó/quedó listo antes)
      const readyCmp = readyTimeOf(idx) - readyTimeOf(sel);

      if (readyCmp < 0) {
        // idx quedó listo antes que sel → idx gana
        sel = idx;
      } else if (readyCmp === 0) {
        // Sigue el empate: revisar si son llegadas nuevas o regresos de I/O
        const selFresh = !hasRunBefore(sel); // ¿sel nunca se ha ejecutado antes?
        const idxFresh = !hasRunBefore(idx); // ¿idx nunca se ha ejecutado antes?

        if (selFresh && idxFresh) {
          // Ambos son llegadas nuevas (frescas): desempatar por id, en orden ascendente
          if (processes[idx].id < processes[sel].id) sel = idx;
        } else {
          // Al menos uno de los dos ya regresó de I/O:
          // en este caso manda el orden FIFO (quién entró primero a la cola de I/O)
          const fifoCmp = fifoOrderOf(idx) - fifoOrderOf(sel);

          if (fifoCmp < 0) {
            // idx entró antes a I/O → idx gana
            sel = idx;
          } else if (fifoCmp === 0 && processes[idx].id < processes[sel].id) {
            // Último desempate: si incluso el orden FIFO es igual, se usa el id ascendente
            sel = idx;
          }
        }
      }
    }
  }

  return sel; // devuelve el índice del proceso seleccionado como "el más corto"
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
