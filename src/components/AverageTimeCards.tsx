import type { ProcessResult } from '../types/scheduling';

interface AverageTimeCardsProps {
  processResults: ProcessResult[];
  averageWaitingTime: number;
  averageTurnaroundTime: number;
}

// Sections 5-6 (resumen del ejercicio): the two large "tiempo de espera
// promedio" / "tiempo de ejecución medio" cards, split out of StatsPanel.
// Data/formulas are byte-identical to what StatsPanel rendered before —
// this is a pure display reorganization.
export function AverageTimeCards({ processResults, averageWaitingTime, averageTurnaroundTime }: AverageTimeCardsProps) {
  return (
    <div className="avg-time-cards">
      <div className="avg-time-card-lg accent-sjf">
        <span className="avg-time-card-lg-label">Tiempo de espera promedio</span>
        <span className="avg-time-card-lg-value">{averageWaitingTime}</span>
        <span className="avg-time-card-lg-formula">
          ({processResults.map(r => r.waitingTime).join(' + ')}) / {processResults.length}
        </span>
      </div>
      <div className="avg-time-card-lg accent-rr">
        <span className="avg-time-card-lg-label">Tiempo de ejecución medio</span>
        <span className="avg-time-card-lg-value">{averageTurnaroundTime}</span>
        <span className="avg-time-card-lg-formula">
          ({processResults.map(r => r.turnaroundTime).join(' + ')}) / {processResults.length}
        </span>
      </div>
    </div>
  );
}
