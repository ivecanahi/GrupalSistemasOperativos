import type { Algorithm, ProcessInput, ProcessResult } from '../types/scheduling';

interface StatsPanelProps {
  processResults: ProcessResult[];
  processes: ProcessInput[];
  algorithm: Algorithm;
}

const ALGORITHM_LABELS: Record<Algorithm, string> = {
  SJF: 'SJF (no apropiativo)',
  RR: 'Round Robin',
  MLQ: 'Colas multinivel (SJF + RR)',
};

// Módulo 5 (métricas): tabla de entrada/salida por proceso + resumen del ejercicio.
export function StatsPanel({ processResults, processes, algorithm }: StatsPanelProps) {
  const burstById = new Map(processes.map(p => [p.id, p.burstTime]));
  const bursts = processResults.map(r => burstById.get(r.processId) ?? 0);
  const averageBurstTime = bursts.length > 0 ? bursts.reduce((s, b) => s + b, 0) / bursts.length : 0;
  const makespan = processResults.length > 0 ? Math.max(...processResults.map(r => r.finishTime)) : 0;
  const algorithmLabel = ALGORITHM_LABELS[algorithm];

  return (
    <div className="stats-panel-wrap">
      <table className="process-table">
        <thead>
          <tr>
            <th>Proceso</th>
            <th>Llegada</th>
            <th>Entrada</th>
            <th>Salida</th>
            <th>Espera</th>
            <th>Retorno</th>
          </tr>
        </thead>
        <tbody>
          {processResults.map(result => (
            <tr key={result.processId}>
              <td>{result.processId}</td>
              <td>{result.arrivalTime}</td>
              <td>{result.startTime}</td>
              <td>{result.finishTime}</td>
              <td>{result.waitingTime}</td>
              <td>{result.turnaroundTime}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="stats-summary">
        Se simularon {processes.length} proceso(s) con el algoritmo {algorithmLabel}. El tiempo total de
        simulación (makespan) fue de {makespan} ms, con una ráfaga de CPU promedio de {averageBurstTime} ms.
      </p>

      <div className="metric-tile-sm-grid">
        <div className="metric-tile-sm">
          <span className="metric-tile-sm-label">Número de procesos</span>
          <span className="metric-tile-sm-value">{processes.length}</span>
        </div>
        <div className="metric-tile-sm">
          <span className="metric-tile-sm-label">Tiempo total de simulación</span>
          <span className="metric-tile-sm-value">{makespan}</span>
        </div>
        <div className="metric-tile-sm">
          <span className="metric-tile-sm-label">Ráfaga de CPU promedio</span>
          <span className="metric-tile-sm-value">{averageBurstTime}</span>
        </div>
        <div className="metric-tile-sm">
          <span className="metric-tile-sm-label">Algoritmo</span>
          <span className="metric-tile-sm-value">{algorithm}</span>
        </div>
      </div>
    </div>
  );
}
