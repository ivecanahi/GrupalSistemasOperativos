import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { StatsPanel } from './StatsPanel';
import type { ProcessInput, ProcessResult } from '../types/scheduling';

afterEach(cleanup);

// Every numeric value below is unique across the whole fixture (within a
// row and across rows/averages) so `getByText`/`within(row).getByText`
// queries never match more than one element.
const PROCESS_RESULTS: ProcessResult[] = [
  { processId: 'P1', arrivalTime: 1, startTime: 11, finishTime: 21, waitingTime: 10, turnaroundTime: 100 },
  { processId: 'P2', arrivalTime: 2, startTime: 12, finishTime: 22, waitingTime: 20, turnaroundTime: 200 },
  { processId: 'P3', arrivalTime: 3, startTime: 13, finishTime: 23, waitingTime: 60, turnaroundTime: 600 },
];

const PROCESSES: ProcessInput[] = [
  { id: 'P1', name: 'P1', arrivalTime: 1, burstTime: 44 },
  { id: 'P2', name: 'P2', arrivalTime: 2, burstTime: 55 },
  { id: 'P3', name: 'P3', arrivalTime: 3, burstTime: 66 },
];

const AVERAGE_BURST_TIME = (44 + 55 + 66) / 3;
const MAKESPAN = 23; // max(finishTime) across PROCESS_RESULTS

describe('StatsPanel', () => {
  // =========================================================
  // Task 5.2: each process row shows arrivalTime, startTime,
  // finishTime, waitingTime, turnaroundTime
  // =========================================================
  it('shows arrivalTime, startTime, finishTime, waitingTime and turnaroundTime for every process [5.2]', () => {
    render(<StatsPanel processResults={PROCESS_RESULTS} processes={PROCESSES} algorithm="SJF" />);

    const rows = screen.getAllByRole('row');
    // rows[0] is the header row; one data row per process follows in order.
    PROCESS_RESULTS.forEach((result, index) => {
      const row = rows[index + 1];
      expect(within(row).getByText(result.processId)).toBeTruthy();
      expect(within(row).getByText(String(result.arrivalTime))).toBeTruthy();
      expect(within(row).getByText(String(result.startTime))).toBeTruthy();
      expect(within(row).getByText(String(result.finishTime))).toBeTruthy();
      expect(within(row).getByText(String(result.waitingTime))).toBeTruthy();
      expect(within(row).getByText(String(result.turnaroundTime))).toBeTruthy();
    });
  });

  // =========================================================
  // Section 4 restyle: auto-generated summary paragraph +
  // 4-tile metric grid (número de procesos, tiempo total de
  // simulación/makespan, ráfaga promedio, algoritmo)
  // =========================================================
  it('renders a summary paragraph mentioning process count and algorithm', () => {
    render(<StatsPanel processResults={PROCESS_RESULTS} processes={PROCESSES} algorithm="RR" />);

    expect(screen.getByText(/3 proceso/i)).toBeTruthy();
    expect(screen.getByText(/Round Robin/i)).toBeTruthy();
  });

  it('renders the 4-tile metric grid with número de procesos, makespan, ráfaga promedio and algoritmo', () => {
    const { container } = render(
      <StatsPanel processResults={PROCESS_RESULTS} processes={PROCESSES} algorithm="SJF" />,
    );

    const tiles = container.querySelectorAll('.metric-tile-sm');
    expect(tiles).toHaveLength(4);

    expect(screen.getByText('Número de procesos').nextSibling?.textContent).toBe('3');
    expect(screen.getByText('Tiempo total de simulación').nextSibling?.textContent).toBe(String(MAKESPAN));
    expect(screen.getByText('Ráfaga de CPU promedio').nextSibling?.textContent).toBe(String(AVERAGE_BURST_TIME));
    expect(screen.getByText('Algoritmo').nextSibling?.textContent).toBe('SJF');
  });
});
