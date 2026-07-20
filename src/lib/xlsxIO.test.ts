import * as XLSX from 'xlsx';
import { describe, expect, it, vi } from 'vitest';
import { readProcessesFromXlsx, writeProcessesToXlsx } from './xlsxIO';

vi.mock('xlsx', async () => {
  const actual = await vi.importActual<typeof import('xlsx')>('xlsx');

  return { ...actual, writeFile: vi.fn() };
});

const REQUIRED_COLUMNS = ['id', 'name', 'arrivalTime', 'burstTime'];

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

    await expect(readProcessesFromXlsx(file)).rejects.toThrow(/only .xlsx files/i);
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

    await expect(readProcessesFromXlsx(file)).rejects.toThrow(/required column "burstTime" is missing/i);
  });

  it('rejects the entire file when an id is empty', async () => {
    const file = createWorkbookFile([{ id: '', name: 'Compile', arrivalTime: 1, burstTime: 3 }]);

    await expect(readProcessesFromXlsx(file)).rejects.toThrow(/row 2.*empty id/i);
  });

  it('rejects the entire file when one row is missing burstTime', async () => {
    const file = createWorkbookFile([
      { id: 'P1', name: 'Compile', arrivalTime: 1, burstTime: 3 },
      { id: 'P2', name: 'Render', arrivalTime: 4 },
    ]);

    await expect(readProcessesFromXlsx(file)).rejects.toThrow(/row 3.*burstTime/i);
  });

  it('rejects the entire file when arrivalTime is not numeric', async () => {
    const file = createWorkbookFile([{ id: 'P1', name: 'Compile', arrivalTime: 'abc', burstTime: 3 }]);

    await expect(readProcessesFromXlsx(file)).rejects.toThrow(/row 2.*arrivalTime/i);
  });

  it('rejects all ten valid rows when an eleventh row has a bad burstTime type', async () => {
    const validRows = Array.from({ length: 10 }, (_, index) => ({
      id: `P${index + 1}`,
      name: `Process ${index + 1}`,
      arrivalTime: index,
      burstTime: index + 1,
    }));
    const file = createWorkbookFile([...validRows, { id: 'P11', name: 'Invalid', arrivalTime: 10, burstTime: 'bad' }]);

    await expect(readProcessesFromXlsx(file)).rejects.toThrow(/row 12.*burstTime/i);
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
      REQUIRED_COLUMNS,
      ['P1', 'Compile', 1, 3],
    ]);
  });
});
