import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PerProcessGantt } from './PerProcessGantt';
import type { ExecutionSlice } from '../types/scheduling';

afterEach(cleanup);

describe('PerProcessGantt', () => {
  it('renders the title and subtitle', () => {
    const timeline: ExecutionSlice[] = [{ processId: 'A', start: 0, end: 2 }];
    const colorMap = new Map([['A', 'var(--series-1)']]);
    render(<PerProcessGantt timeline={timeline} colorMap={colorMap} />);

    expect(screen.getByText('Diagrama de Gantt (CPU)')).toBeTruthy();
    expect(screen.getByText(/Tramos de ejecución en CPU por proceso/i)).toBeTruthy();
  });

  it('renders one legend entry per distinct process', () => {
    const timeline: ExecutionSlice[] = [
      { processId: 'A', start: 0, end: 2 },
      { processId: 'B', start: 2, end: 4 },
      { processId: 'A', start: 4, end: 6 },
    ];
    const colorMap = new Map([['A', 'var(--series-1)'], ['B', 'var(--series-2)']]);
    const { container } = render(<PerProcessGantt timeline={timeline} colorMap={colorMap} />);

    expect(container.querySelectorAll('[data-legend-entry]')).toHaveLength(2);
  });

  it('renders one row per distinct process, each containing only that process\'s own slices', () => {
    const timeline: ExecutionSlice[] = [
      { processId: 'A', start: 0, end: 2 },
      { processId: 'B', start: 2, end: 4 },
      { processId: 'A', start: 4, end: 6 },
    ];
    const colorMap = new Map([['A', 'var(--series-1)'], ['B', 'var(--series-2)']]);
    const { container } = render(<PerProcessGantt timeline={timeline} colorMap={colorMap} />);

    const rows = container.querySelectorAll('[data-row]');
    expect(rows).toHaveLength(2);

    const rowA = container.querySelector('[data-row="A"]')!;
    const slicesInRowA = rowA.querySelectorAll('[data-slice]');
    expect(slicesInRowA).toHaveLength(2);
    slicesInRowA.forEach(s => expect(s.getAttribute('data-process')).toBe('A'));

    const rowB = container.querySelector('[data-row="B"]')!;
    expect(rowB.querySelectorAll('[data-slice]')).toHaveLength(1);
  });

  it('renders proportional widths within a row matching the existing ratio convention', () => {
    const timeline: ExecutionSlice[] = [
      { processId: 'A', start: 0, end: 2 },
      { processId: 'A', start: 8, end: 10 },
    ];
    const colorMap = new Map([['A', 'var(--series-1)']]);
    const { container } = render(<PerProcessGantt timeline={timeline} colorMap={colorMap} />);

    const slices = container.querySelectorAll('[data-row="A"] [data-slice]');
    const widths = Array.from(slices).map(s => parseFloat(s.getAttribute('data-width') || '0'));
    expect(widths[0]).toBeCloseTo(widths[1], 10);
  });

  it('renders the empty-state message for an empty timeline without throwing', () => {
    expect(() => render(<PerProcessGantt timeline={[]} colorMap={new Map()} />)).not.toThrow();
    expect(screen.getByText(/no hay procesos para mostrar/i)).toBeTruthy();
  });

  it('hides the legend row when hideLegend is true, without affecting the rows themselves', () => {
    const timeline: ExecutionSlice[] = [
      { processId: 'A', start: 0, end: 2 },
      { processId: 'B', start: 2, end: 4 },
    ];
    const colorMap = new Map([['A', 'var(--series-1)'], ['B', 'var(--series-2)']]);
    const { container } = render(<PerProcessGantt timeline={timeline} colorMap={colorMap} hideLegend />);

    expect(container.querySelectorAll('[data-legend-entry]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-row]')).toHaveLength(2);
  });

  it('cross-checks legend swatch colors against the corresponding row slice colors', () => {
    const timeline: ExecutionSlice[] = [
      { processId: 'A', start: 0, end: 2 },
      { processId: 'B', start: 2, end: 4 },
    ];
    const colorMap = new Map([['A', 'var(--series-1)'], ['B', 'var(--series-2)']]);
    const { container } = render(<PerProcessGantt timeline={timeline} colorMap={colorMap} />);

    const legendA = container.querySelector('[data-legend-entry="A"]')!;
    const rowSliceA = container.querySelector('[data-row="A"] [data-slice]')!;
    expect(legendA.getAttribute('data-color')).toBe(rowSliceA.getAttribute('data-color'));
  });
});
