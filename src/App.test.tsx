import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import App from './App';
import { schedule } from './core';
import type { ProcessInput, SchedulerConfig } from './types/scheduling';

afterEach(cleanup);

// Same two processes are used across scenarios: P1 is the long job, P2 is
// the short job that arrives shortly after. Under RR quantum=4 P1 gets
// preempted (finishing later than under SJF), which is what lets the
// assertions below prove quantum/algorithm actually reached the engine
// (rather than just re-rendering with stale/default config).
const PROCESSES: ProcessInput[] = [
  { id: 'P1', name: 'P1', arrivalTime: 0, burstTime: 10 },
  { id: 'P2', name: 'P2', arrivalTime: 1, burstTime: 3 },
];

function addProcess(id: string, arrivalTime: string, burstTime: string) {
  fireEvent.change(screen.getByLabelText('Nuevo proceso'), { target: { value: id } });
  fireEvent.change(screen.getByLabelText('Nueva llegada'), { target: { value: arrivalTime } });
  fireEvent.change(screen.getByLabelText('Nueva ráfaga'), { target: { value: burstTime } });
  fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
}

function addBothProcesses() {
  addProcess('P1', '0', '10');
  addProcess('P2', '1', '3');
}

function expectedFinishTime(config: SchedulerConfig, processId: string): number {
  const result = schedule(PROCESSES, config);
  const processResult = result.processResults.find(p => p.processId === processId);
  if (!processResult) throw new Error(`No result for ${processId} — fixture/engine mismatch`);
  return processResult.finishTime;
}

// Stats table columns are: Proceso, Llegada, Entrada, Salida, Espera, Retorno.
const FINISH_TIME_COLUMN_INDEX = 3;

function getStatsFinishTime(statsSection: HTMLElement, processId: string): string {
  const rows = within(statsSection).getAllByRole('row');
  const row = rows.find(r => within(r).queryByText(processId) !== null);
  if (!row) throw new Error(`No stats row found for ${processId}`);
  const cells = within(row).getAllByRole('cell');
  return cells[FINISH_TIME_COLUMN_INDEX].textContent ?? '';
}

describe('App', () => {
  // =========================================================
  // Task 5.6: selecting RR with quantum = 4 and clicking Run
  // invokes the engine with quantum = 4; Gantt/stats reflect it
  // =========================================================
  it('runs RR with quantum = 4 and reflects that result in the stats panel [5.6]', () => {
    render(<App />);

    addBothProcesses();

    fireEvent.change(screen.getByLabelText('Algoritmo:'), { target: { value: 'RR' } });
    fireEvent.change(screen.getByLabelText('Quantum:'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar' }));

    const expectedRrFinish = expectedFinishTime({ algorithm: 'RR', quantum: 4 }, 'P1');
    // Sanity check on the fixture: RR quantum=4 must actually preempt P1
    // (i.e. differ from the non-preemptive SJF finish time) or this test
    // would prove nothing about quantum reaching the engine.
    const sjfFinish = expectedFinishTime({ algorithm: 'SJF' }, 'P1');
    expect(expectedRrFinish).not.toBe(sjfFinish);

    const statsSection = screen.getByText('4. Resumen del ejercicio').closest('section')!;
    expect(within(statsSection).getByText('P1')).toBeTruthy();
    expect(getStatsFinishTime(statsSection, 'P1')).toBe(String(expectedRrFinish));
  });

  // =========================================================
  // Task 5.7: switching from a completed RR run to SJF and
  // running again replaces (not merges) prior results
  // =========================================================
  it('switching from RR to SJF and running again replaces the previous result, not merges it [5.7]', () => {
    render(<App />);

    addBothProcesses();

    fireEvent.change(screen.getByLabelText('Algoritmo:'), { target: { value: 'RR' } });
    fireEvent.change(screen.getByLabelText('Quantum:'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar' }));

    const rrFinish = expectedFinishTime({ algorithm: 'RR', quantum: 4 }, 'P1');

    fireEvent.change(screen.getByLabelText('Algoritmo:'), { target: { value: 'SJF' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar' }));

    const sjfFinish = expectedFinishTime({ algorithm: 'SJF' }, 'P1');
    expect(sjfFinish).not.toBe(rrFinish);

    const statsSection = screen.getByText('4. Resumen del ejercicio').closest('section')!;
    // Only one stats table/section should exist after re-running — no
    // duplicated Gantt/stats blocks left over from the previous run.
    expect(screen.getAllByText('4. Resumen del ejercicio')).toHaveLength(1);
    expect(within(statsSection).getAllByText('P1')).toHaveLength(1);
    expect(getStatsFinishTime(statsSection, 'P1')).toBe(String(sjfFinish));
    expect(getStatsFinishTime(statsSection, 'P1')).not.toBe(String(rrFinish));
  });

  // =========================================================
  // MLQ mode: shows quantum + priority-queue selector, runs runMLQ
  // =========================================================
  it('selecting MLQ shows both the quantum input and the priority-queue selector, and reflects the MLQ result', () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText('Nuevo proceso'), { target: { value: 'P1' } });
    fireEvent.change(screen.getByLabelText('Nueva llegada'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Nueva ráfaga'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    fireEvent.change(screen.getByLabelText('Nuevo proceso'), { target: { value: 'P2' } });
    fireEvent.change(screen.getByLabelText('Nueva llegada'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Nueva ráfaga'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Nueva cola'), { target: { value: 'RR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    fireEvent.change(screen.getByLabelText('Algoritmo:'), { target: { value: 'MLQ' } });

    expect(screen.getByLabelText('Quantum:')).toBeTruthy();
    expect(screen.getByLabelText('Cola con prioridad:')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Quantum:'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar' }));

    const mlqProcesses: ProcessInput[] = [
      { id: 'P1', name: 'P1', arrivalTime: 0, burstTime: 10, queue: 'SJF' },
      { id: 'P2', name: 'P2', arrivalTime: 1, burstTime: 3, queue: 'RR' },
    ];
    const expectedResult = schedule(mlqProcesses, { algorithm: 'MLQ', quantum: 4, priorityQueue: 'SJF' });
    const expectedFinish = expectedResult.processResults.find(r => r.processId === 'P1')!.finishTime;

    const statsSection = screen.getByText('4. Resumen del ejercicio').closest('section')!;
    expect(getStatsFinishTime(statsSection, 'P1')).toBe(String(expectedFinish));
  });
});
