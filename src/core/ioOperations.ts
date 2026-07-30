// ============================================================
// NORMALIZADOR DE OPERACIONES DE E/S
// ============================================================
// Unifica el formato legacy (ioBurstTime/ioTriggerAfter) con el
// nuevo formato ioOperations (soporta múltiples operaciones).
// Esto permite retrocompatibilidad con archivos Excel antiguos.

import type { IoOperation, ProcessInput } from '../types/scheduling';

// Convierte la configuración de E/S de un proceso en una lista ordenada de IoOperation
export function normalizeIoOperations(p: ProcessInput): IoOperation[] {
  // Si usa el nuevo campo ioOperations (array), lo ordena por 'after' ascendente
  if (p.ioOperations && p.ioOperations.length > 0) {
    return [...p.ioOperations].sort((a, b) => a.after - b.after);
  }
  // Si usa el campo legacy ioBurstTime, lo convierte a una operación única
  if (p.ioBurstTime && p.ioBurstTime > 0) {
    return [{ after: p.ioTriggerAfter ?? p.burstTime, duration: p.ioBurstTime }];
  }
  return []; // Sin operaciones de E/S
}
