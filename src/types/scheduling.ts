export interface IoOperation {
  after: number; // ms of CUMULATIVE CPU execution completed before this I/O triggers
  duration: number; // ms this I/O operation lasts
}

export type QueueAssignment = 'SJF' | 'RR';

export interface ProcessInput {
  id: string;
  name: string;
  arrivalTime: number;
  burstTime: number;
  ioBurstTime?: number; // Optional I/O phase duration
  ioTriggerAfter?: number; // ms of CPU execution completed before I/O triggers.
  // If ioBurstTime is set but this is omitted, defaults to burstTime
  // (I/O strictly after the full burst — legacy behavior).
  // Must be > 0 and <= burstTime when provided.
  // Legacy single-op shorthand — KEPT for backward compatibility.
  ioOperations?: IoOperation[]; // NEW: general multi-op list. When non-empty,
  // takes precedence over ioBurstTime/ioTriggerAfter.
  queue?: QueueAssignment; // NEW: which MLQ queue this process belongs to;
  // defaults to 'SJF' when unset (irrelevant for plain SJF/RR runs, only
  // consulted by MLQ).
}

export interface ExecutionSlice {
  processId: string;
  start: number;
  end: number;
}

export interface ProcessResult {
  processId: string;
  arrivalTime: number;
  startTime: number;
  finishTime: number;
  waitingTime: number;
  turnaroundTime: number;
}

export interface QueueSlice {
  processId: string;
  start: number;
  end: number;
}

export interface QueueTimelines {
  cpu: QueueSlice[];
  ready: QueueSlice[];
  io: QueueSlice[];
}

export interface SchedulingResult {
  timeline: ExecutionSlice[];
  processResults: ProcessResult[];
  averageWaitingTime: number;
  averageTurnaroundTime: number;
  queues?: QueueTimelines; // Optional so runSJF/runRoundRobin's existing return statements still typecheck; schedule() always populates it
  ioTimeline?: QueueSlice[]; // I/O intervals emitted directly by the engine
}

export type Algorithm = 'SJF' | 'RR' | 'MLQ';

export interface SchedulerConfig {
  algorithm: Algorithm;
  quantum?: number; // used by RR and by MLQ's RR-queue
  priorityQueue?: QueueAssignment; // NEW: which queue has fixed priority in
  // MLQ; defaults to 'SJF' when unset.
}
