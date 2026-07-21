import type { ExecutionSlice } from '../types/scheduling';

interface GanttChartProps {
  timeline: ExecutionSlice[];
}

const COLORS = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
];

function assignColor(colorMap: Map<string, string>, processId: string, nextIdx: { v: number }): string {
  let c = colorMap.get(processId);
  if (!c) {
    c = COLORS[nextIdx.v % COLORS.length];
    colorMap.set(processId, c);
    nextIdx.v++;
  }
  return c;
}

export function GanttChart({ timeline }: GanttChartProps) {
  if (timeline.length === 0) {
    return <div>No hay procesos para mostrar</div>;
  }

  const totalEnd = Math.max(...timeline.map(s => s.end));
  const scale = totalEnd > 0 ? 100 / totalEnd : 1;

  const colorMap = new Map<string, string>();
  const nextIdx = { v: 0 };

  const annotated = timeline.map(s => ({
    ...s,
    color: assignColor(colorMap, s.processId, nextIdx),
    w: (s.end - s.start) * scale,
    l: s.start * scale,
  }));

  if (totalEnd === 0) {
    return (
      <div>
        {annotated.map((s, i) => (
          <div key={i} data-slice data-color={s.color} data-width="100"
            style={{ background: s.color, width: '100%', height: 30 }} />
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
    <div style={{ position: 'relative', width: '100%', height: 40, background: '#f0f0f0', border: '1px solid #ccc' }}>
      {gaps.map((g, i) => (
        <div key={`idle-${i}`} data-idle
          style={{ position: 'absolute', left: `${g.l}%`, width: `${g.w}%`, height: '100%', background: '#e0e0e0', borderLeft: '1px dashed #999', boxSizing: 'border-box' }} />
      ))}
      {annotated.map((s, i) => (
        <div key={i} data-slice data-color={s.color} data-width={s.w.toFixed(4)}
          style={{ position: 'absolute', left: `${s.l}%`, width: `${s.w}%`, height: '100%', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 'bold', overflow: 'hidden' }}>
          {s.processId}
        </div>
      ))}
    </div>
  );
}
