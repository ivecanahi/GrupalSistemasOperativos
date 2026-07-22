import * as XLSX from 'xlsx';
import type { IoOperation, ProcessInput, QueueAssignment } from '../types/scheduling';
import { normalizeIoOperations } from '../core/ioOperations';

const REQUIRED_COLUMNS = ['id', 'name', 'arrivalTime', 'burstTime'] as const;
const IO_OPERATIONS_COLUMN = 'ioOperations' as const;
const QUEUE_COLUMN = 'queue' as const;
const LEGACY_OPTIONAL_COLUMNS = ['ioBurstTime', 'ioTriggerAfter'] as const;
// Columns recognized on READ, in addition to the required ones. The unified
// `ioOperations` column takes precedence over the legacy pair when both are
// present on the same row (read-only backward compatibility with files
// exported by a prior version of this app).
const OPTIONAL_COLUMNS = [IO_OPERATIONS_COLUMN, QUEUE_COLUMN, ...LEGACY_OPTIONAL_COLUMNS] as const;
// Columns written on export — the legacy pair is retired from the write
// path in favor of the single unified `ioOperations` column.
const WRITE_COLUMNS = [...REQUIRED_COLUMNS, IO_OPERATIONS_COLUMN, QUEUE_COLUMN] as const;

export async function readProcessesFromXlsx(file: File): Promise<ProcessInput[]> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Solo se pueden importar archivos .xlsx. No se importó ningún proceso.');
  }

  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    if (worksheet === undefined) {
      throw rejectedFile('el archivo no contiene ninguna hoja de cálculo');
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: null,
      raw: true,
    });
    const headers = rows[0] ?? [];
    const columnIndexes = requiredColumnIndexes(headers);
    const optionalColumnIndexes = optionalColumnIndexesOf(headers);

    return rows
      .slice(1)
      .map((row, index) => parseProcessRow(row, columnIndexes, optionalColumnIndexes, index + 2));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('El archivo fue rechazado:')) {
      throw error;
    }

    throw rejectedFile('no se pudo leer el archivo');
  }
}

export function writeProcessesToXlsx(processes: ProcessInput[], filename: string): void {
  const worksheet = XLSX.utils.json_to_sheet(
    processes.map(p => {
      const ops = normalizeIoOperations(p);
      return {
        id: p.id,
        name: p.name,
        arrivalTime: p.arrivalTime,
        burstTime: p.burstTime,
        ioOperations: ops.length > 0 ? serializeIoOperations(ops) : undefined,
        queue: p.queue ?? 'SJF',
      };
    }),
    { header: [...WRITE_COLUMNS] },
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Processes');
  XLSX.writeFile(workbook, toXlsxFilename(filename), { bookType: 'xlsx' });
}

function serializeIoOperations(ops: IoOperation[]): string {
  return ops.map(op => `${op.after}:${op.duration}`).join(',');
}

function requiredColumnIndexes(headers: unknown[]): Record<(typeof REQUIRED_COLUMNS)[number], number> {
  const indexes = {} as Record<(typeof REQUIRED_COLUMNS)[number], number>;

  for (const column of REQUIRED_COLUMNS) {
    const index = headers.findIndex((header) => header === column);

    if (index === -1) {
      throw rejectedFile(`falta la columna requerida "${column}"`);
    }

    indexes[column] = index;
  }

  return indexes;
}

function optionalColumnIndexesOf(headers: unknown[]): Partial<Record<(typeof OPTIONAL_COLUMNS)[number], number>> {
  const indexes: Partial<Record<(typeof OPTIONAL_COLUMNS)[number], number>> = {};

  for (const column of OPTIONAL_COLUMNS) {
    const index = headers.findIndex((header) => header === column);
    if (index !== -1) {
      indexes[column] = index;
    }
  }

  return indexes;
}

function parseProcessRow(
  row: unknown[],
  columnIndexes: Record<(typeof REQUIRED_COLUMNS)[number], number>,
  optionalColumnIndexes: Partial<Record<(typeof OPTIONAL_COLUMNS)[number], number>>,
  rowNumber: number,
): ProcessInput {
  const base: ProcessInput = {
    id: requiredText(row[columnIndexes.id], 'id', rowNumber),
    name: requiredText(row[columnIndexes.name], 'name', rowNumber),
    arrivalTime: requiredNumber(row[columnIndexes.arrivalTime], 'arrivalTime', rowNumber),
    burstTime: requiredNumber(row[columnIndexes.burstTime], 'burstTime', rowNumber),
  };

  const queue = optionalQueue(row, optionalColumnIndexes.queue, rowNumber);
  if (queue !== undefined) base.queue = queue;

  const ioOperationsIndex = optionalColumnIndexes.ioOperations;
  if (ioOperationsIndex !== undefined) {
    const raw = row[ioOperationsIndex];
    if (raw !== null && raw !== undefined && String(raw).trim() !== '') {
      base.ioOperations = parseIoOperationsCell(String(raw), rowNumber);
      return base;
    }
  }

  const ioBurstTime = optionalNumber(row, optionalColumnIndexes.ioBurstTime, 'ioBurstTime', rowNumber);
  const ioTriggerAfter = optionalNumber(row, optionalColumnIndexes.ioTriggerAfter, 'ioTriggerAfter', rowNumber);
  if (ioBurstTime !== undefined) base.ioBurstTime = ioBurstTime;
  if (ioTriggerAfter !== undefined) base.ioTriggerAfter = ioTriggerAfter;

  return base;
}

function optionalQueue(
  row: unknown[],
  columnIndex: number | undefined,
  rowNumber: number,
): QueueAssignment | undefined {
  if (columnIndex === undefined) return undefined;

  const value = row[columnIndex];
  if (value === null || value === undefined || String(value).trim() === '') {
    return undefined;
  }

  const normalized = String(value).trim().toUpperCase();
  if (normalized !== 'SJF' && normalized !== 'RR') {
    throw rejectedFile(`la fila ${rowNumber} tiene un valor de cola inválido (debe ser SJF o RR)`);
  }

  return normalized;
}

function parseIoOperationsCell(raw: string, rowNumber: number): IoOperation[] {
  const pairs = raw
    .split(',')
    .map(pair => pair.trim())
    .filter(pair => pair !== '');

  const parsed: IoOperation[] = pairs.map(pair => {
    const parts = pair.split(':');
    if (parts.length !== 2) {
      throw rejectedFile(`la fila ${rowNumber} tiene un formato de E/S inválido`);
    }

    const after = Number(parts[0]);
    const duration = Number(parts[1]);
    if (!Number.isFinite(after) || after <= 0 || !Number.isFinite(duration) || duration <= 0) {
      throw rejectedFile(`la fila ${rowNumber} tiene un formato de E/S inválido`);
    }

    return { after, duration };
  });

  const sorted = [...parsed].sort((a, b) => a.after - b.after);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].after <= sorted[i - 1].after) {
      throw rejectedFile(`la fila ${rowNumber} tiene un formato de E/S inválido`);
    }
  }

  return sorted;
}

function requiredText(value: unknown, column: string, rowNumber: number): string {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') {
    throw rejectedFile(`la fila ${rowNumber} tiene vacío el valor de "${column}"`);
  }

  return String(value).trim();
}

function requiredNumber(value: unknown, column: string, rowNumber: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw rejectedFile(`la fila ${rowNumber} tiene un valor no numérico en "${column}"`);
  }

  return value;
}

function optionalNumber(
  row: unknown[],
  columnIndex: number | undefined,
  column: string,
  rowNumber: number,
): number | undefined {
  if (columnIndex === undefined) return undefined;

  const value = row[columnIndex];
  if (value === null || value === undefined || String(value).trim() === '') {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw rejectedFile(`la fila ${rowNumber} tiene un valor no numérico en "${column}"`);
  }

  return value;
}

function rejectedFile(reason: string): Error {
  return new Error(`El archivo fue rechazado: ${reason}. No se importó ningún proceso.`);
}

function toXlsxFilename(filename: string): string {
  return filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
}
