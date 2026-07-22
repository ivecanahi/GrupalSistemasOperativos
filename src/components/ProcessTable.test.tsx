import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within, fireEvent } from '@testing-library/react';
import { ProcessTable } from './ProcessTable';
import type { ProcessInput } from '../types/scheduling';

afterEach(cleanup);

function ControlledProcessTable({ initial }: { initial: ProcessInput[] }) {
  const [processes, setProcesses] = useState<ProcessInput[]>(initial);
  return <ProcessTable processes={processes} onChange={setProcesses} colorMap={new Map()} />;
}

function fillAddForm(values: { id?: string; arrivalTime?: string; burstTime?: string }) {
  if (values.id !== undefined) fireEvent.change(screen.getByLabelText('Nuevo proceso'), { target: { value: values.id } });
  if (values.arrivalTime !== undefined) {
    fireEvent.change(screen.getByLabelText('Nueva llegada'), { target: { value: values.arrivalTime } });
  }
  if (values.burstTime !== undefined) {
    fireEvent.change(screen.getByLabelText('Nueva ráfaga'), { target: { value: values.burstTime } });
  }
}

/** Clicks "+ Agregar E/S" in the given container, then fills the newly-added row's fields by its 1-based index. */
function addIoOpRow(container: HTMLElement, labelPrefix: string, n: number, after?: string, duration?: string) {
  fireEvent.click(within(container).getByRole('button', { name: '+ Agregar E/S' }));
  if (after !== undefined) {
    fireEvent.change(screen.getByLabelText(`${labelPrefix}Tras (ms) ${n}`), { target: { value: after } });
  }
  if (duration !== undefined) {
    fireEvent.change(screen.getByLabelText(`${labelPrefix}Duración (ms) ${n}`), { target: { value: duration } });
  }
}

describe('ProcessTable', () => {
  // =========================================================
  // Task 4.1: Add a valid row
  // =========================================================
  it('adds a valid row and shows it in the table [4.1]', () => {
    render(<ControlledProcessTable initial={[]} />);

    fillAddForm({ id: 'P1', arrivalTime: '2', burstTime: '5' });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    const dataRow = screen.getAllByRole('row')[1];
    expect(within(dataRow).getByText('P1')).toBeTruthy();
    expect(within(dataRow).getByText('2')).toBeTruthy();
    expect(within(dataRow).getByText('5')).toBeTruthy();
  });

  // =========================================================
  // Task 4.2: Edit existing row's burstTime
  // =========================================================
  it("updates an existing row's burstTime to a new valid value [4.2]", () => {
    const initial: ProcessInput[] = [{ id: 'P1', name: 'P1', arrivalTime: 1, burstTime: 3 }];
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
      { id: 'P1', name: 'P1', arrivalTime: 1, burstTime: 3 },
      { id: 'P2', name: 'P2', arrivalTime: 2, burstTime: 4 },
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
          colorMap={new Map()}
        />
      );
    }

    render(<Wrapper />);

    const firstRow = screen.getAllByRole('row')[1];
    fireEvent.click(within(firstRow).getByRole('button', { name: 'Eliminar' }));

    expect(handleChange).toHaveBeenCalledWith([initial[1]]);
    expect(screen.queryByText('P1')).toBeNull();
    expect(screen.getByText('P2')).toBeTruthy();
  });

  // =========================================================
  // Task 4.4: Accept arrivalTime = 0, reject only negative
  // =========================================================
  it('accepts arrivalTime = 0 and rejects negative with a validation error [4.4]', () => {
    const handleChange = vi.fn();
    render(<ProcessTable processes={[]} onChange={handleChange} colorMap={new Map()} />);

    fillAddForm({ id: 'P1', arrivalTime: '0', burstTime: '5' });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(handleChange).toHaveBeenCalledTimes(1);

    fillAddForm({ id: 'P2', arrivalTime: '-3', burstTime: '5' });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(screen.getByRole('alert').textContent).toMatch(/llegada/i);
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  // =========================================================
  // Task 4.5: Reject non-numeric burstTime
  // =========================================================
  it('rejects non-numeric burstTime with a validation error and does not add the row [4.5]', () => {
    const handleChange = vi.fn();
    render(<ProcessTable processes={[]} onChange={handleChange} colorMap={new Map()} />);

    fillAddForm({ id: 'P1', arrivalTime: '1', burstTime: 'abc' });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(screen.getByRole('alert').textContent).toMatch(/ráfaga/i);
    expect(handleChange).not.toHaveBeenCalled();
  });

  // =========================================================
  // Task 4.6: Reject empty id (Proceso)
  // =========================================================
  it('rejects an empty process name/id with a validation error and does not add the row [4.6]', () => {
    const handleChange = vi.fn();
    render(<ProcessTable processes={[]} onChange={handleChange} colorMap={new Map()} />);

    fillAddForm({ arrivalTime: '1', burstTime: '5' });
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
      { id: 'P1', name: 'P1', arrivalTime: 1, burstTime: 3 },
      { id: 'P2', name: 'P2', arrivalTime: 2, burstTime: 4 },
      { id: 'P3', name: 'P3', arrivalTime: 3, burstTime: 5 },
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
          colorMap={new Map()}
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
      { id: 'P2', name: 'P2', arrivalTime: 2, burstTime: 99, queue: 'SJF' },
      { id: 'P3', name: 'P3', arrivalTime: 3, burstTime: 5 },
    ]);
  });

  it('rejects adding a process whose id already exists', () => {
    const initial: ProcessInput[] = [{ id: 'P1', name: 'P1', arrivalTime: 1, burstTime: 3 }];
    const handleChange = vi.fn();
    render(<ProcessTable processes={initial} onChange={handleChange} colorMap={new Map()} />);

    fillAddForm({ id: 'P1', arrivalTime: '1', burstTime: '5' });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(screen.getByRole('alert').textContent).toMatch(/ya existe/i);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('rejects non-finite values like "Infinity" for arrivalTime/burstTime', () => {
    const handleChange = vi.fn();
    render(<ProcessTable processes={[]} onChange={handleChange} colorMap={new Map()} />);

    fillAddForm({ id: 'P1', arrivalTime: 'Infinity', burstTime: '5' });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(screen.getByRole('alert').textContent).toMatch(/llegada/i);
    expect(handleChange).not.toHaveBeenCalled();
  });

  // =========================================================
  // Multi-op I/O list editor
  // =========================================================
  describe('multi-op I/O list editor', () => {
    it('adding 3 io operations to a process carries all of them through to onChange', () => {
      const handleChange = vi.fn();
      render(<ProcessTable processes={[]} onChange={handleChange} colorMap={new Map()} />);

      fillAddForm({ id: 'P1', arrivalTime: '0', burstTime: '10' });
      const addContainer = screen.getByTestId('add-io-ops');

      addIoOpRow(addContainer, '', 1, '2', '3');
      addIoOpRow(addContainer, '', 2, '5', '4');
      addIoOpRow(addContainer, '', 3, '8', '2');

      fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

      expect(handleChange).toHaveBeenCalledWith([
        {
          id: 'P1',
          name: 'P1',
          arrivalTime: 0,
          burstTime: 10,
          queue: 'SJF',
          ioOperations: [
            { after: 2, duration: 3 },
            { after: 5, duration: 4 },
            { after: 8, duration: 2 },
          ],
        },
      ]);
    });

    it('leaving the io operations list empty produces ioOperations undefined', () => {
      const handleChange = vi.fn();
      render(<ProcessTable processes={[]} onChange={handleChange} colorMap={new Map()} />);

      fillAddForm({ id: 'P1', arrivalTime: '1', burstTime: '5' });
      fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

      expect(handleChange).toHaveBeenCalledWith([
        { id: 'P1', name: 'P1', arrivalTime: 1, burstTime: 5, queue: 'SJF', ioOperations: undefined },
      ]);
    });

    it('rejects an io operation row with only "after" filled (duration blank), mentioning both fields are required', () => {
      const handleChange = vi.fn();
      render(<ProcessTable processes={[]} onChange={handleChange} colorMap={new Map()} />);

      fillAddForm({ id: 'P1', arrivalTime: '0', burstTime: '10' });
      const addContainer = screen.getByTestId('add-io-ops');
      addIoOpRow(addContainer, '', 1, '2', undefined);

      fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

      expect(screen.getByRole('alert').textContent).toMatch(/momento.*duración|duración.*momento/i);
      expect(handleChange).not.toHaveBeenCalled();
    });

    it('rejects an io operation row with only "duration" filled (after blank), mentioning both fields are required', () => {
      const handleChange = vi.fn();
      render(<ProcessTable processes={[]} onChange={handleChange} colorMap={new Map()} />);

      fillAddForm({ id: 'P1', arrivalTime: '0', burstTime: '10' });
      const addContainer = screen.getByTestId('add-io-ops');
      addIoOpRow(addContainer, '', 1, undefined, '3');

      fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

      expect(screen.getByRole('alert').textContent).toMatch(/momento.*duración|duración.*momento/i);
      expect(handleChange).not.toHaveBeenCalled();
    });

    it('rejects a non-numeric "after" value, mentioning the io moment', () => {
      const handleChange = vi.fn();
      render(<ProcessTable processes={[]} onChange={handleChange} colorMap={new Map()} />);

      fillAddForm({ id: 'P1', arrivalTime: '0', burstTime: '10' });
      const addContainer = screen.getByTestId('add-io-ops');
      addIoOpRow(addContainer, '', 1, 'abc', '3');

      fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

      expect(screen.getByRole('alert').textContent).toMatch(/momento/i);
      expect(handleChange).not.toHaveBeenCalled();
    });

    it('rejects an "after" value greater than burstTime, mentioning the io moment', () => {
      const handleChange = vi.fn();
      render(<ProcessTable processes={[]} onChange={handleChange} colorMap={new Map()} />);

      fillAddForm({ id: 'P1', arrivalTime: '0', burstTime: '5' });
      const addContainer = screen.getByTestId('add-io-ops');
      addIoOpRow(addContainer, '', 1, '9', '3');

      fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

      expect(screen.getByRole('alert').textContent).toMatch(/momento/i);
      expect(handleChange).not.toHaveBeenCalled();
    });

    it('rejects a non-numeric "duration" value, mentioning the io duration', () => {
      const handleChange = vi.fn();
      render(<ProcessTable processes={[]} onChange={handleChange} colorMap={new Map()} />);

      fillAddForm({ id: 'P1', arrivalTime: '0', burstTime: '10' });
      const addContainer = screen.getByTestId('add-io-ops');
      addIoOpRow(addContainer, '', 1, '2', 'xyz');

      fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

      expect(screen.getByRole('alert').textContent).toMatch(/duración/i);
      expect(handleChange).not.toHaveBeenCalled();
    });

    it('rejects two io operations sharing the same "after" value', () => {
      const handleChange = vi.fn();
      render(<ProcessTable processes={[]} onChange={handleChange} colorMap={new Map()} />);

      fillAddForm({ id: 'P1', arrivalTime: '0', burstTime: '10' });
      const addContainer = screen.getByTestId('add-io-ops');
      addIoOpRow(addContainer, '', 1, '2', '3');
      addIoOpRow(addContainer, '', 2, '2', '5');

      fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

      expect(screen.getByRole('alert').textContent).toMatch(/repetir/i);
      expect(handleChange).not.toHaveBeenCalled();
    });

    it('removing an io operation row via the "×" button before submit excludes it from onChange', () => {
      const handleChange = vi.fn();
      render(<ProcessTable processes={[]} onChange={handleChange} colorMap={new Map()} />);

      fillAddForm({ id: 'P1', arrivalTime: '0', burstTime: '10' });
      const addContainer = screen.getByTestId('add-io-ops');
      addIoOpRow(addContainer, '', 1, '2', '3');
      addIoOpRow(addContainer, '', 2, '5', '4');

      fireEvent.click(screen.getByLabelText('Eliminar operación de E/S 1'));
      fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

      expect(handleChange).toHaveBeenCalledWith([
        { id: 'P1', name: 'P1', arrivalTime: 0, burstTime: 10, queue: 'SJF', ioOperations: [{ after: 5, duration: 4 }] },
      ]);
    });

    it('displays a compact multi-op summary in the table for a process with io operations', () => {
      const initial: ProcessInput[] = [
        {
          id: 'P1',
          name: 'P1',
          arrivalTime: 0,
          burstTime: 10,
          ioOperations: [{ after: 2, duration: 3 }, { after: 5, duration: 4 }],
        },
      ];
      render(<ProcessTable processes={initial} onChange={vi.fn()} colorMap={new Map()} />);

      const dataRow = screen.getAllByRole('row')[1];
      expect(within(dataRow).getByText('2→3, 5→4')).toBeTruthy();
    });

    it('displays a dash summary for a process without any io operations', () => {
      const initial: ProcessInput[] = [{ id: 'P1', name: 'P1', arrivalTime: 0, burstTime: 10 }];
      render(<ProcessTable processes={initial} onChange={vi.fn()} colorMap={new Map()} />);

      const dataRow = screen.getAllByRole('row')[1];
      expect(within(dataRow).getByText('—')).toBeTruthy();
    });

    it('displays a single-op summary for a legacy process using ioBurstTime/ioTriggerAfter', () => {
      const initial: ProcessInput[] = [
        { id: 'P1', name: 'P1', arrivalTime: 0, burstTime: 10, ioBurstTime: 4, ioTriggerAfter: 3 },
      ];
      render(<ProcessTable processes={initial} onChange={vi.fn()} colorMap={new Map()} />);

      const dataRow = screen.getAllByRole('row')[1];
      expect(within(dataRow).getByText('3→4')).toBeTruthy();
    });

    it('editing a legacy process (ioBurstTime/ioTriggerAfter) pre-populates the io operations list with one row', () => {
      const initial: ProcessInput[] = [
        { id: 'P1', name: 'P1', arrivalTime: 0, burstTime: 10, ioBurstTime: 4, ioTriggerAfter: 3 },
      ];
      render(<ProcessTable processes={initial} onChange={vi.fn()} colorMap={new Map()} />);

      fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

      expect((screen.getByLabelText('Editar Tras (ms) 1') as HTMLInputElement).value).toBe('3');
      expect((screen.getByLabelText('Editar Duración (ms) 1') as HTMLInputElement).value).toBe('4');
    });
  });

  // =========================================================
  // Process color dot (swatch) — shared colorMap
  // =========================================================
  it('renders a colored swatch next to the process using the color from colorMap', () => {
    const initial: ProcessInput[] = [{ id: 'P1', name: 'P1', arrivalTime: 0, burstTime: 5 }];
    const colorMap = new Map([['P1', 'var(--series-3)']]);
    const { container } = render(<ProcessTable processes={initial} onChange={vi.fn()} colorMap={colorMap} />);

    const dot = container.querySelector('.process-color-dot');
    expect(dot).toBeTruthy();
    expect((dot as HTMLElement).style.background).toBe('var(--series-3)');
  });

  // =========================================================
  // MLQ queue assignment (Cola)
  // =========================================================
  describe('MLQ queue assignment', () => {
    it('defaults the queue selector to SJF when not touched', () => {
      const handleChange = vi.fn();
      render(<ProcessTable processes={[]} onChange={handleChange} colorMap={new Map()} />);

      fillAddForm({ id: 'P1', arrivalTime: '0', burstTime: '5' });
      fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

      expect(handleChange).toHaveBeenCalledWith([
        { id: 'P1', name: 'P1', arrivalTime: 0, burstTime: 5, queue: 'SJF', ioOperations: undefined },
      ]);
    });

    it('adding a process with queue="RR" carries it through to onChange', () => {
      const handleChange = vi.fn();
      render(<ProcessTable processes={[]} onChange={handleChange} colorMap={new Map()} />);

      fillAddForm({ id: 'P1', arrivalTime: '0', burstTime: '5' });
      fireEvent.change(screen.getByLabelText('Nueva cola'), { target: { value: 'RR' } });
      fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

      expect(handleChange).toHaveBeenCalledWith([
        { id: 'P1', name: 'P1', arrivalTime: 0, burstTime: 5, queue: 'RR', ioOperations: undefined },
      ]);
    });

    it("shows the process's current queue assignment in the table", () => {
      const initial: ProcessInput[] = [{ id: 'P1', name: 'P1', arrivalTime: 0, burstTime: 5, queue: 'RR' }];
      render(<ProcessTable processes={initial} onChange={vi.fn()} colorMap={new Map()} />);

      const dataRow = screen.getAllByRole('row')[1];
      expect(within(dataRow).getByText('RR')).toBeTruthy();
    });

    it('defaults the table display to SJF for a process with no explicit queue', () => {
      const initial: ProcessInput[] = [{ id: 'P1', name: 'P1', arrivalTime: 0, burstTime: 5 }];
      render(<ProcessTable processes={initial} onChange={vi.fn()} colorMap={new Map()} />);

      const dataRow = screen.getAllByRole('row')[1];
      expect(within(dataRow).getByText('SJF')).toBeTruthy();
    });

    it("editing an existing process's queue updates it via onChange", () => {
      const initial: ProcessInput[] = [{ id: 'P1', name: 'P1', arrivalTime: 1, burstTime: 3, queue: 'SJF' }];
      const handleChange = vi.fn();
      render(<ProcessTable processes={initial} onChange={handleChange} colorMap={new Map()} />);

      fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
      fireEvent.change(screen.getByLabelText('Editar cola'), { target: { value: 'RR' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(handleChange).toHaveBeenCalledWith([
        { id: 'P1', name: 'P1', arrivalTime: 1, burstTime: 3, queue: 'RR', ioOperations: undefined },
      ]);
    });
  });
});
