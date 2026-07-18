import type { ProcessInput } from '../types/scheduling';

interface ProcessTableProps {
  processes: ProcessInput[];
  onChange: (processes: ProcessInput[]) => void;
}

// Módulo 2 (input): alta/edición manual de procesos (id, name, arrivalTime, burstTime) y validaciones.
export function ProcessTable({ processes, onChange }: ProcessTableProps) {
  return <div>ProcessTable: pendiente de implementación ({processes.length} procesos)</div>;
}
