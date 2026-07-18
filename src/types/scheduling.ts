export interface ProcessInput {
  id: string;
  name: string;
  arrivalTime: number;
  burstTime: number;
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

export interface SchedulingResult {
  timeline: ExecutionSlice[];
  processResults: ProcessResult[];
  averageWaitingTime: number;
  averageTurnaroundTime: number;
}

export type Algorithm = 'SJF' | 'RR';

export interface SchedulerConfig {
  algorithm: Algorithm;
  quantum?: number;
}
