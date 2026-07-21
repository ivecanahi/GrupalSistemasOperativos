import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within, fireEvent } from '@testing-library/react';
import { ProcessTable } from './ProcessTable';
import type { ProcessInput } from '../types/scheduling';

afterEach(cleanup);

function ControlledProcessTable({ initial }: { initial: ProcessInput[] }) {
  const [processes, setProcesses] = useState<ProcessInput[]>(initial);
  return <ProcessTable processes={processes} onChange={setProcesses} />;
}

function fillAddForm(values: { id?: string; name?: string; arrivalTime?: string; burstTime?: string }) {
  if (values.id !== undefined) fireEvent.change(screen.getByLabelText('Nuevo id'), { target: { value: values.id } });
  if (values.name !== undefined) fireEvent.change(screen.getByLabelText('Nuevo nombre'), { target: { value: values.name } });
  if (values.arrivalTime !== undefined) {
    fireEvent.change(screen.getByLabelText('Nueva llegada'), { target: { value: values.arrivalTime } });
  }
  if (values.burstTime !== undefined) {
    fireEvent.change(screen.getByLabelText('Nueva ráfaga'), { target: { value: values.burstTime } });
  }
}

describe('ProcessTable', () => {
  // =========================================================
  // Task 4.1: Add a valid row
  // =========================================================
  it('adds a valid row and shows it in the table [4.1]', () => {
    render(<ControlledProcessTable initial={[]} />);

    fillAddForm({ id: 'P1', name: 'Compile', arrivalTime: '2', burstTime: '5' });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    const dataRow = screen.getAllByRole('row')[1];
    expect(within(dataRow).getByText('P1')).toBeTruthy();
    expect(within(dataRow).getByText('Compile')).toBeTruthy();
    expect(within(dataRow).getByText('2')).toBeTruthy();
    expect(within(dataRow).getByText('5')).toBeTruthy();
  });

  // =========================================================
  // Task 4.2: Edit existing row's burstTime
  // =========================================================
  it("updates an existing row's burstTime to a new valid value [4.2]", () => {
    const initial: ProcessInput[] = [{ id: 'P1', name: 'Compile', arrivalTime: 1, burstTime: 3 }];
    render(<ControlledProcessTable initial={initial} />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Editar ráfaga'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    const dataRow = screen.getAllByRole('row')[1];
    expect(within(dataRow).getByText('7')).toBeTruthy();
    expect(within(dataRow).queryByText('3')).toBeNull();
  });

  // =========================================================
  // Task 4.3: Delete a row
  // =========================================================
  it('removes a row from the table and from the onChange output [4.3]', () => {
    const initial: ProcessInput[] = [
      { id: 'P1', name: 'Compile', arrivalTime: 1, burstTime: 3 },
      { id: 'P2', name: 'Render', arrivalTime: 2, burstTime: 4 },
    ];
    const handleChange = vi.fn();

    function Wrapper() {
      const [processes, setProcesses] = useState<ProcessInput[]>(initial);
      return (
        <ProcessTable
          processes={processes}
          onChange={updated => {
            handleChange(updated);
            setProcesses(updated);
          }}
        />
      );
    }

    render(<Wrapper />);

    const firstRow = screen.getAllByRole('row')[1];
    fireEvent.click(within(firstRow).getByRole('button', { name: 'Eliminar' }));

    expect(handleChange).toHaveBeenCalledWith([initial[1]]);
    expect(screen.queryByText('Compile')).toBeNull();
    expect(screen.getByText('Render')).toBeTruthy();
  });

  // =========================================================
  // Task 4.4: Reject non-positive arrivalTime
  // =========================================================
  it('accepts arrivalTime = 0 and rejects negative with a validation error [4.4]', () => {
    const handleChange = vi.fn();
    render(<ProcessTable processes={[]} onChange={handleChange} />);

    // arrivalTime = 0 is valid
    fillAddForm({ id: 'P1', name: 'Compile', arrivalTime: '0', burstTime: '5' });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(handleChange).toHaveBeenCalledTimes(1);

    // Negative arrivalTime is rejected
    fillAddForm({ id: 'P2', name: 'Invalid', arrivalTime: '-3', burstTime: '5' });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(screen.getByRole('alert').textContent).toMatch(/arrivalTime/i);
    expect(handleChange).toHaveBeenCalledTimes(1); // still 1, second add rejected
  });

  // =========================================================
  // Task 4.5: Reject non-numeric burstTime
  // =========================================================
  it('rejects non-numeric burstTime with a validation error and does not add the row [4.5]', () => {
    const handleChange = vi.fn();
    render(<ProcessTable processes={[]} onChange={handleChange} />);

    fillAddForm({ id: 'P1', name: 'Compile', arrivalTime: '1', burstTime: 'abc' });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(screen.getByRole('alert').textContent).toMatch(/burstTime/i);
    expect(handleChange).not.toHaveBeenCalled();
  });

  // =========================================================
  // Task 4.6: Reject empty id or name
  // =========================================================
  it('rejects an empty id with a validation error and does not add the row [4.6]', () => {
    const handleChange = vi.fn();
    render(<ProcessTable processes={[]} onChange={handleChange} />);

    fillAddForm({ name: 'Compile', arrivalTime: '1', burstTime: '5' });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(screen.getByRole('alert').textContent).toMatch(/id/i);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('rejects an empty name with a validation error and does not add the row [4.6]', () => {
    const handleChange = vi.fn();
    render(<ProcessTable processes={[]} onChange={handleChange} />);

    fillAddForm({ id: 'P1', arrivalTime: '1', burstTime: '5' });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(screen.getByRole('alert').textContent).toMatch(/nombre/i);
    expect(handleChange).not.toHaveBeenCalled();
  });

  // =========================================================
  // Regression: editing one row must not corrupt a different
  // row when another row is deleted first (id-based identity,
  // not array-index-based)
  // =========================================================
  it('saving an edit after deleting a different row updates the correct process, not a shifted one', () => {
    const initial: ProcessInput[] = [
      { id: 'P1', name: 'Compile', arrivalTime: 1, burstTime: 3 },
      { id: 'P2', name: 'Render', arrivalTime: 2, burstTime: 4 },
      { id: 'P3', name: 'Link', arrivalTime: 3, burstTime: 5 },
    ];
    const handleChange = vi.fn();

    function Wrapper() {
      const [processes, setProcesses] = useState<ProcessInput[]>(initial);
      return (
        <ProcessTable
          processes={processes}
          onChange={updated => {
            handleChange(updated);
            setProcesses(updated);
          }}
        />
      );
    }

    render(<Wrapper />);

    const rowsBeforeEdit = screen.getAllByRole('row');
    fireEvent.click(within(rowsBeforeEdit[2]).getByRole('button', { name: 'Editar' }));

    fireEvent.click(within(screen.getAllByRole('row')[1]).getByRole('button', { name: 'Eliminar' }));

    fireEvent.change(screen.getByLabelText('Editar ráfaga'), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    const finalProcesses = handleChange.mock.calls[handleChange.mock.calls.length - 1][0] as ProcessInput[];
    expect(finalProcesses).toEqual([
      { id: 'P2', name: 'Render', arrivalTime: 2, burstTime: 99 },
      { id: 'P3', name: 'Link', arrivalTime: 3, burstTime: 5 },
    ]);
  });

  it('rejects adding a process whose id already exists', () => {
    const initial: ProcessInput[] = [{ id: 'P1', name: 'Compile', arrivalTime: 1, burstTime: 3 }];
    const handleChange = vi.fn();
    render(<ProcessTable processes={initial} onChange={handleChange} />);

    fillAddForm({ id: 'P1', name: 'Duplicate', arrivalTime: '1', burstTime: '5' });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(screen.getByRole('alert').textContent).toMatch(/id/i);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('rejects non-finite values like "Infinity" for arrivalTime/burstTime', () => {
    const handleChange = vi.fn();
    render(<ProcessTable processes={[]} onChange={handleChange} />);

    fillAddForm({ id: 'P1', name: 'Compile', arrivalTime: 'Infinity', burstTime: '5' });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(screen.getByRole('alert').textContent).toMatch(/arrivalTime/i);
    expect(handleChange).not.toHaveBeenCalled();
  });
});
