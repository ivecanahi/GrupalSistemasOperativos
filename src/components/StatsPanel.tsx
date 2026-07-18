import type { ProcessResult } from '../types/scheduling';

interface StatsPanelProps {
  processResults: ProcessResult[];
  averageWaitingTime: number;
  averageTurnaroundTime: number;
}

// Módulo 5 (métricas): tabla de entrada/salida por proceso + promedios finales.
export function StatsPanel({ processResults, averageWaitingTime, averageTurnaroundTime }: StatsPanelProps) {
  return (
    <div>
      StatsPanel: pendiente de implementación ({processResults.length} resultados, espera prom.{' '}
      {averageWaitingTime}, retorno prom. {averageTurnaroundTime})
    </div>
  );
}
