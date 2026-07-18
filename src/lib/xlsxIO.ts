import * as XLSX from 'xlsx';
import type { ProcessInput } from '../types/scheduling';

const REQUIRED_COLUMNS = ['id', 'name', 'arrivalTime', 'burstTime'] as const;

// Módulo 4 (archivos): validar filas contra REQUIRED_COLUMNS y mapear tipos (arrivalTime/burstTime a number).
export async function readProcessesFromXlsx(file: File): Promise<ProcessInput[]> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Solo se aceptan archivos .xlsx');
  }
  throw new Error('readProcessesFromXlsx: pendiente de implementación');
}

// Módulo 4 (archivos): serializar processes a una hoja con REQUIRED_COLUMNS y disparar la descarga como .xlsx.
export function writeProcessesToXlsx(processes: ProcessInput[], filename: string): void {
  throw new Error('writeProcessesToXlsx: pendiente de implementación');
}
