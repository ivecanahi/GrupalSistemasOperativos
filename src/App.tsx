import { useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Algorithm, ProcessInput, QueueAssignment, SchedulingResult } from './types/scheduling';
import { schedule } from './core';
import { ProcessTable } from './components/ProcessTable';
import { QueueSection } from './components/QueueSection';
import { PerProcessGantt } from './components/PerProcessGantt';
import { StatsPanel } from './components/StatsPanel';
import { AverageTimeCards } from './components/AverageTimeCards';
import { buildColorMap } from './lib/seriesColors';
import { readProcessesFromXlsx, writeProcessesToXlsx } from './lib/xlsxIO';
import './App.css';

function App() {
  const [processes, setProcesses] = useState<ProcessInput[]>([]);
  const [algorithm, setAlgorithm] = useState<Algorithm>('SJF');
  const [quantum, setQuantum] = useState(2);
  const [priorityQueue, setPriorityQueue] = useState<QueueAssignment>('SJF');
  const [result, setResult] = useState<SchedulingResult | null>(null);
  const [ranProcesses, setRanProcesses] = useState<ProcessInput[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  // Shared color map: built from the current table order (always available,
  // even before running), so a process's color never changes once assigned
  // and always matches its color in every diagram below.
  const colorMap = buildColorMap(processes.map(p => p.id));

  function handleRun() {
    setResult(schedule(processes, { algorithm, quantum, priorityQueue }));
    setRanProcesses(processes);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const imported = await readProcessesFromXlsx(file);
      setProcesses(imported);
      setImportError(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'No se pudo importar el archivo');
    }
  }

  function handleExport() {
    writeProcessesToXlsx(processes, 'procesos.xlsx');
  }

  return (
    <div id="app">
      <h1>Algoritmo: SJF no apropiativo y Round Robin fijo</h1>

      <div className="header-info-cards">
        <div className="info-card accent-sjf">
          <svg className="info-card-icon" aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <div className="info-card-body">
            <h3 className="info-card-title">SJF no apropiativo</h3>
            <p className="info-card-desc">
              Elige siempre el proceso listo con la ráfaga de CPU más corta y lo ejecuta hasta que termina,
              sin interrupciones.
            </p>
          </div>
        </div>
        <div className="info-card accent-rr">
          <svg className="info-card-icon" aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          <div className="info-card-body">
            <h3 className="info-card-title">Round Robin (fijo)</h3>
            <p className="info-card-desc">
              Reparte la CPU en turnos de duración fija (quantum); si un proceso no termina su turno, vuelve al
              final de la cola de listos.
            </p>
          </div>
        </div>
      </div>

      <section className="card-v2 run-bar">
        <label className="field">
          Algoritmo:
          <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value as Algorithm)}>
            <option value="SJF">SJF (no apropiativo)</option>
            <option value="RR">Round Robin</option>
            <option value="MLQ">Colas multinivel (SJF + RR)</option>
          </select>
        </label>
        {(algorithm === 'RR' || algorithm === 'MLQ') && (
          <label className="field">
            Quantum:
            <input
              type="number"
              min={1}
              value={quantum}
              onChange={(e) => setQuantum(Number(e.target.value))}
            />
          </label>
        )}
        {algorithm === 'MLQ' && (
          <label className="field">
            Cola con prioridad:
            <select value={priorityQueue} onChange={(e) => setPriorityQueue(e.target.value as QueueAssignment)}>
              <option value="SJF">SJF</option>
              <option value="RR">RR</option>
            </select>
          </label>
        )}
        <button type="button" className="btn btn-primary" onClick={handleRun}>
          Ejecutar
        </button>
      </section>

      <section>
        <h2>1. Cargar datos del ejercicio</h2>
        <div className="section1-cards">
          <div className="option-card accent-io">
            <svg className="option-card-icon" aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <div className="option-card-body">
              <h3 className="option-card-title">Ingresar manualmente</h3>
              <p className="option-card-desc">
                Agrega procesos uno por uno indicando su tiempo de llegada, ráfaga de CPU y operaciones de E/S.
              </p>
              <a href="#agregar-proceso" className="btn btn-ghost">Ir al formulario ↓</a>
            </div>
          </div>

          <div className="option-card accent-rr">
            <svg className="option-card-icon" aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
            <div className="option-card-body">
              <h3 className="option-card-title">Cargar desde Excel</h3>
              <p className="option-card-desc">
                Importa una lista de procesos desde un archivo .xlsx con las columnas id, name, arrivalTime y
                burstTime.
              </p>
              <div className="process-io-actions">
                <label className="btn btn-ghost file-input-label">
                  Importar Excel
                  <input type="file" accept=".xlsx" onChange={handleImport} className="file-input-hidden" />
                </label>
                <button type="button" className="btn btn-ghost" onClick={handleExport}>
                  Exportar Excel
                </button>
              </div>
              {importError && <p role="alert" className="field-error">{importError}</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="card-v2">
        <h2>2. Tabla de procesos</h2>
        <ProcessTable processes={processes} onChange={setProcesses} colorMap={colorMap} />
      </section>

      {result && (() => {
        const queueById = new Map(ranProcesses.map(p => [p.id, p.queue ?? 'SJF']));
        const readySlices = result.queues?.ready ?? [];
        const sjfReady = readySlices.filter(s => (queueById.get(s.processId) ?? 'SJF') === 'SJF');
        const rrReady = readySlices.filter(s => (queueById.get(s.processId) ?? 'SJF') === 'RR');
        const ioSlices = result.queues?.io ?? [];
        const cpuSlices = result.queues?.cpu ?? [];

        return (
          <>
            <section>
              <h2>3. Desarrollo del ejercicio</h2>
              <div className="section-stack">
                {algorithm === 'MLQ' && (
                  <>
                    <QueueSection title="Cola de SJF" slices={sjfReady} colorMap={colorMap} accent="sjf" />
                    <QueueSection title="Cola de Round Robin" slices={rrReady} colorMap={colorMap} accent="rr" />
                  </>
                )}
                {algorithm === 'SJF' && (
                  <QueueSection title="Cola de listos (SJF)" slices={readySlices} colorMap={colorMap} accent="sjf" />
                )}
                {algorithm === 'RR' && (
                  <QueueSection title="Cola de listos (Round Robin)" slices={readySlices} colorMap={colorMap} accent="rr" />
                )}
                <QueueSection
                  title="Cola de Operaciones de entrada/salida"
                  slices={ioSlices}
                  colorMap={colorMap}
                  accent="io"
                />
                <QueueSection title="Cola de CPU" slices={cpuSlices} colorMap={colorMap} accent="cpu" />
                <section className="card-v2">
                  <PerProcessGantt timeline={result.timeline} colorMap={colorMap} hideLegend />
                </section>
              </div>
            </section>

            <section className="card-v2">
              <h2>4. Resumen del ejercicio</h2>
              <StatsPanel processResults={result.processResults} processes={ranProcesses} algorithm={algorithm} />
            </section>

            <AverageTimeCards
              processResults={result.processResults}
              averageWaitingTime={result.averageWaitingTime}
              averageTurnaroundTime={result.averageTurnaroundTime}
            />
          </>
        );
      })()}
    </div>
  );
}

export default App;
