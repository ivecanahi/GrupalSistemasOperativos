import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { QueueSection } from './QueueSection';
import type { QueueSlice } from '../types/scheduling';

afterEach(cleanup);

describe('QueueSection', () => {
  it('renders the title', () => {
    const { getByText } = render(
      <QueueSection title="Cola — SJF" slices={[]} colorMap={new Map()} accent="sjf" />,
    );
    expect(getByText('Cola — SJF')).toBeTruthy();
  });

  it('uses row layout automatically for sjf accent (ready queue)', () => {
    const slices: QueueSlice[] = [
      { processId: 'A', start: 0, end: 0 },
      { processId: 'B', start: 1, end: 5 },
    ];
    const { container } = render(
      <QueueSection title="Cola — SJF" slices={slices} colorMap={new Map([['A', 'var(--series-1)'], ['B', 'var(--series-2)']])} accent="sjf" />,
    );

    // Row layout: no ruler, flat row, fixed-size blocks
    expect(container.querySelectorAll('.queue-ruler-tick')).toHaveLength(0);
    const blocks = container.querySelectorAll('.queue-block');
    expect(blocks).toHaveLength(2);

    // All blocks have the same fixed width
    const widths = Array.from(blocks).map(b => (b as HTMLElement).style.width);
    expect(new Set(widths).size).toBe(1);
  });

  it('uses row layout automatically for rr accent (ready queue)', () => {
    const slices: QueueSlice[] = [{ processId: 'P1', start: 0, end: 0 }];
    const { container } = render(
      <QueueSection title="Cola — RR" slices={slices} colorMap={new Map([['P1', 'var(--series-1)']])} accent="rr" />,
    );

    expect(container.querySelector('.queue-block')).toBeTruthy();
    expect(container.querySelectorAll('.queue-ruler-tick')).toHaveLength(0);
  });

  it('uses timeline layout for io accent with ruler and proportional widths', () => {
    const slices: QueueSlice[] = [
      { processId: 'A', start: 0, end: 2 },
      { processId: 'B', start: 2, end: 10 },
    ];
    const { container } = render(
      <QueueSection title="Cola — I/O" slices={slices} colorMap={new Map([['A', 'var(--series-1)'], ['B', 'var(--series-2)']])} accent="io" />,
    );

    // Timeline layout: has ruler, proportional pills
    expect(container.querySelectorAll('.queue-ruler-tick').length).toBeGreaterThan(0);
    const pills = container.querySelectorAll('.queue-pill');
    expect(pills).toHaveLength(2);

    const widths = Array.from(pills).map(p => parseFloat(p.getAttribute('data-width') || '0'));
    expect(widths[0] / widths[1]).toBeCloseTo(2 / 8, 10);
  });

  it('uses timeline layout for cpu accent with possible multiple tracks', () => {
    const slices: QueueSlice[] = [
      { processId: 'A', start: 0, end: 5 },
      { processId: 'B', start: 1, end: 4 },
    ];
    const { container } = render(
      <QueueSection title="Cola — CPU" slices={slices} colorMap={new Map([['A', 'var(--series-1)'], ['B', 'var(--series-2)']])} accent="cpu" />,
    );

    const tracks = new Set(
      Array.from(container.querySelectorAll('[data-slice]')).map(el => el.getAttribute('data-track')),
    );
    expect(tracks.size).toBe(2);
  });

  it('renders without throwing for an empty slices array', () => {
    let container!: HTMLElement;
    let getByText!: (text: string) => HTMLElement;
    expect(() => {
      ({ container, getByText } = render(<QueueSection title="Cola — SJF" slices={[]} colorMap={new Map()} accent="sjf" />));
    }).not.toThrow();

    expect(getByText('Cola — SJF')).toBeTruthy();
    expect(container.querySelectorAll('[data-slice]')).toHaveLength(0);
  });

  it('picks a readably-contrasting text color for both a light and a dark slice background', () => {
    const slices: QueueSlice[] = [
      { processId: 'Y', start: 0, end: 0 }, // yellow, light
      { processId: 'V', start: 1, end: 5 },   // violet, dark
    ];
    const colorMap = new Map([['Y', '#eda100'], ['V', '#4a3aa7']]);
    const { container } = render(<QueueSection title="Cola — SJF" slices={slices} colorMap={colorMap} accent="sjf" />);

    const blocks = container.querySelectorAll('[data-slice]');
    expect(blocks[0].getAttribute('data-text-color')).toBe('dark');
    expect(blocks[1].getAttribute('data-text-color')).toBe('light');
  });

  it.each([
    ['sjf', 'accent-sjf'],
    ['rr', 'accent-rr'],
    ['io', 'accent-io'],
    ['cpu', 'accent-cpu'],
  ] as const)('applies the %s accent class for accent="%s"', (accent, className) => {
    const { container } = render(
      <QueueSection title="Cola — X" slices={[]} colorMap={new Map()} accent={accent} />,
    );
    expect(container.querySelector(`.queue-section.${className}`)).toBeTruthy();
  });
});
