import { describe, it, expect } from 'vitest';
import { normalizeIoOperations } from './ioOperations';
import type { ProcessInput } from '../types/scheduling';

describe('normalizeIoOperations', () => {
  it('returns an empty list when neither ioOperations nor legacy fields are set', () => {
    const p: ProcessInput = { id: 'A', name: 'A', arrivalTime: 0, burstTime: 5 };

    expect(normalizeIoOperations(p)).toEqual([]);
  });

  it('normalizes a legacy ioBurstTime/ioTriggerAfter pair into a single-element list', () => {
    const p: ProcessInput = {
      id: 'A', name: 'A', arrivalTime: 0, burstTime: 6, ioBurstTime: 3, ioTriggerAfter: 2,
    };

    expect(normalizeIoOperations(p)).toEqual([{ after: 2, duration: 3 }]);
  });

  it('defaults legacy after to burstTime when ioTriggerAfter is omitted', () => {
    const p: ProcessInput = { id: 'A', name: 'A', arrivalTime: 0, burstTime: 5, ioBurstTime: 4 };

    expect(normalizeIoOperations(p)).toEqual([{ after: 5, duration: 4 }]);
  });

  it('prefers ioOperations over legacy fields when both are present', () => {
    const p: ProcessInput = {
      id: 'A',
      name: 'A',
      arrivalTime: 0,
      burstTime: 10,
      ioBurstTime: 99,
      ioTriggerAfter: 99,
      ioOperations: [{ after: 2, duration: 3 }],
    };

    expect(normalizeIoOperations(p)).toEqual([{ after: 2, duration: 3 }]);
  });

  it('sorts ioOperations by after ascending even when given out of order', () => {
    const p: ProcessInput = {
      id: 'A',
      name: 'A',
      arrivalTime: 0,
      burstTime: 10,
      ioOperations: [
        { after: 8, duration: 2 },
        { after: 2, duration: 3 },
        { after: 5, duration: 4 },
      ],
    };

    expect(normalizeIoOperations(p)).toEqual([
      { after: 2, duration: 3 },
      { after: 5, duration: 4 },
      { after: 8, duration: 2 },
    ]);
  });

  it('returns an empty list for an explicitly empty ioOperations array (falls back to legacy check)', () => {
    const p: ProcessInput = {
      id: 'A', name: 'A', arrivalTime: 0, burstTime: 5, ioOperations: [],
    };

    expect(normalizeIoOperations(p)).toEqual([]);
  });
});
