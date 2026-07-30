// ============================================================
// TARJETAS DE TIEMPOS PROMEDIO — Espera y retorno
// ============================================================
// Muestra dos tarjetas grandes con:
// - Tiempo de espera promedio (waitingTime)
// - Tiempo de retorno promedio (turnaroundTime)
// Cada tarjeta incluye la fórmula: suma de valores / N

import type { ProcessResult } from '../types/scheduling';

interface AverageTimeCardsProps {
  processResults: ProcessResult[];
  averageWaitingTime: number;
  averageTurnaroundTime: number;
}

export function AverageTimeCards({ processResults, averageWaitingTime, averageTurnaroundTime }: AverageTimeCardsProps) {
  return (
    <div className="avg-time-cards">
      {/* Tarjeta de tiempo de espera promedio */}
      <div className="avg-time-card-lg accent-sjf">
        <span className="avg-time-card-lg-label">Tiempo de espera promedio</span>
        <span className="avg-time-card-lg-value">{averageWaitingTime}</span>
        <span className="avg-time-card-lg-formula">
          ({processResults.map(r => r.waitingTime).join(' + ')}) / {processResults.length}
        </span>
      </div>
      {/* Tarjeta de tiempo de retorno promedio */}
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
