// ============================================================
// PUNTO DE ENTRADA CENTRAL DEL SIMULADOR
// ============================================================
// Este archivo actúa como fachada: recibe la configuración del
// usuario, delega en el algoritmo correspondiente y luego
// construye las líneas de tiempo de las colas para la UI.

import type { ProcessInput, SchedulerConfig, SchedulingResult } from '../types/scheduling';
import { runSJF } from './sjf';
import { runRoundRobin } from './roundRobin';
import { runMLQ } from './mlq';
import { buildQueueTimelines } from './queues';

// Función pública: ejecuta la simulación y devuelve resultados + colas
export function schedule(processes: ProcessInput[], config: SchedulerConfig): SchedulingResult {
  const base = dispatch(processes, config);                          // Ejecuta el algoritmo
  const queues = buildQueueTimelines(processes, base.timeline, base.ioTimeline ?? []); // Deriva colas
  return { ...base, queues };                                       // Resultado completo
}

// Enrutador interno: selecciona el algoritmo según la configuración
function dispatch(processes: ProcessInput[], config: SchedulerConfig): SchedulingResult {
  if (config.algorithm === 'SJF') {
    return runSJF(processes);
  }
  if (config.algorithm === 'MLQ') {
    // MLQ necesita quantum para su cola RR
    if (config.quantum === undefined || config.quantum <= 0) {
      throw new Error('Colas multinivel requieren un quantum > 0 para la cola Round Robin');
    }
    return runMLQ(processes, config.quantum, config.priorityQueue ?? 'SJF');
  }
  // RR también requiere quantum
  if (config.quantum === undefined || config.quantum <= 0) {
    throw new Error('Round Robin requiere un quantum > 0');
  }
  return runRoundRobin(processes, config.quantum);
}

export * from '../types/scheduling';
