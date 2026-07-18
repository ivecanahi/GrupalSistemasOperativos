import type { ProcessInput, SchedulerConfig, SchedulingResult } from '../types/scheduling';
import { runSJF } from './sjf';
import { runRoundRobin } from './roundRobin';

export function schedule(processes: ProcessInput[], config: SchedulerConfig): SchedulingResult {
  if (config.algorithm === 'SJF') {
    return runSJF(processes);
  }
  if (config.quantum === undefined || config.quantum <= 0) {
    throw new Error('Round Robin requiere un quantum > 0');
  }
  return runRoundRobin(processes, config.quantum);
}

export * from '../types/scheduling';
