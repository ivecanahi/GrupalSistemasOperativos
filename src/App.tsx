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
          <span className="info-card-icon" aria-hidden="true">🕐</span>
          <div className="info-card-body">
            <h3 className="info-card-title">SJF no apropiativo</h3>
            <p className="info-card-desc">
              Elige siempre el proceso listo con la ráfaga de CPU más corta y lo ejecuta hasta que termina,
              sin interrupciones.
            </p>
          </div>
        </div>
        <div className="info-card accent-rr">
          <span className="info-card-icon" aria-hidden="true">🔄</span>
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
            <span className="option-card-icon" aria-hidden="true">✎</span>
            <div className="option-card-body">
              <h3 className="option-card-title">Ingresar manualmente</h3>
              <p className="option-card-desc">
                Agrega procesos uno por uno indicando su tiempo de llegada, ráfaga de CPU y operaciones de E/S.
              </p>
              <a href="#agregar-proceso" className="btn btn-ghost">Ir al formulario ↓</a>
            </div>
          </div>

          <div className="option-card accent-rr">
            <span className="option-card-icon" aria-hidden="true">📄</span>
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
                <QueueSection title="Cola de SJF" slices={sjfReady} colorMap={colorMap} accent="sjf" />
                <QueueSection title="Cola de Round Robin" slices={rrReady} colorMap={colorMap} accent="rr" />
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
