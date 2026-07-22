import type { QueueSlice } from '../types/scheduling';
import { packIntervals, type PackedSlice } from '../lib/lanePacking';
import { pickTextColor } from '../lib/contrastColor';

export type QueueSectionAccent = 'sjf' | 'rr' | 'io' | 'cpu';
export type QueueSectionLayout = 'timeline' | 'row';

interface QueueSectionProps {
  title: string;
  slices: QueueSlice[];
  colorMap: Map<string, string>;
  accent: QueueSectionAccent;
  layout?: QueueSectionLayout;
}

const MAX_INTEGER_TICK_SPAN = 40;
const PX_PER_MS = 48;
const BAND_HEIGHT = 22;
const ROW_BLOCK_WIDTH = 72; // px — fixed size for ready-queue blocks
const ROW_BLOCK_GAP = 4;    // px — gap between blocks

function buildTicks(maxEnd: number): number[] {
  if (maxEnd <= 0) return [0];
  if (maxEnd <= MAX_INTEGER_TICK_SPAN) {
    return Array.from({ length: Math.floor(maxEnd) + 1 }, (_, i) => i);
  }
  const step = Math.ceil(maxEnd / MAX_INTEGER_TICK_SPAN);
  const ticks: number[] = [];
  for (let t = 0; t <= maxEnd; t += step) ticks.push(t);
  if (ticks[ticks.length - 1] !== maxEnd) ticks.push(maxEnd);
  return ticks;
}

/* ── Timeline layout (CPU / I/O) ─────────────────────────────────── */

function TimelineQueue({
  slices,
  colorMap,
  accent,
}: {
  slices: QueueSlice[];
  colorMap: Map<string, string>;
  accent: QueueSectionAccent;
}) {
  const maxEnd = slices.length > 0 ? Math.max(...slices.map(s => s.end)) : 0;
  const scale = maxEnd > 0 ? 100 / maxEnd : 1;
  const ticks = buildTicks(maxEnd);
  const packed: PackedSlice[] = packIntervals(slices);
  const trackCount = packed.reduce((max, s) => Math.max(max, s.track + 1), 1);
  const contentWidth = Math.max(maxEnd * PX_PER_MS, 1);

  return (
    <div className="queue-section-scroll">
      <div className="queue-section-content" style={{ minWidth: `${contentWidth}px` }}>
        <div className="queue-ruler">
          {ticks.map(t => (
            <span key={t} className="queue-ruler-tick" style={{ left: `${t * scale}%` }}>
              {t}
            </span>
          ))}
        </div>
        <div className="queue-section-row" style={{ height: `${trackCount * BAND_HEIGHT}px` }}>
          {packed.map((s, i) => {
            const color = colorMap.get(s.processId) ?? 'var(--series-1)';
            const width = (s.end - s.start) * scale;
            const left = s.start * scale;
            const textColor = pickTextColor(color);
            return (
              <div
                key={i}
                className="queue-pill"
                data-slice
                data-color={color}
                data-width={width.toFixed(4)}
                data-track={s.track}
                data-text-color={textColor}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  top: `${s.track * BAND_HEIGHT}px`,
                  height: `${BAND_HEIGHT - 3}px`,
                  background: color,
                  color: textColor === 'dark' ? '#08060d' : '#fff',
                }}
              >
                {s.processId}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Row layout (Ready queues) ─────────────────────────────────────── */

function RowQueue({
  slices,
  colorMap,
}: {
  slices: QueueSlice[];
  colorMap: Map<string, string>;
}) {
  // Sort by start time so the queue reads left-to-right chronologically
  const sorted = [...slices].sort((a, b) => a.start - b.start || a.end - b.end);

  return (
    <div className="queue-section-scroll">
      <div className="queue-section-content queue-section-content-row">
        <div className="queue-section-row queue-section-row-flat">
          {sorted.map((s, i) => {
            const color = colorMap.get(s.processId) ?? 'var(--series-1)';
            const textColor = pickTextColor(color);
            return (
              <div
                key={`${s.processId}-${i}`}
                className="queue-block"
                data-slice
                data-color={color}
                data-text-color={textColor}
                style={{
                  width: `${ROW_BLOCK_WIDTH}px`,
                  height: `${BAND_HEIGHT - 3}px`,
                  background: color,
                  color: textColor === 'dark' ? '#08060d' : '#fff',
                  marginRight: `${ROW_BLOCK_GAP}px`,
                }}
              >
                {s.processId}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────────── */

export function QueueSection({ title, slices, colorMap, accent, layout }: QueueSectionProps) {
  const resolvedLayout: QueueSectionLayout =
    layout ?? (accent === 'sjf' || accent === 'rr' ? 'row' : 'timeline');

  return (
    <div className={`queue-section accent-${accent}`}>
      <h3 className="queue-section-title">{title}</h3>
      {resolvedLayout === 'row' ? (
        <RowQueue slices={slices} colorMap={colorMap} />
      ) : (
        <TimelineQueue slices={slices} colorMap={colorMap} accent={accent} />
      )}
    </div>
  );
}
