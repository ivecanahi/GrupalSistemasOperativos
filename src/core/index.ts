import type { ProcessInput, SchedulerConfig, SchedulingResult } from '../types/scheduling';
import { runSJF } from './sjf';
import { runRoundRobin } from './roundRobin';
import { runMLQ } from './mlq';
import { buildQueueTimelines } from './queues';

export function schedule(processes: ProcessInput[], config: SchedulerConfig): SchedulingResult {
  const base = dispatch(processes, config);
  const queues = buildQueueTimelines(processes, base.timeline, base.ioTimeline ?? []);
  return { ...base, queues };
}

function dispatch(processes: ProcessInput[], config: SchedulerConfig): SchedulingResult {
  if (config.algorithm === 'SJF') {
    return runSJF(processes);
  }
  if (config.algorithm === 'MLQ') {
    if (config.quantum === undefined || config.quantum <= 0) {
      throw new Error('Colas multinivel requieren un quantum > 0 para la cola Round Robin');
    }
    return runMLQ(processes, config.quantum, config.priorityQueue ?? 'SJF');
  }
  if (config.quantum === undefined || config.quantum <= 0) {
    throw new Error('Round Robin requiere un quantum > 0');
  }
  return runRoundRobin(processes, config.quantum);
}

export * from '../types/scheduling';
