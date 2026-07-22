import * as XLSX from 'xlsx';
import { describe, expect, it, vi } from 'vitest';
import { readProcessesFromXlsx, writeProcessesToXlsx } from './xlsxIO';

vi.mock('xlsx', async () => {
  const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

  return { ...actual, writeFile: vi.fn() };
});

const REQUIRED_COLUMNS = ['id', 'name', 'arrivalTime', 'burstTime'];
const WRITE_COLUMNS = ['id', 'name', 'arrivalTime', 'burstTime', 'ioOperations', 'queue'];
const LEGACY_ALL_COLUMNS = ['id', 'name', 'arrivalTime', 'burstTime', 'ioBurstTime', 'ioTriggerAfter'];

function createWorkbookFile(rows: Record<string, unknown>[], filename = 'processes.xlsx'): File {
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: REQUIRED_COLUMNS });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Processes');
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

  return new File([bytes], filename, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('readProcessesFromXlsx', () => {
  it('rejects a non-xlsx file before importing rows', async () => {
    const file = createWorkbookFile(
      [{ id: 'P1', name: 'Compile', arrivalTime: 1, burstTime: 3 }],
      'processes.csv',
    );

    await expect(readProcessesFromXlsx(file)).rejects.toThrow(/solo se pueden importar archivos \.xlsx/i);
  });

  it('imports every valid row as ProcessInput values', async () => {
    const file = createWorkbookFile([
      { id: 'P1', name: 'Compile', arrivalTime: 1, burstTime: 3 },
      { id: 'P2', name: 'Render', arrivalTime: 4, burstTime: 2 },
    ]);

    await expect(readProcessesFromXlsx(file)).resolves.toEqual([
      { id: 'P1', name: 'Compile', arrivalTime: 1, burstTime: 3 },
      { id: 'P2', name: 'Render', arrivalTime: 4, burstTime: 2 },
    ]);
  });

  it('rejects a workbook missing a required column', async () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['id', 'name', 'arrivalTime'],
      ['P1', 'Compile', 1],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Processes');
    const file = new File([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], 'processes.xlsx');

    await expect(readProcessesFromXlsx(file)).rejects.toThrow(/columna requerida "burstTime"/i);
  });

  it('rejects the entire file when an id is empty', async () => {
    const file = createWorkbookFile([{ id: '', name: 'Compile', arrivalTime: 1, burstTime: 3 }]);

    await expect(readProcessesFromXlsx(file)).rejects.toThrow(/fila 2.*vacío.*"id"/i);
  });

  it('rejects the entire file when one row is missing burstTime', async () => {
    const file = createWorkbookFile([
      { id: 'P1', name: 'Compile', arrivalTime: 1, burstTime: 3 },
      { id: 'P2', name: 'Render', arrivalTime: 4 },
    ]);

    await expect(readProcessesFromXlsx(file)).rejects.toThrow(/fila 3.*burstTime/i);
  });

  it('rejects the entire file when arrivalTime is not numeric', async () => {
    const file = createWorkbookFile([{ id: 'P1', name: 'Compile', arrivalTime: 'abc', burstTime: 3 }]);

    await expect(readProcessesFromXlsx(file)).rejects.toThrow(/fila 2.*arrivalTime/i);
  });

  it('rejects all ten valid rows when an eleventh row has a bad burstTime type', async () => {
    const validRows = Array.from({ length: 10 }, (_, index) => ({
      id: `P${index + 1}`,
      name: `Process ${index + 1}`,
      arrivalTime: index,
      burstTime: index + 1,
    }));
    const file = createWorkbookFile([...validRows, { id: 'P11', name: 'Invalid', arrivalTime: 10, burstTime: 'bad' }]);

    await expect(readProcessesFromXlsx(file)).rejects.toThrow(/fila 12.*burstTime/i);
  });
});

describe('writeProcessesToXlsx', () => {
  it('writes an xlsx workbook with only ProcessInput columns', () => {
    const writeFile = vi.mocked(XLSX.writeFile);
    writeFile.mockClear();

    writeProcessesToXlsx([{ id: 'P1', name: 'Compile', arrivalTime: 1, burstTime: 3 }], 'processes');

    expect(writeFile).toHaveBeenCalledOnce();
    const [workbook, filename] = writeFile.mock.calls[0];
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    expect(filename).toBe('processes.xlsx');
    expect(XLSX.utils.sheet_to_json(worksheet, { header: 1 })).toEqual([
      WRITE_COLUMNS,
      ['P1', 'Compile', 1, 3, undefined, 'SJF'],
    ]);
  });

  it('serializes ioOperations (or legacy ioBurstTime/ioTriggerAfter) into the unified ioOperations column', () => {
    const writeFile = vi.mocked(XLSX.writeFile);
    writeFile.mockClear();

    writeProcessesToXlsx(
      [
        {
          id: 'P1',
          name: 'Compile',
          arrivalTime: 1,
          burstTime: 10,
          ioOperations: [{ after: 2, duration: 3 }, { after: 5, duration: 4 }],
        },
        { id: 'P2', name: 'Render', arrivalTime: 0, burstTime: 6, ioBurstTime: 4, ioTriggerAfter: 2 },
      ],
      'processes',
    );

    const [workbook] = writeFile.mock.calls[0];
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    expect(XLSX.utils.sheet_to_json(worksheet, { header: 1 })).toEqual([
      WRITE_COLUMNS,
      ['P1', 'Compile', 1, 10, '2:3,5:4', 'SJF'],
      ['P2', 'Render', 0, 6, '2:4', 'SJF'],
    ]);
  });
});

describe('round-trip export + import', () => {
  it('preserves 3 io operations across write then read', async () => {
    const processes = [
      {
        id: 'P1',
        name: 'Compile',
        arrivalTime: 1,
        burstTime: 12,
        ioOperations: [
          { after: 2, duration: 3 },
          { after: 6, duration: 2 },
          { after: 9, duration: 1 },
        ],
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(
      [{ ...processes[0], ioOperations: '2:3,6:2,9:1' }],
      { header: [...WRITE_COLUMNS] },
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Processes');
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const file = new File([bytes], 'processes.xlsx');

    await expect(readProcessesFromXlsx(file)).resolves.toEqual(processes);
  });

  it('rejects the entire file when the ioOperations cell has malformed after:duration syntax', async () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      WRITE_COLUMNS,
      ['P1', 'Compile', 1, 6, 'not-valid-syntax'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Processes');
    const file = new File([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], 'processes.xlsx');

    await expect(readProcessesFromXlsx(file)).rejects.toThrow(/fila 2.*formato de E\/S inválido/i);
  });

  it('still imports correctly from a file using the OLD flat ioBurstTime/ioTriggerAfter columns', async () => {
    const worksheet = XLSX.utils.json_to_sheet(
      [{ id: 'P1', name: 'Compile', arrivalTime: 1, burstTime: 6, ioBurstTime: 4, ioTriggerAfter: 2 }],
      { header: [...LEGACY_ALL_COLUMNS] },
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Processes');
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const file = new File([bytes], 'processes.xlsx');

    await expect(readProcessesFromXlsx(file)).resolves.toEqual([
      { id: 'P1', name: 'Compile', arrivalTime: 1, burstTime: 6, ioBurstTime: 4, ioTriggerAfter: 2 },
    ]);
  });

  it('rejects the entire file when a legacy optional column has a bad value', async () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      LEGACY_ALL_COLUMNS,
      ['P1', 'Compile', 1, 6, 'not-a-number', 2],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Processes');
    const file = new File([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], 'processes.xlsx');

    await expect(readProcessesFromXlsx(file)).rejects.toThrow(/fila 2.*"ioBurstTime"/i);
  });

  it('imports successfully with no io fields set when no io columns are present at all', async () => {
    const file = createWorkbookFile([{ id: 'P1', name: 'Compile', arrivalTime: 1, burstTime: 3 }]);

    const imported = await readProcessesFromXlsx(file);
    expect(imported[0].ioBurstTime).toBeUndefined();
    expect(imported[0].ioTriggerAfter).toBeUndefined();
    expect(imported[0].ioOperations).toBeUndefined();
  });

  it('prefers the ioOperations column over legacy columns when both are present on the same row', async () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      [...WRITE_COLUMNS, 'ioBurstTime', 'ioTriggerAfter'],
      ['P1', 'Compile', 1, 10, '2:3', 'SJF', 99, 99],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Processes');
    const file = new File([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], 'processes.xlsx');

    await expect(readProcessesFromXlsx(file)).resolves.toEqual([
      { id: 'P1', name: 'Compile', arrivalTime: 1, burstTime: 10, queue: 'SJF', ioOperations: [{ after: 2, duration: 3 }] },
    ]);
  });

  it('preserves the queue assignment across write then read', async () => {
    const processes = [{ id: 'P1', name: 'Compile', arrivalTime: 1, burstTime: 6, queue: 'RR' as const }];

    const worksheet = XLSX.utils.json_to_sheet(processes, { header: [...WRITE_COLUMNS] });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Processes');
    const file = new File([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], 'processes.xlsx');

    await expect(readProcessesFromXlsx(file)).resolves.toEqual(processes);
  });

  it('preserves the queue assignment on a row that ALSO has ioOperations (regression: queue must not be dropped by the io early-return)', async () => {
    const processes = [
      { id: 'P1', name: 'P1', arrivalTime: 4, burstTime: 2, ioOperations: [{ after: 1, duration: 3 }], queue: 'RR' as const },
    ];

    const worksheet = XLSX.utils.json_to_sheet(
      [{ ...processes[0], ioOperations: '1:3' }],
      { header: [...WRITE_COLUMNS] },
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Processes');
    const file = new File([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], 'processes.xlsx');

    await expect(readProcessesFromXlsx(file)).resolves.toEqual(processes);
  });

  it('rejects the entire file when the queue column has an invalid value', async () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      WRITE_COLUMNS,
      ['P1', 'Compile', 1, 6, undefined, 'INVALID'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Processes');
    const file = new File([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], 'processes.xlsx');

    await expect(readProcessesFromXlsx(file)).rejects.toThrow(/fila 2.*cola inválido/i);
  });
});
