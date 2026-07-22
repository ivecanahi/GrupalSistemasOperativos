import type { QueueSlice } from '../types/scheduling';
import { packIntervals, type PackedSlice } from '../lib/lanePacking';
import { pickTextColor } from '../lib/contrastColor';

export type QueueSectionAccent = 'sjf' | 'rr' | 'io' | 'cpu';

interface QueueSectionProps {
  title: string;
  slices: QueueSlice[];
  colorMap: Map<string, string>;
  accent: QueueSectionAccent;
}

const MAX_INTEGER_TICK_SPAN = 40;

function buildTicks(maxEnd: number): number[] {
  if (maxEnd <= 0) return [0];
  if (maxEnd <= MAX_INTEGER_TICK_SPAN) {
    return Array.from({ length: Math.floor(maxEnd) + 1 }, (_, i) => i);
  }
  // Long span: fall back to a smaller set of evenly-spaced ticks to avoid
  // an unreadable, collapsed ruler.
  const step = Math.ceil(maxEnd / MAX_INTEGER_TICK_SPAN);
  const ticks: number[] = [];
  for (let t = 0; t <= maxEnd; t += step) ticks.push(t);
  if (ticks[ticks.length - 1] !== maxEnd) ticks.push(maxEnd);
  return ticks;
}

const PX_PER_MS = 48;
// Overlapping waiters are drawn as thin stacked bands WITHIN one row (not as
// separate full-height rows) so a queue never visually reads as multiple
// parallel lanes — it's one queue, some entries just happen to overlap in time.
const BAND_HEIGHT = 22;

export function QueueSection({ title, slices, colorMap, accent }: QueueSectionProps) {
  const maxEnd = slices.length > 0 ? Math.max(...slices.map(s => s.end)) : 0;
  const scale = maxEnd > 0 ? 100 / maxEnd : 1;
  const ticks = buildTicks(maxEnd);
  const packed: PackedSlice[] = packIntervals(slices);
  const trackCount = packed.reduce((max, s) => Math.max(max, s.track + 1), 1);
  const contentWidth = Math.max(maxEnd * PX_PER_MS, 1);

  return (
    <div className={`queue-section accent-${accent}`}>
      <h3 className="queue-section-title">{title}</h3>
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
              const duration = s.end - s.start;
              const isInstant = duration < 0.001;
              const width = isInstant ? 0 : (duration * scale);
              const left = s.start * scale;
              const textColor = pickTextColor(color);
              return isInstant ? (
                <div
                  key={i}
                  className="queue-pill queue-pill-instant"
                  data-slice
                  data-instant
                  data-color={color}
                  data-track={s.track}
                  data-text-color={textColor}
                  title={`${s.processId} llega en t=${s.start}`}
                  style={{
                    left: `calc(${left}% - 4px)`,
                    top: `${s.track * BAND_HEIGHT + 4}px`,
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: color,
                    color: textColor === 'dark' ? '#08060d' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    overflow: 'hidden',
                  }}
                >
                  {s.processId}
                </div>
              ) : (
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
    </div>
  );
}
