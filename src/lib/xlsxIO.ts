import * as XLSX from 'xlsx';
import type { ProcessInput } from '../types/scheduling';

const REQUIRED_COLUMNS = ['id', 'name', 'arrivalTime', 'burstTime'] as const;

export async function readProcessesFromXlsx(file: File): Promise<ProcessInput[]> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Only .xlsx files can be imported. No processes were imported.');
  }

  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    if (worksheet === undefined) {
      throw rejectedFile('the workbook does not contain a worksheet');
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: null,
      raw: true,
    });
    const headers = rows[0] ?? [];
    const columnIndexes = requiredColumnIndexes(headers);

    return rows.slice(1).map((row, index) => parseProcessRow(row, columnIndexes, index + 2));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('The selected file was rejected:')) {
      throw error;
    }

    throw rejectedFile('the workbook could not be read');
  }
}

export function writeProcessesToXlsx(processes: ProcessInput[], filename: string): void {
  const worksheet = XLSX.utils.json_to_sheet(
    processes.map(({ id, name, arrivalTime, burstTime }) => ({ id, name, arrivalTime, burstTime })),
    { header: [...REQUIRED_COLUMNS] },
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Processes');
  XLSX.writeFile(workbook, toXlsxFilename(filename), { bookType: 'xlsx' });
}

function requiredColumnIndexes(headers: unknown[]): Record<(typeof REQUIRED_COLUMNS)[number], number> {
  const indexes = {} as Record<(typeof REQUIRED_COLUMNS)[number], number>;

  for (const column of REQUIRED_COLUMNS) {
    const index = headers.findIndex((header) => header === column);

    if (index === -1) {
      throw rejectedFile(`the required column "${column}" is missing`);
    }

    indexes[column] = index;
  }

  return indexes;
}

function parseProcessRow(
  row: unknown[],
  columnIndexes: Record<(typeof REQUIRED_COLUMNS)[number], number>,
  rowNumber: number,
): ProcessInput {
  return {
    id: requiredText(row[columnIndexes.id], 'id', rowNumber),
    name: requiredText(row[columnIndexes.name], 'name', rowNumber),
    arrivalTime: requiredNumber(row[columnIndexes.arrivalTime], 'arrivalTime', rowNumber),
    burstTime: requiredNumber(row[columnIndexes.burstTime], 'burstTime', rowNumber),
  };
}

function requiredText(value: unknown, column: string, rowNumber: number): string {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') {
    throw rejectedFile(`row ${rowNumber} has an empty ${column} value`);
  }

  return String(value).trim();
}

function requiredNumber(value: unknown, column: string, rowNumber: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw rejectedFile(`row ${rowNumber} has a non-numeric ${column} value`);
  }

  return value;
}

function rejectedFile(reason: string): Error {
  return new Error(`The selected file was rejected: ${reason}. No processes were imported.`);
}

function toXlsxFilename(filename: string): string {
  return filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
}
