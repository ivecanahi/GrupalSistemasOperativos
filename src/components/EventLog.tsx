import { useState } from 'react';
import type { ScheduleEvent } from '../lib/eventLog';

interface EventLogProps {
  events: ScheduleEvent[];
}

export function EventLog({ events }: EventLogProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="event-log">
      <button
        type="button"
        className="event-log-header"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <span className={expanded ? 'event-log-chevron event-log-chevron-open' : 'event-log-chevron'}>▸</span>
        <span className="event-log-title">Registro de eventos</span>
        <span className="event-log-count">{events.length}</span>
      </button>

      {expanded && (
        events.length === 0 ? (
          <p className="event-log-empty">No hay eventos</p>
        ) : (
          <ol className="event-log-list">
            {events.map((e, i) => (
              <li key={i} className="event-log-row">
                <span className="event-log-time">{`t=${e.time}`}</span>
                <span className="event-log-label">{e.label}</span>
              </li>
            ))}
          </ol>
        )
      )}
    </div>
  );
}
