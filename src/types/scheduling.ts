// ============================================================
// TIPOS PRINCIPALES — definen la estructura de datos del simulador
// ============================================================

// Representa una operación de Entrada/Salida (E/S) que un proceso puede realizar
export interface IoOperation {
  after: number; // Cantidad de CPU acumulada (en ms) antes de que se dispare esta E/S
  duration: number; // Duración (en ms) de la operación de E/S
}

// Asignación de cola para MLQ: SJF (no apropiativo) o RR (Round Robin)
export type QueueAssignment = 'SJF' | 'RR';

// Datos de entrada de un proceso: lo que el usuario ingresa en la tabla
export interface ProcessInput {
  id: string;               // Identificador único del proceso (ej: "P1")
  name: string;             // Nombre visible del proceso
  arrivalTime: number;      // Tiempo de llegada al sistema
  burstTime: number;        // Ráfaga de CPU total necesaria (en ms)
  ioBurstTime?: number;     // Campo legacy: duración de una sola operación de E/S
  ioTriggerAfter?: number;  // Campo legacy: después de cuánto CPU se dispara la E/S
  // Si ioOperations está definido, prevalece sobre ioBurstTime/ioTriggerAfter
  ioOperations?: IoOperation[]; // Lista moderna de operaciones de E/S (soporta múltiples)
  queue?: QueueAssignment;   // Cola a la que pertenece el proceso en MLQ (SJF o RR)
}

// Una porción (slice) de tiempo en la que un proceso ocupa la CPU
export interface ExecutionSlice {
  processId: string; // ID del proceso
  start: number;     // Tiempo de inicio de este tramo
  end: number;       // Tiempo de finalización de este tramo
}

// Resultado individual de cada proceso tras la simulación
export interface ProcessResult {
  processId: string;     // ID del proceso
  arrivalTime: number;   // Tiempo de llegada (se copia del input)
  startTime: number;     // Momento en que comenzó a ejecutarse por primera vez
  finishTime: number;    // Momento en que terminó su ejecución
  waitingTime: number;   // Tiempo de espera total (turnaround - burst - E/S)
  turnaroundTime: number; // Tiempo de retorno (finish - arrival)
}

// Porción en una cola (ready, CPU o E/S): para construir las líneas de tiempo
export interface QueueSlice {
  processId: string;
  start: number;
  end: number;
}

// Contiene las 3 líneas de tiempo que se muestran en la UI
export interface QueueTimelines {
  cpu: QueueSlice[];   // Línea de tiempo de la CPU
  ready: QueueSlice[]; // Cola de listos (tiempo que cada proceso esperó)
  io: QueueSlice[];    // Línea de tiempo de E/S
}

// Resultado completo de la simulación de un algoritmo
export interface SchedulingResult {
  timeline: ExecutionSlice[];    // Todos los tramos de CPU ejecutados
  processResults: ProcessResult[]; // Resultados por cada proceso
  averageWaitingTime: number;    // Tiempo de espera promedio
  averageTurnaroundTime: number; // Tiempo de retorno promedio
  queues?: QueueTimelines;       // Líneas de tiempo de colas (siempre se genera en schedule())
  ioTimeline?: QueueSlice[];     // Intervalos de E/S emitidos por el motor
}

// Algoritmo de planificación seleccionado
export type Algorithm = 'SJF' | 'RR' | 'MLQ';

// Configuración que el usuario elige antes de ejecutar
export interface SchedulerConfig {
  algorithm: Algorithm;           // Algoritmo a usar
  quantum?: number;               // Quantum para RR y MLQ (obligatorio en esos modos)
  priorityQueue?: QueueAssignment; // Cola con prioridad fija en MLQ (SJF o RR)
}
