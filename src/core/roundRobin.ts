// ============================================================
// ALGORITMO ROUND ROBIN — Quantum fijo
// ============================================================
// Round Robin: reparte la CPU en turnos de duración fija (quantum).
// Si un proceso no termina en su quantum, vuelve al final de la
// cola de listos. Sigue la convención Silberschatz: las nuevas
// llegadas se encolan ANTES que el proceso desalojado.
// Soporta múltiples operaciones de E/S por proceso.

import type { ProcessInput, SchedulingResult, ExecutionSlice, ProcessResult, QueueSlice } from '../types/scheduling';
import { normalizeIoOperations } from './ioOperations';

// Proceso que está realizando E/S: se guarda cuándo vuelve y cuánto le falta
interface PendingIo {
  processId: string;
  readyAt: number;          // Cuándo termina la E/S
  nextRemaining: number;    // Cuánto CPU le queda para su siguiente fase
  order: number;            // Orden de entrada a E/S (para desempate FIFO)
}

// Candidato a entrar a la cola de listos (nueva llegada o vuelta de E/S)
interface ReadyCandidate {
  id: string;
  readyTime: number;
  resetRemaining?: number;  // Si viene de E/S, actualiza su remaining
  order: number;            // Orden FIFO para desempate
}

// Motor principal Round Robin
export function runRoundRobin(
  processes: ProcessInput[],
  quantum: number,
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

  // Ordena procesos por arrivalTime para procesar llegadas secuencialmente
  const sorted = [...processes]
    .map(p => ({ id: p.id, arrivalTime: p.arrivalTime, burstTime: p.burstTime }))
    .sort((a, b) => a.arrivalTime - b.arrivalTime);

  let nextArrivalIdx = 0;

  const queue: string[] = []; // Cola FIFO de listos

  // Mapas de estado para acceso rápido por ID
  const processMap = new Map(processes.map(p => [p.id, p]));
  const ops = new Map(processes.map(p => [p.id, normalizeIoOperations(p)]));
  const opIndex = new Map<string, number>();   // En qué operación E/S va cada proceso
  const cpuConsumed = new Map<string, number>(); // Cuánto CPU ha consumido

  for (const p of processes) {
    opIndex.set(p.id, 0);
    cpuConsumed.set(p.id, 0);
  }

  // Calcula la duración de la fase actual del proceso (hasta próximo E/S o burst completo)
  function currentPhaseDuration(pid: string): number {
    const p = processMap.get(pid)!;
    const processOps = ops.get(pid)!;
    const idx = opIndex.get(pid)!;
    const consumed = cpuConsumed.get(pid)!;
    return idx < processOps.length ? processOps[idx].after - consumed : p.burstTime - consumed;
  }

  // Tiempo restante en la fase actual de cada proceso
  const remaining = new Map<string, number>();
  for (const p of processes) remaining.set(p.id, currentPhaseDuration(p.id));

  const pendingIo: PendingIo[] = [];      // Procesos haciendo E/S
  let nextOrder = 0;                       // Contador para orden FIFO

  const completed = new Set<string>();      // Procesos completados
  const firstStart = new Map<string, number>();
  const finishTime = new Map<string, number>();
  const timeline: ExecutionSlice[] = [];
  const ioTimeline: QueueSlice[] = [];

  let currentTime = 0;

  // Función clave: recolecta llegadas y vueltas de E/S en el tiempo actual
  // Las ordena por (readyTime, order) y las pone en la cola FIFO
  function enqueueReady(now: number): void {
    const candidates: ReadyCandidate[] = [];

    // Nuevas llegadas cuyo arrivalTime ya pasó
    while (nextArrivalIdx < sorted.length && sorted[nextArrivalIdx].arrivalTime <= now) {
      const arr = sorted[nextArrivalIdx];
      if (!completed.has(arr.id)) {
        candidates.push({ id: arr.id, readyTime: arr.arrivalTime, order: nextOrder++ });
      }
      nextArrivalIdx++;
    }

    // Procesos que vuelven de E/S
    const stillPending: PendingIo[] = [];
    for (const io of pendingIo) {
      if (io.readyAt <= now) {
        if (io.nextRemaining > 0) {
          candidates.push({
            id: io.processId, readyTime: io.readyAt,
            resetRemaining: io.nextRemaining, order: io.order,
          });
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

    // Ordena: primero por readyTime, luego por orden de llegada FIFO
    candidates.sort((a, b) => (a.readyTime !== b.readyTime ? a.readyTime - b.readyTime : a.order - b.order));

    for (const c of candidates) {
      if (c.resetRemaining !== undefined) {
        remaining.set(c.id, c.resetRemaining);
      }
      queue.push(c.id);
    }
  }

  // Poblar cola inicial con procesos que llegan en t=0
  enqueueReady(currentTime);

  // Bucle principal
  while (completed.size < processes.length) {
    // Salto temporal (idle) si la cola está vacía
    if (queue.length === 0) {
      let nextTime = Infinity;
      if (nextArrivalIdx < sorted.length) {
        nextTime = Math.min(nextTime, sorted[nextArrivalIdx].arrivalTime);
      }
      for (const io of pendingIo) {
        nextTime = Math.min(nextTime, io.readyAt);
      }
      if (nextTime === Infinity) break;
      currentTime = nextTime;
      enqueueReady(currentTime);
      continue;
    }

    // Despacha el siguiente proceso de la cola FIFO
    const pid = queue.shift()!;
    const p = processMap.get(pid)!;

    if (!firstStart.has(pid)) firstStart.set(pid, currentTime);

    const rem = remaining.get(pid)!;
    const runTime = Math.min(rem, quantum); // Ejecuta min(lo que queda, quantum)

    timeline.push({ processId: pid, start: currentTime, end: currentTime + runTime });
    currentTime += runTime;

    remaining.set(pid, rem - runTime);
    cpuConsumed.set(pid, cpuConsumed.get(pid)! + runTime);

    // Convención Silberschatz: nuevas llegadas se encolan ANTES del proceso desalojado
    enqueueReady(currentTime);

    if (rem - runTime <= 0) {
      // Terminó su fase actual
      const processOps = ops.get(pid)!;
      const idx = opIndex.get(pid)!;

      if (idx < processOps.length) {
        // Hace E/S
        const op = processOps[idx];
        const ioReadyAt = currentTime + op.duration;
        opIndex.set(pid, idx + 1);
        ioTimeline.push({ processId: pid, start: currentTime, end: ioReadyAt });

        if (cpuConsumed.get(pid) === p.burstTime) {
          // Ya consumió todo su burst → termina cuando vuelva de E/S
          pendingIo.push({ processId: pid, readyAt: ioReadyAt, nextRemaining: 0, order: nextOrder++ });
        } else {
          // Le queda más CPU después de la E/S
          const nextIdx = idx + 1;
          const nextOp = nextIdx < processOps.length ? processOps[nextIdx] : undefined;
          const nextRemaining = nextOp
            ? nextOp.after - cpuConsumed.get(pid)!
            : p.burstTime - cpuConsumed.get(pid)!;
          pendingIo.push({ processId: pid, readyAt: ioReadyAt, nextRemaining, order: nextOrder++ });
        }
      } else {
        completed.add(pid);
        finishTime.set(pid, currentTime);
      }
    } else {
      // No terminó su quantum → vuelve al final de la cola
      queue.push(pid);
    }
  }

  // Construye resultados preservando el orden original de entrada
  const processResults: ProcessResult[] = [];
  for (const p of processes) {
    const start = firstStart.get(p.id)!;
    const finish = finishTime.get(p.id)!;
    const turnaround = finish - p.arrivalTime;
    const sumIo = normalizeIoOperations(p).reduce((s, op) => s + op.duration, 0);
    const waiting = turnaround - p.burstTime - sumIo;

    processResults.push({
      processId: p.id, arrivalTime: p.arrivalTime,
      startTime: start, finishTime: finish,
      waitingTime: waiting, turnaroundTime: turnaround,
    });
  }

  const sumWaiting = processResults.reduce((s, r) => s + r.waitingTime, 0);
  const sumTurnaround = processResults.reduce((s, r) => s + r.turnaroundTime, 0);

  return {
    timeline, processResults,
    averageWaitingTime: sumWaiting / processes.length,
    averageTurnaroundTime: sumTurnaround / processes.length,
    ioTimeline,
  };
}
