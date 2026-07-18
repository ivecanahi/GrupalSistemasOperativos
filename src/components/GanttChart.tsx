import type { ExecutionSlice } from '../types/scheduling';

interface GanttChartProps {
  timeline: ExecutionSlice[];
}

// Módulo 3 (visualización): dibujar el hilo de Gantt a partir del timeline (start/end por proceso).
export function GanttChart({ timeline }: GanttChartProps) {
  return <div>GanttChart: pendiente de implementación ({timeline.length} slices)</div>;
}
