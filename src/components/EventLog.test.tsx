import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { EventLog } from './EventLog';
import type { ScheduleEvent } from '../lib/eventLog';

afterEach(cleanup);

const events: ScheduleEvent[] = [
  { time: 0, processId: 'P1', kind: 'arrival', label: 'P1 llega al sistema (t=0)' },
  { time: 0, processId: 'P1', kind: 'cpu-start', label: 'P1 comienza a ejecutar en CPU (t=0)' },
  { time: 3, processId: 'P1', kind: 'cpu-end', label: 'P1 deja la CPU (t=3)' },
  { time: 3, processId: 'P1', kind: 'finish', label: 'P1 finaliza su ejecución (t=3)' },
];

describe('EventLog', () => {
  it('renders collapsed by default (event labels not in the document)', () => {
    render(<EventLog events={events} />);
    expect(screen.getByText('Registro de eventos')).toBeTruthy();
    expect(screen.queryByText('P1 llega al sistema (t=0)')).toBeNull();
    expect(screen.queryByText('P1 finaliza su ejecución (t=3)')).toBeNull();
  });

  it('clicking the header expands and shows all event labels in order', () => {
    render(<EventLog events={events} />);
    fireEvent.click(screen.getByText('Registro de eventos'));

    const items = screen.getAllByRole('listitem');
    expect(items.map(li => li.textContent)).toEqual([
      expect.stringContaining('P1 llega al sistema (t=0)'),
      expect.stringContaining('P1 comienza a ejecutar en CPU (t=0)'),
      expect.stringContaining('P1 deja la CPU (t=3)'),
      expect.stringContaining('P1 finaliza su ejecución (t=3)'),
    ]);
  });

  it('clicking again collapses', () => {
    render(<EventLog events={events} />);
    const header = screen.getByText('Registro de eventos');
    fireEvent.click(header);
    expect(screen.getByText('P1 llega al sistema (t=0)')).toBeTruthy();

    fireEvent.click(header);
    expect(screen.queryByText('P1 llega al sistema (t=0)')).toBeNull();
  });

  it('empty events array does not throw and shows a sensible empty message when expanded', () => {
    expect(() => render(<EventLog events={[]} />)).not.toThrow();
    render(<EventLog events={[]} />);
    const headers = screen.getAllByText('Registro de eventos');
    fireEvent.click(headers[headers.length - 1]);
    expect(screen.getByText(/no hay eventos/i)).toBeTruthy();
  });
});
