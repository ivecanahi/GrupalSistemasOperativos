import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AverageTimeCards } from './AverageTimeCards';
import type { ProcessResult } from '../types/scheduling';

afterEach(cleanup);

const PROCESS_RESULTS: ProcessResult[] = [
  { processId: 'P1', arrivalTime: 1, startTime: 11, finishTime: 21, waitingTime: 10, turnaroundTime: 100 },
  { processId: 'P2', arrivalTime: 2, startTime: 12, finishTime: 22, waitingTime: 20, turnaroundTime: 200 },
  { processId: 'P3', arrivalTime: 3, startTime: 13, finishTime: 23, waitingTime: 60, turnaroundTime: 600 },
];

const AVERAGE_WAITING_TIME = (10 + 20 + 60) / 3;
const AVERAGE_TURNAROUND_TIME = (100 + 200 + 600) / 3;

describe('AverageTimeCards', () => {
  // Preserves the intent of the retired StatsPanel task 5.1: averages
  // render exactly as passed in, now split across two large cards.
  it('renders averageWaitingTime and averageTurnaroundTime as passed in [5.1]', () => {
    render(
      <AverageTimeCards
        processResults={PROCESS_RESULTS}
        averageWaitingTime={AVERAGE_WAITING_TIME}
        averageTurnaroundTime={AVERAGE_TURNAROUND_TIME}
      />,
    );

    expect(screen.getByText(String(AVERAGE_WAITING_TIME))).toBeTruthy();
    expect(screen.getByText(String(AVERAGE_TURNAROUND_TIME))).toBeTruthy();
  });

  it('renders the "Tiempo de espera promedio" card with the sum-of-waiting-times formula breakdown', () => {
    const { container } = render(
      <AverageTimeCards
        processResults={PROCESS_RESULTS}
        averageWaitingTime={AVERAGE_WAITING_TIME}
        averageTurnaroundTime={AVERAGE_TURNAROUND_TIME}
      />,
    );

    expect(screen.getByText('Tiempo de espera promedio')).toBeTruthy();
    expect(screen.getByText('(10 + 20 + 60) / 3')).toBeTruthy();
    expect(container.querySelector('.avg-time-card-lg.accent-sjf')).toBeTruthy();
  });

  it('renders the "Tiempo de ejecución medio" card with the sum-of-turnaround-times formula breakdown', () => {
    const { container } = render(
      <AverageTimeCards
        processResults={PROCESS_RESULTS}
        averageWaitingTime={AVERAGE_WAITING_TIME}
        averageTurnaroundTime={AVERAGE_TURNAROUND_TIME}
      />,
    );

    expect(screen.getByText('Tiempo de ejecución medio')).toBeTruthy();
    expect(screen.getByText('(100 + 200 + 600) / 3')).toBeTruthy();
    expect(container.querySelector('.avg-time-card-lg.accent-rr')).toBeTruthy();
  });
});
