import { useState } from 'react';
import type { Algorithm, ProcessInput, SchedulingResult } from './types/scheduling';
import { schedule } from './core';
import { ProcessTable } from './components/ProcessTable';
import { GanttChart } from './components/GanttChart';
import { StatsPanel } from './components/StatsPanel';
import './App.css';

function App() {
  const [processes, setProcesses] = useState<ProcessInput[]>([]);
  const [algorithm, setAlgorithm] = useState<Algorithm>('SJF');
  const [quantum, setQuantum] = useState(2);
  const [result, setResult] = useState<SchedulingResult | null>(null);

  function handleRun() {
    setResult(schedule(processes, { algorithm, quantum }));
  }

  return (
    <div id="app">
      <h1>Simulador de Planificación de CPU</h1>

      <section>
        <label>
          Algoritmo:
          <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value as Algorithm)}>
            <option value="SJF">SJF (no apropiativo)</option>
            <option value="RR">Round Robin</option>
          </select>
        </label>
        {algorithm === 'RR' && (
          <label>
            Quantum:
            <input
              type="number"
              min={1}
              value={quantum}
              onChange={(e) => setQuantum(Number(e.target.value))}
            />
          </label>
        )}
        <button type="button" onClick={handleRun}>
          Ejecutar
        </button>
      </section>

      <ProcessTable processes={processes} onChange={setProcesses} />

      {result && (
        <>
          <GanttChart timeline={result.timeline} />
          <StatsPanel
            processResults={result.processResults}
            averageWaitingTime={result.averageWaitingTime}
            averageTurnaroundTime={result.averageTurnaroundTime}
          />
        </>
      )}
    </div>
  );
}

export default App;
