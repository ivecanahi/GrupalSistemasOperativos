// ============================================================
// MÓDULO DE IMPORTACIÓN/EXPORTACIÓN DE ARCHIVOS XLSX
// ============================================================
// Permite cargar procesos desde un archivo Excel (.xlsx) y
// exportar la tabla de procesos a un archivo Excel.
// Usa la librería SheetJS (xlsx) para la manipulación.

import * as XLSX from 'xlsx';
import type { IoOperation, ProcessInput, QueueAssignment } from '../types/scheduling';
import { normalizeIoOperations } from '../core/ioOperations';

// Columnas requeridas en el archivo Excel
const REQUIRED_COLUMNS = ['id', 'name', 'arrivalTime', 'burstTime'] as const;
const IO_OPERATIONS_COLUMN = 'ioOperations' as const;
const QUEUE_COLUMN = 'queue' as const;
const LEGACY_OPTIONAL_COLUMNS = ['ioBurstTime', 'ioTriggerAfter'] as const;
const OPTIONAL_COLUMNS = [IO_OPERATIONS_COLUMN, QUEUE_COLUMN, ...LEGACY_OPTIONAL_COLUMNS] as const;
// Columnas que se escriben al exportar (solo el formato moderno)
const WRITE_COLUMNS = [...REQUIRED_COLUMNS, IO_OPERATIONS_COLUMN, QUEUE_COLUMN] as const;

// Lee un archivo .xlsx y devuelve la lista de procesos
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

    // Convierte la hoja a un arreglo de filas
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: null, raw: true });
    const headers = rows[0] ?? [];
    const columnIndexes = requiredColumnIndexes(headers);
    const optionalColumnIndexes = optionalColumnIndexesOf(headers);

    // Procesa cada fila (salta el encabezado)
    return rows
      .slice(1)
      .map((row, index) => parseProcessRow(row, columnIndexes, optionalColumnIndexes, index + 2));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('El archivo fue rechazado:')) throw error;
    throw rejectedFile('no se pudo leer el archivo');
  }
}

// Exporta la lista de procesos a un archivo .xlsx
export function writeProcessesToXlsx(processes: ProcessInput[], filename: string): void {
  const worksheet = XLSX.utils.json_to_sheet(
    processes.map(p => {
      const ops = normalizeIoOperations(p);
      return {
        id: p.id, name: p.name, arrivalTime: p.arrivalTime, burstTime: p.burstTime,
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

// Convierte lista de IoOperation a string "after:duration,after:duration"
function serializeIoOperations(ops: IoOperation[]): string {
  return ops.map(op => `${op.after}:${op.duration}`).join(',');
}

// Encuentra índices de columnas requeridas en el encabezado
function requiredColumnIndexes(headers: unknown[]): Record<(typeof REQUIRED_COLUMNS)[number], number> {
  const indexes = {} as Record<(typeof REQUIRED_COLUMNS)[number], number>;
  for (const column of REQUIRED_COLUMNS) {
    const index = headers.findIndex((header) => header === column);
    if (index === -1) throw rejectedFile(`falta la columna requerida "${column}"`);
    indexes[column] = index;
  }
  return indexes;
}

// Encuentra índices de columnas opcionales
function optionalColumnIndexesOf(headers: unknown[]): Partial<Record<(typeof OPTIONAL_COLUMNS)[number], number>> {
  const indexes: Partial<Record<(typeof OPTIONAL_COLUMNS)[number], number>> = {};
  for (const column of OPTIONAL_COLUMNS) {
    const index = headers.findIndex((header) => header === column);
    if (index !== -1) indexes[column] = index;
  }
  return indexes;
}

// Parsea una fila del Excel a un objeto ProcessInput
function parseProcessRow(
  row: unknown[],
  columnIndexes: Record<(typeof REQUIRED_COLUMNS)[number], number>,
  optionalColumnIndexes: Partial<Record<(typeof OPTIONAL_COLUMNS)[number], number>>,
  rowNumber: number,
): ProcessInput {
  // Campos obligatorios
  const base: ProcessInput = {
    id: requiredText(row[columnIndexes.id], 'id', rowNumber),
    name: requiredText(row[columnIndexes.name], 'name', rowNumber),
    arrivalTime: requiredNumber(row[columnIndexes.arrivalTime], 'arrivalTime', rowNumber),
    burstTime: requiredNumber(row[columnIndexes.burstTime], 'burstTime', rowNumber),
  };

  // Cola opcional (SJF/RR)
  const queue = optionalQueue(row, optionalColumnIndexes.queue, rowNumber);
  if (queue !== undefined) base.queue = queue;

  // ioOperations (formato moderno) tiene prioridad sobre legacy
  const ioOperationsIndex = optionalColumnIndexes.ioOperations;
  if (ioOperationsIndex !== undefined) {
    const raw = row[ioOperationsIndex];
    if (raw !== null && raw !== undefined && String(raw).trim() !== '') {
      base.ioOperations = parseIoOperationsCell(String(raw), rowNumber);
      return base;
    }
  }

  // Campos legacy (retrocompatibilidad)
  const ioBurstTime = optionalNumber(row, optionalColumnIndexes.ioBurstTime, 'ioBurstTime', rowNumber);
  const ioTriggerAfter = optionalNumber(row, optionalColumnIndexes.ioTriggerAfter, 'ioTriggerAfter', rowNumber);
  if (ioBurstTime !== undefined) base.ioBurstTime = ioBurstTime;
  if (ioTriggerAfter !== undefined) base.ioTriggerAfter = ioTriggerAfter;

  return base;
}

// Parsea el valor de la columna "queue"
function optionalQueue(row: unknown[], columnIndex: number | undefined, rowNumber: number): QueueAssignment | undefined {
  if (columnIndex === undefined) return undefined;
  const value = row[columnIndex];
  if (value === null || value === undefined || String(value).trim() === '') return undefined;
  const normalized = String(value).trim().toUpperCase();
  if (normalized !== 'SJF' && normalized !== 'RR')
    throw rejectedFile(`la fila ${rowNumber} tiene un valor de cola inválido (debe ser SJF o RR)`);
  return normalized as QueueAssignment;
}

// Parsea una celda de ioOperations (formato "after:duration,after:duration")
function parseIoOperationsCell(raw: string, rowNumber: number): IoOperation[] {
  const pairs = raw.split(',').map(pair => pair.trim()).filter(pair => pair !== '');
  const parsed: IoOperation[] = pairs.map(pair => {
    const parts = pair.split(':');
    if (parts.length !== 2) throw rejectedFile(`la fila ${rowNumber} tiene un formato de E/S inválido`);
    const after = Number(parts[0]);
    const duration = Number(parts[1]);
    if (!Number.isFinite(after) || after <= 0 || !Number.isFinite(duration) || duration <= 0)
      throw rejectedFile(`la fila ${rowNumber} tiene un formato de E/S inválido`);
    return { after, duration };
  });
  // Valida que los 'after' sean estrictamente crecientes
  const sorted = [...parsed].sort((a, b) => a.after - b.after);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].after <= sorted[i - 1].after)
      throw rejectedFile(`la fila ${rowNumber} tiene un formato de E/S inválido`);
  }
  return sorted;
}

// Validación de campos obligatorios
function requiredText(value: unknown, column: string, rowNumber: number): string {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '')
    throw rejectedFile(`la fila ${rowNumber} tiene vacío el valor de "${column}"`);
  return String(value).trim();
}

function requiredNumber(value: unknown, column: string, rowNumber: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw rejectedFile(`la fila ${rowNumber} tiene un valor no numérico en "${column}"`);
  return value;
}

// Validación de campos opcionales
function optionalNumber(row: unknown[], columnIndex: number | undefined, column: string, rowNumber: number): number | undefined {
  if (columnIndex === undefined) return undefined;
  const value = row[columnIndex];
  if (value === null || value === undefined || String(value).trim() === '') return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    throw rejectedFile(`la fila ${rowNumber} tiene un valor no numérico en "${column}"`);
  return value;
}

// Crea un error con formato estandarizado
function rejectedFile(reason: string): Error {
  return new Error(`El archivo fue rechazado: ${reason}. No se importó ningún proceso.`);
}

// Asegura extensión .xlsx
function toXlsxFilename(filename: string): string {
  return filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
}
