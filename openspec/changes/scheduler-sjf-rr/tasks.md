# Tasks: CPU Scheduling Simulator (SJF + Round Robin), 5-Way Split

Contract for all units: `src/types/scheduling.ts` is frozen — do not edit it.
TDD is strict: RED (failing test) → GREEN (make it pass) → REFACTOR, per file.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~900-1100 total across all units (150-300 each) |
| 400-line budget risk | High (as one PR); Low per unit if chained |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (bootstrap+engine) → PR 2 (xlsx) → PR 3 (Gantt) → PR 4 (table) → PR 5 (stats+integration) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Vitest bootstrap + SJF/RR/index engine | PR 1 | `npx vitest run src/core` | `npm run build` (tsc -b) | Revert `src/core/*`, `vitest.config.ts`, `package.json` devDeps |
| 2 | xlsx read/write | PR 2 | `npx vitest run src/lib/xlsxIO.test.ts` | Manual: load sample `.xlsx` in `npm run dev` | Revert `src/lib/xlsxIO.ts` + its test |
| 3 | Gantt chart | PR 3 | `npx vitest run src/components/GanttChart.test.tsx` | Manual: render in `npm run dev` with mock timeline | Revert `src/components/GanttChart.tsx` + its test |
| 4 | Process table CRUD | PR 4 | `npx vitest run src/components/ProcessTable.test.tsx` | Manual: add/edit/delete rows in `npm run dev` | Revert `src/components/ProcessTable.tsx` + its test |
| 5 | Stats panel + App wiring + e2e | PR 5 | `npx vitest run src/components/StatsPanel.test.tsx src/App.test.tsx` | Manual full run: load/CRUD → schedule → Gantt/stats in `npm run dev` | Revert `src/components/StatsPanel.tsx`, `src/App.tsx`, `src/App.test.tsx` |

Ask the user: stacked-to-main, feature-branch-chain, or size:exception, before `sdd-apply` starts unit 1.

---

## Integrante 1 — Motor de scheduling (dificil)
`src/core/sjf.ts`, `src/core/roundRobin.ts`, `src/core/index.ts`

- [x] 1.0 Add `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` to `package.json` devDependencies (shared bootstrap, owned by Integrante 1 — blocks everyone's TDD, do first)
- [x] 1.1 Create `vitest.config.ts` extending Vite config, `environment: 'jsdom'`
- [x] 1.2 Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts to `package.json`
- [x] 1.3 RED: `src/core/sjf.test.ts` — shortest burst runs first among arrived (A/B/C scenario, spec scheduling-engine)
- [x] 1.4 RED: `src/core/sjf.test.ts` — tie-break by `arrivalTime` then ascending `id` on equal burst
- [x] 1.5 RED: `src/core/sjf.test.ts` — CPU idle gap before next arrival produces no `ExecutionSlice`
- [x] 1.6 GREEN: implement `runSJF` in `src/core/sjf.ts` against frozen `ProcessInput`/`SchedulingResult` contract
- [x] 1.7 REFACTOR: `src/core/sjf.ts`
- [x] 1.8 RED: `src/core/roundRobin.test.ts` — process finishes within quantum, not requeued
- [x] 1.9 RED: `src/core/roundRobin.test.ts` — process exceeds quantum, preempted and requeued with reduced burst
- [x] 1.10 RED: `src/core/roundRobin.test.ts` — idle gap when queue empty and next arrival pending
- [x] 1.11 RED: `src/core/roundRobin.test.ts` — simultaneous arrival + quantum expiry: new arrival Y enqueued BEFORE requeued process X (locked design decision, Silberschatz convention)
- [x] 1.12 GREEN: implement `runRoundRobin(processes, quantum)` in `src/core/roundRobin.ts` with FIFO circular queue honoring runtime `SchedulerConfig.quantum`
- [x] 1.13 REFACTOR: `src/core/roundRobin.ts`
- [x] 1.14 RED: `src/core/index.test.ts` — `schedule()` dispatches to `runSJF`/`runRoundRobin` and throws on missing/invalid RR quantum
- [x] 1.15 GREEN/verify: confirm `src/core/index.ts` (`schedule`) already satisfies 1.14; adjust only if a test fails

## Integrante 2 — Carga/guardado xlsx (medio-alto)
`src/lib/xlsxIO.ts`

- [x] 2.1 RED: `src/lib/xlsxIO.test.ts` — reject non-`.xlsx` extension on load with clear error, imports nothing
- [x] 2.2 RED: `src/lib/xlsxIO.test.ts` — valid file with all rows having id/name/numeric arrivalTime/burstTime imports as `ProcessInput[]`
- [x] 2.3 RED: `src/lib/xlsxIO.test.ts` — one row missing `burstTime` rejects the ENTIRE file, imports zero rows (locked reject-entire-file-on-any-invalid-row decision)
- [x] 2.4 RED: `src/lib/xlsxIO.test.ts` — one row with non-numeric `arrivalTime` rejects the entire file
- [x] 2.5 RED: `src/lib/xlsxIO.test.ts` — 10 valid rows + 1 bad-type row: none imported, whole file rejected
- [x] 2.6 GREEN: implement `readProcessesFromXlsx(file: File): Promise<ProcessInput[]>` in `src/lib/xlsxIO.ts` using SheetJS CDN build, strict validate-then-import, throw/reject with user-facing error message on any invalid row
- [x] 2.7 RED: `src/lib/xlsxIO.test.ts` — save produces `.xlsx` with columns `id, name, arrivalTime, burstTime`
- [x] 2.8 GREEN: implement `writeProcessesToXlsx(processes: ProcessInput[], filename: string): void` in `src/lib/xlsxIO.ts`
- [x] 2.9 REFACTOR: `src/lib/xlsxIO.ts`

## Integrante 3 — Gantt visual (medio)
`src/components/GanttChart.tsx`

- [x] 3.1 RED: `src/components/GanttChart.test.tsx` — slices of duration 2/5/3 render with proportional widths (2:5:3)
- [x] 3.2 RED: `src/components/GanttChart.test.tsx` — same `processId` keeps same color across non-contiguous slices, distinct from other processes
- [x] 3.3 RED: `src/components/GanttChart.test.tsx` — idle gap before first arrival (e.g. [0,3)) renders as distinct idle segment, not execution
- [x] 3.4 RED: `src/components/GanttChart.test.tsx` — empty timeline renders placeholder/empty state without throwing
- [x] 3.5 GREEN: implement `GanttChart` in `src/components/GanttChart.tsx` accepting frozen `GanttChartProps { timeline: ExecutionSlice[] }`, computing idle gaps from timeline span, per-process color map
- [x] 3.6 REFACTOR: `src/components/GanttChart.tsx`

## Integrante 4 — Tabla de procesos (facil-medio)
`src/components/ProcessTable.tsx`

- [x] 4.1 RED: `src/components/ProcessTable.test.tsx` — add valid row appears in table
- [x] 4.2 RED: `src/components/ProcessTable.test.tsx` — edit existing row's `burstTime` to a valid positive number updates it
- [x] 4.3 RED: `src/components/ProcessTable.test.tsx` — delete row removes it from table and from `onChange` output
- [x] 4.4 RED: `src/components/ProcessTable.test.tsx` — accept `arrivalTime` = 0, reject negative with validation error, no add/update
- [x] 4.5 RED: `src/components/ProcessTable.test.tsx` — reject non-numeric `burstTime` with validation error
- [x] 4.6 RED: `src/components/ProcessTable.test.tsx` — reject empty `id` or `name` with validation error
- [x] 4.7 GREEN: implement `ProcessTable` in `src/components/ProcessTable.tsx` against frozen `ProcessTableProps { processes: ProcessInput[]; onChange: (processes: ProcessInput[]) => void }` with CRUD + positive-numeric/non-empty validation
- [x] 4.8 REFACTOR: `src/components/ProcessTable.tsx`

## Integrante 5 — Panel de metricas + integracion/testing (facil, depende de 1-4)
`src/components/StatsPanel.tsx`, `src/App.tsx` (start only after units 1-4 land)

- [ ] 5.1 RED: `src/components/StatsPanel.test.tsx` — averages equal sum/3 of `waitingTime`/`turnaroundTime` across 3 `processResults`
- [ ] 5.2 RED: `src/components/StatsPanel.test.tsx` — each process row shows `arrivalTime`, `startTime`, `finishTime`, `waitingTime`, `turnaroundTime`
- [ ] 5.3 GREEN: implement `StatsPanel` in `src/components/StatsPanel.tsx` against frozen `StatsPanelProps { processResults, averageWaitingTime, averageTurnaroundTime }`
- [ ] 5.4 REFACTOR: `src/components/StatsPanel.tsx`
- [ ] 5.5 Wire `src/App.tsx`: algorithm picker (`SJF`|`RR`) + conditional quantum input, Run button invoking `schedule()`, load/save via `xlsxIO`, `ProcessTable` for CRUD, `GanttChart`/`StatsPanel` for results
- [ ] 5.6 RED: `src/App.test.tsx` — selecting `RR` with `quantum = 4` and clicking Run invokes engine with `quantum = 4`, Gantt/stats reflect result
- [ ] 5.7 RED: `src/App.test.tsx` — switching from a completed RR run to `SJF` and running again replaces (not merges) prior results in Gantt and stats
- [ ] 5.8 GREEN: finish `src/App.tsx` state wiring so 5.6/5.7 pass
- [ ] 5.9 Manual integration pass: run `npm run build`, `npm run lint`, and `npm run test` across all 5 units' files; confirm no leftover "pendiente de implementacion" throws remain anywhere in `src/`
