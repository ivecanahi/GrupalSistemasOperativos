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

  it('renders a numbered ruler', () => {
    const slices: QueueSlice[] = [{ processId: 'A', start: 0, end: 5 }];
    const { container } = render(
      <QueueSection title="Cola — SJF" slices={slices} colorMap={new Map([['A', 'var(--series-1)']])} accent="sjf" />,
    );
    expect(container.querySelectorAll('.queue-ruler-tick').length).toBeGreaterThan(0);
  });

  it('renders one pill per slice with correct proportional width', () => {
    const slices: QueueSlice[] = [
      { processId: 'A', start: 0, end: 2 },
      { processId: 'B', start: 2, end: 10 },
    ];
    const colorMap = new Map([['A', 'var(--series-1)'], ['B', 'var(--series-2)']]);
    const { container } = render(<QueueSection title="Cola — SJF" slices={slices} colorMap={colorMap} accent="sjf" />);

    const pills = container.querySelectorAll('[data-slice]');
    expect(pills).toHaveLength(2);
    const widths = Array.from(pills).map(p => parseFloat(p.getAttribute('data-width') || '0'));
    expect(widths[0] / widths[1]).toBeCloseTo(2 / 8, 10);
  });

  it('packs overlapping slices into multiple tracks', () => {
    const slices: QueueSlice[] = [
      { processId: 'A', start: 0, end: 5 },
      { processId: 'B', start: 1, end: 4 },
    ];
    const colorMap = new Map([['A', 'var(--series-1)'], ['B', 'var(--series-2)']]);
    const { container } = render(<QueueSection title="Cola — SJF" slices={slices} colorMap={colorMap} accent="sjf" />);

    const tracks = new Set(
      Array.from(container.querySelectorAll('[data-slice]')).map(el => el.getAttribute('data-track')),
    );
    expect(tracks.size).toBe(2);
  });

  it('renders the ruler/title with no pills for an empty slices array without throwing', () => {
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
      { processId: 'Y', start: 0, end: 2 }, // yellow, light
      { processId: 'V', start: 2, end: 4 }, // violet, dark
    ];
    const colorMap = new Map([['Y', '#eda100'], ['V', '#4a3aa7']]);
    const { container } = render(<QueueSection title="Cola — SJF" slices={slices} colorMap={colorMap} accent="sjf" />);

    const pills = container.querySelectorAll('[data-slice]');
    expect(pills[0].getAttribute('data-text-color')).toBe('dark');
    expect(pills[1].getAttribute('data-text-color')).toBe('light');
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
