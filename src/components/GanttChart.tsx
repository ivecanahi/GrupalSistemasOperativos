import type { ExecutionSlice } from '../types/scheduling';
import { buildColorMap } from '../lib/seriesColors';

interface GanttChartProps {
  timeline: ExecutionSlice[];
}

export function GanttChart({ timeline }: GanttChartProps) {
  if (timeline.length === 0) {
    return <div className="gantt-empty">No hay procesos para mostrar</div>;
  }

  const totalEnd = Math.max(...timeline.map(s => s.end));
  const scale = totalEnd > 0 ? 100 / totalEnd : 1;

  const colorMap = buildColorMap(timeline.map(s => s.processId));

  const annotated = timeline.map(s => ({
    ...s,
    color: colorMap.get(s.processId)!,
    w: (s.end - s.start) * scale,
    l: s.start * scale,
  }));

  if (totalEnd === 0) {
    return (
      <div className="gantt">
        {annotated.map((s, i) => (
          <div key={i} className="gantt-slice" data-slice data-color={s.color} data-width="100"
            style={{ background: s.color, width: '100%', left: 0 }} />
        ))}
      </div>
    );
  }

  const gaps: { l: number; w: number }[] = [];
  let cursor = 0;
  for (const s of annotated) {
    if (s.start > cursor) {
      gaps.push({ l: cursor * scale, w: (s.start - cursor) * scale });
    }
    cursor = s.end;
  }
  if (cursor < totalEnd) {
    gaps.push({ l: cursor * scale, w: (totalEnd - cursor) * scale });
  }

  return (
    <div className="gantt">
      {gaps.map((g, i) => (
        <div key={`idle-${i}`} className="gantt-idle" data-idle
          style={{ left: `${g.l}%`, width: `${g.w}%` }} />
      ))}
      {annotated.map((s, i) => (
        <div key={i} className="gantt-slice" data-slice data-color={s.color} data-width={s.w.toFixed(4)}
          style={{ left: `${s.l}%`, width: `${s.w}%`, background: s.color }}>
          {s.processId}
        </div>
      ))}
    </div>
  );
}
