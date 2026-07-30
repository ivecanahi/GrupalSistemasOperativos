// ============================================================
// EMPAQUETADOR DE INTERVALOS — Algoritmo "meeting rooms"
// ============================================================
// Asigna cada intervalo (slice de cola) a la primera pista
// disponible (track) cuyo intervalo anterior ya terminó.
// Esto permite mostrar intervalos solapados en filas separadas
// dentro del componente QueueSection.

import type { QueueSlice } from '../types/scheduling';

export interface PackedSlice extends QueueSlice {
  track: number; // Pista 0-indexada (sub-fila) dentro del carril
}

// Algoritmo greedy: cada slice se asigna a la pista más baja disponible
export function packIntervals(slices: QueueSlice[]): PackedSlice[] {
  const sorted = [...slices].sort((a, b) => a.start - b.start || a.end - b.end);

  const trackEnds: number[] = []; // Fin del último slice en cada pista
  const packed: PackedSlice[] = [];

  for (const slice of sorted) {
    // Busca la primera pista cuyo último slice ya terminó
    let track = trackEnds.findIndex(end => end <= slice.start);
    if (track === -1) {
      track = trackEnds.length; // Nueva pista
      trackEnds.push(slice.end);
    } else {
      trackEnds[track] = slice.end;
    }
    packed.push({ ...slice, track });
  }

  return packed;
}
