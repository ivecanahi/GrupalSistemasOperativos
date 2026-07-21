import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GanttChart } from './GanttChart';
import type { ExecutionSlice } from '../types/scheduling';

describe('GanttChart', () => {
  // =========================================================
  // Task 3.1: Slices proportional to duration
  // =========================================================
  it('should render slices with widths proportional to 2:5:3 [3.1]', () => {
    const timeline: ExecutionSlice[] = [
      { processId: 'A', start: 0, end: 2 },
      { processId: 'B', start: 2, end: 7 },
      { processId: 'C', start: 7, end: 10 },
    ];

    const { container } = render(<GanttChart timeline={timeline} />);

    const slices = container.querySelectorAll('[data-slice]');
    expect(slices).toHaveLength(3);

    const widths: number[] = [];
    slices.forEach(el => {
      const w = parseFloat(el.getAttribute('data-width') || '0');
      widths.push(w);
    });

    // Check ratio 2:5:3
    expect(widths[0] / widths[1]).toBeCloseTo(2 / 5, 10);
    expect(widths[1] / widths[2]).toBeCloseTo(5 / 3, 10);
  });

  // =========================================================
  // Task 3.2: Same process keeps same color across slices
  // =========================================================
  it('should assign consistent color to same processId across non-contiguous slices [3.2]', () => {
    const timeline: ExecutionSlice[] = [
      { processId: 'A', start: 0, end: 3 },
      { processId: 'B', start: 3, end: 5 },
      { processId: 'A', start: 5, end: 8 },
    ];

    const { container } = render(<GanttChart timeline={timeline} />);

    const slices = container.querySelectorAll('[data-slice]');
    expect(slices).toHaveLength(3);

    const colorA = slices[0].getAttribute('data-color');
    const colorB = slices[1].getAttribute('data-color');
    const colorA2 = slices[2].getAttribute('data-color');

    // Both A slices have the same color
    expect(colorA).toBe(colorA2);
    // A and B have different colors
    expect(colorA).not.toBe(colorB);
  });

  // =========================================================
  // Task 3.3: Idle gap before first arrival
  // =========================================================
  it('should render idle gap interval not covered by slices [3.3]', () => {
    const timeline: ExecutionSlice[] = [
      { processId: 'A', start: 3, end: 7 },
    ];

    const { container } = render(<GanttChart timeline={timeline} />);

    // There should be an idle segment covering [0, 3)
    const idleSegments = container.querySelectorAll('[data-idle]');
    expect(idleSegments.length).toBeGreaterThanOrEqual(1);

    // The only slice should start at 3
    const slices = container.querySelectorAll('[data-slice]');
    expect(slices).toHaveLength(1);
  });

  // =========================================================
  // Task 3.4: Empty timeline renders without error
  // =========================================================
  it('should render placeholder/empty state for empty timeline [3.4]', () => {
    const timeline: ExecutionSlice[] = [];

    expect(() => render(<GanttChart timeline={timeline} />)).not.toThrow();

    expect(screen.getByText(/no hay procesos/i)).toBeTruthy();
  });

  // =========================================================
  // Edge cases
  // =========================================================
  it('should render a single slice correctly', () => {
    const timeline: ExecutionSlice[] = [
      { processId: 'X', start: 1, end: 5 },
    ];

    const { container } = render(<GanttChart timeline={timeline} />);

    const slices = container.querySelectorAll('[data-slice]');
    expect(slices).toHaveLength(1);

    const idleSegments = container.querySelectorAll('[data-idle]');
    // Should have idle before [0,1) and after [5,...)
    // At minimum, the idle from 0 to 1
    expect(idleSegments.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle zero-duration slices gracefully', () => {
    const timeline: ExecutionSlice[] = [
      { processId: 'Z', start: 0, end: 0 },
    ];

    expect(() => render(<GanttChart timeline={timeline} />)).not.toThrow();
  });
});
