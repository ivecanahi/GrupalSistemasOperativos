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

- [x] 5.1 RED: `src/components/StatsPanel.test.tsx` — averages equal sum/3 of `waitingTime`/`turnaroundTime` across 3 `processResults`
- [x] 5.2 RED: `src/components/StatsPanel.test.tsx` — each process row shows `arrivalTime`, `startTime`, `finishTime`, `waitingTime`, `turnaroundTime`
- [x] 5.3 GREEN: implement `StatsPanel` in `src/components/StatsPanel.tsx` against frozen `StatsPanelProps { processResults, averageWaitingTime, averageTurnaroundTime }`
- [x] 5.4 REFACTOR: `src/components/StatsPanel.tsx`
- [x] 5.5 Wire `src/App.tsx`: algorithm picker (`SJF`|`RR`) + conditional quantum input, Run button invoking `schedule()`, load/save via `xlsxIO`, `ProcessTable` for CRUD, `GanttChart`/`StatsPanel` for results (confirmed already wired from an earlier session; no changes needed)
- [x] 5.6 RED: `src/App.test.tsx` — selecting `RR` with `quantum = 4` and clicking Run invokes engine with `quantum = 4`, Gantt/stats reflect result (passed against existing App.tsx on first run — proves the wiring, no gap found)
- [x] 5.7 RED: `src/App.test.tsx` — switching from a completed RR run to `SJF` and running again replaces (not merges) prior results in Gantt and stats (passed against existing App.tsx on first run — proves replace-not-merge behavior, no gap found)
- [x] 5.8 GREEN: finish `src/App.tsx` state wiring so 5.6/5.7 pass (not needed — 5.6/5.7 passed without any App.tsx change; `setResult(...)` already fully replaces prior state)
- [x] 5.9 Manual integration pass: `npm run build` (tsc -b + vite build) succeeds; `npx oxlint` zero errors; `npx vitest run` 94/94 passing (90 baseline + 4 new, zero regressions); `grep -rn "pendiente de implementaci" src/` returns nothing

## Add-on — I/O burst simulation + queue diagram (post-hoc, applied directly by orchestrator design)

Not part of the original 5-way split; appended here as the durable record of
completed work since this change folder is the only active one. Additive-only
to `src/types/scheduling.ts` (`ioBurstTime`, `QueueSlice`, `QueueTimelines`,
`SchedulingResult.queues`); `src/core/sjf.ts`/`src/core/roundRobin.ts`
untouched (confirmed zero diff).

- [x] A.1 RED/GREEN: `src/core/queues.ts` + `queues.test.ts` — `buildQueueTimelines` (cpu/ready/io lane derivation, RR preemption gaps, I/O slice)
- [x] A.2 Wire `src/core/index.ts`: `schedule()` builds `queues`, adjusts `finishTime`/`turnaroundTime` per `ioBurstTime`, recomputes `averageTurnaroundTime`; `waitingTime`/`averageWaitingTime` unchanged. Appended 4 tests to `src/core/index.test.ts`
- [x] A.3 `src/lib/seriesColors.ts` extracted from `GanttChart.tsx` (`SERIES_COLORS`, `buildColorMap`); `GanttChart.tsx` refactored to use it — `GanttChartProps` and `GanttChart.test.tsx` unchanged
- [x] A.4 RED/GREEN: `src/lib/lanePacking.ts` + `lanePacking.test.ts` — greedy interval packing (`packIntervals`) for overlapping ready/io lanes
- [x] A.5 RED/GREEN: `src/components/QueueLanes.tsx` + `QueueLanes.test.tsx` — 3 stacked lanes (CPU/Listos/E-S), shared color map, track packing
- [x] A.6 `src/App.css` — `.queue-lanes`/`.queue-lane*` rules reusing existing tokens
- [x] A.7 `src/components/ProcessTable.tsx` + `ProcessTable.test.tsx` — optional `ioBurstTime` field in add/edit forms, validation (blank = valid/undefined, non-blank must be finite > 0), +3 tests
- [x] A.8 `src/App.tsx` — `QueueLanes` wired right after `GanttChart` inside the same Gantt card
- [x] A.9 Verification: `npx vitest run` 71/71 passing (47 baseline + 24 new, zero regressions); `npx tsc -b` zero errors; `npx oxlint` zero errors; `git diff --stat -- src/core/sjf.ts src/core/roundRobin.ts` empty; `GanttChartProps` confirmed still `{ timeline: ExecutionSlice[] }`

Note: pre-existing uncommitted drift was found in `src/index.css` and most of
`src/App.css`/`ProcessTable.tsx`/`GanttChart.tsx` from prior (uncommitted)
unit work, unrelated to this add-on — `src/index.css` was not touched here.

## Add-on 2 — Mid-burst I/O interruption (post-hoc, applied directly by orchestrator design)

Replaces the previous "I/O only after full burst" model (Add-on 1, A.1-A.9)
with a genuinely interruptible model: a process runs part of its CPU burst,
releases the CPU (so other processes can run), does I/O, then returns to run
its remaining CPU burst. `src/types/scheduling.ts` extended additively only
(`ProcessInput.ioTriggerAfter`, `SchedulingResult.ioTimeline`).

- [x] B.1 `src/types/scheduling.ts` — add `ProcessInput.ioTriggerAfter?` and
      `SchedulingResult.ioTimeline?` (additive only)
- [x] B.2 RED/GREEN: `src/core/sjf.ts` — rewrite dispatch loop for two-phase
      (phase1/io/phase2) processes; degrades exactly to legacy behavior when
      `ioBurstTime` is unset; +4 tests in `sjf.test.ts` (phase1/io/phase2
      slice proof, CPU-freed-during-io proof, waiting/turnaround formula,
      legacy io-after-full-burst equivalence); 7 baseline tests unmodified
- [x] B.3 RED/GREEN: `src/core/roundRobin.ts` — add `pendingIo`/merged
      `enqueueReady` event source (fresh arrivals + I/O-returns merged by
      readyTime then id, Silberschatz ordering preserved); +4 tests in
      `roundRobin.test.ts` (preempt-before-io-trigger, multi-quantum
      phase1/phase2, CPU-freed-during-io proof, simultaneous-readyTime merge
      order); 10 baseline tests unmodified
- [x] B.4 `src/core/queues.ts` — simplified to take the engine's own
      `ioTimeline` directly instead of deriving I/O from `cpuFinishTimes`;
      `ready` lane gap-vs-io-interval alignment logic; signature change
      reflected in `queues.test.ts` (5 baseline scenarios adapted to new
      signature + 2 new mid-burst-io scenarios)
- [x] B.5 `src/core/index.ts` — simplified `schedule()`; no more manual
      finishTime/turnaround post-adjustment (engines compute it internally
      now); `index.test.ts` I/O-adjustment tests kept (outcome unchanged) +1
      new end-to-end mid-burst-io test
- [x] B.6 `src/components/ProcessTable.tsx` — merged Id+Nombre into single
      "Proceso" column (mirrors into `name`), added `ioTriggerAfter` field
      paired with `ioBurstTime` validation (both-or-neither, range checks);
      `ProcessTable.test.tsx` adapted (name field removed from test helper) +
      5 new tests for the io pair validation
- [x] B.7 Wired Excel import/export controls into `ProcessTable.tsx` (file
      input + export button, calling the already-implemented
      `readProcessesFromXlsx`/`writeProcessesToXlsx`); extended
      `src/lib/xlsxIO.ts` with optional `ioBurstTime`/`ioTriggerAfter`
      columns on both read and write; +3 tests in `xlsxIO.test.ts`
      (round-trip, bad-optional-value rejection, columns-absent import)
- [x] B.8 `src/components/QueueLanes.tsx` — added a `.queue-axis` time-axis
      row with ms tick marks under the 3 lanes; matching CSS in
      `src/App.css`; +1 test in `QueueLanes.test.tsx`
- [x] B.9 Verification: `npx vitest run` 90/90 passing (71 baseline + 19
      new, zero regressions in sjf/roundRobin/index/queues/ProcessTable/
      xlsxIO/QueueLanes test files); `npx tsc -b` zero errors; `npx oxlint`
      zero errors; `GanttChartProps` confirmed still
      `{ timeline: ExecutionSlice[] }` (untouched)

## Add-on 3 — Multi-op I/O per process + clear-Spanish validation messages
(post-hoc, applied directly by orchestrator design)

Generalizes I/O from at-most-one interruption per process (Add-on 2) to any
number of I/O operations per process (run, I/O, run more, I/O again, ...).
`src/types/scheduling.ts` extended additively only (`IoOperation`,
`ProcessInput.ioOperations`); legacy `ioBurstTime`/`ioTriggerAfter` kept for
backward compatibility. Also rewrites every user-facing validation/import
message to plain, clear Spanish (no raw camelCase field names), and
translates `src/lib/xlsxIO.ts`'s previously-English messages to Spanish.

- [x] C.1 `src/types/scheduling.ts` — add `IoOperation { after; duration }`
      and `ProcessInput.ioOperations?: IoOperation[]` (additive only, legacy
      fields untouched)
- [x] C.2 RED/GREEN: `src/core/ioOperations.ts` + `.test.ts` —
      `normalizeIoOperations(p)` shared helper: empty when neither
      `ioOperations` nor legacy fields set; legacy pair normalizes to a
      1-element list (defaulting `after` to `burstTime` when
      `ioTriggerAfter` omitted); `ioOperations` takes precedence over legacy
      fields; always returned sorted by `after` ascending; 6 tests
- [x] C.3 RED/GREEN: `src/core/sjf.ts` — generalized the 2-phase
      (`phase1`/`phase2-ready`/`done`) state machine to an N-phase one
      (`opIndex`/`cpuConsumed`/`nextReadyTime` per process, driven by
      `normalizeIoOperations`); degrades exactly to legacy 0/1-op behavior
      (11 baseline tests unmodified, all still pass); +4 tests (3-op
      interleave with exact slice boundaries, CPU-freed-during-io proof
      with a second process, `ioOperations` precedence over legacy fields,
      multi-op waiting/turnaround formula)
- [x] C.4 RED/GREEN: `src/core/roundRobin.ts` — generalized
      `phase1Duration`/`hasPendingIo` bookkeeping to `ops`/`opIndex`/
      `cpuConsumed` maps per process, reusing the same `enqueueReady`/
      `pendingIo`/Silberschatz-ordering machinery (renamed
      `PendingIo.phase2Duration` → `nextRemaining`, semantics generalized);
      fixed a bug found in intermediate implementation where `cpuConsumed`
      was only incremented on the phase-exhausting quantum instead of every
      quantum (losing prior partial-quantum contributions to the same
      phase) — fix: increment `cpuConsumed` unconditionally on every
      dispatch, not only inside the exhausted-phase branch; 14 baseline
      tests unmodified, all still pass; +4 tests (multi-quantum multi-op
      cycling, CPU-freed-during-io proof, `ioOperations` precedence,
      multi-op waiting/turnaround formula)
- [x] C.5 `src/core/queues.ts` — confirmed via +1 new test
      (`queues.test.ts`) that the existing per-gap
      `ownIo.find(s => s.start === cursor)` logic already generalizes
      correctly to 2+ io operations per process with zero code changes
      needed (each gap in a process's own-slice sequence still aligns with
      at most one io interval's start, regardless of total op count)
- [x] C.6 `src/components/ProcessTable.tsx` — replaced the flat
      `ioBurstTime`/`ioTriggerAfter` draft fields with an `ioOperations:
      IoOperationDraft[]` list editor (`addIoOp`/`removeIoOp`/`updateIoOp`
      handlers, "+ Agregar E/S" button, "×" remove per row) in both the
      add-form and per-row edit mode; table's two separate io columns
      merged into one "Operaciones E/S" column showing a compact
      `after→duration, ...` summary (or "—") via
      `normalizeIoOperations`/`formatIoOperations`; `startEdit` now
      pre-populates the list via `normalizeIoOperations` so legacy-imported
      processes edit correctly; rewrote every validation message to plain
      Spanish with no raw field names (see below); `toProcessInput` no
      longer sets `ioBurstTime`/`ioTriggerAfter` from the UI (left
      `undefined`; still supported by the engine for import/backward-compat
      only)
- [x] C.7 `src/components/ProcessTable.test.tsx` — rewrote all validation
      assertions to match new Spanish wording (`/llegada/i`, `/ráfaga/i`,
      `/nombre/i`, `/ya existe/i`, etc. instead of `/arrivalTime/i` etc.);
      +13 new tests for the multi-op list editor (add 3 ops end-to-end,
      empty list → `ioOperations: undefined`, partially-filled row
      rejected, non-numeric/out-of-range `after`/`duration` rejected,
      duplicate `after` rejected, remove-row-before-submit, multi-op/dash/
      legacy-single-op table summary display, legacy-process edit
      pre-population); 22 tests total (9 baseline-equivalent + 13 new)
- [x] C.8 `src/lib/xlsxIO.ts` — translated every previously-English thrown
      message to clear Spanish (file-rejection wrapper, missing-worksheet,
      missing-required-column, empty-value, non-numeric-value,
      unreadable-workbook); added a unified `ioOperations` column
      (`"after:duration,after:duration"` format) to the write path,
      retiring the legacy `ioBurstTime`/`ioTriggerAfter` columns from
      WRITE (kept in read-side `OPTIONAL_COLUMNS` for backward
      compatibility with previously-exported files); read path prefers
      `ioOperations` over legacy columns when both are present on a row;
      malformed `after:duration` syntax or non-strictly-increasing `after`
      values reject the entire file with
      `` `la fila ${rowNumber} tiene un formato de E/S inválido` ``
- [x] C.9 `src/lib/xlsxIO.test.ts` — updated all message assertions to the
      new Spanish wording; +3 net new tests (3-op round-trip, malformed
      `ioOperations` cell rejects whole file, legacy flat-column file still
      imports); 15 tests total
- [x] C.10 Verification: `npx vitest run` 118/118 passing (94 baseline +
      24 new: 6 ioOperations + 4 sjf + 4 roundRobin + 1 queues + 6 net
      ProcessTable + 3 net xlsxIO, zero regressions); `npx tsc -b` zero
      errors; `npx oxlint` zero errors; hand-verified multi-op arithmetic
      for both `sjf.ts` and `roundRobin.ts` (see apply-progress notes);
      `grep -n "return '" src/components/ProcessTable.tsx` confirms no
      validation string contains a raw camelCase field name;
      `GanttChartProps`/`StatsPanelProps` confirmed untouched by this
      add-on (pre-existing uncommitted drift in `App.tsx`/`GanttChart.tsx`/
      `StatsPanel.tsx`/`App.css`/`index.css` predates this session and is
      unrelated)

## Add-on 4 — Purely visual/presentational dashboard redesign
(post-hoc, applied directly by orchestrator design)

Purely visual redesign matching a user-provided reference layout. Zero
changes to `src/core/sjf.ts`, `roundRobin.ts`, `mlq.ts`, `ioOperations.ts`,
`queues.ts`, `index.ts` (confirmed via mtimes predating this session — no
Read/Edit touched them). `src/components/GanttChart.tsx` (existing, tested,
`GanttChartProps { timeline: ExecutionSlice[] }` unchanged) reused verbatim
as the compact top-bar overview; its own test file untouched. `QueueLanes`
(component + test) retired/deleted, replaced by `QueueSection` (×2, one per
real queue: SJF and RR), `EventLog`, and `PerProcessGantt`.

- [x] D.1 `src/index.css` — reassigned the 8 `--series-N` hex values (light
      + dark blocks) to the new validated categorical order; `SERIES_COLORS`
      array structure in `src/lib/seriesColors.ts` left untouched (still
      references `--series-1..8` by CSS variable, just different hues now)
- [x] D.2 RED/GREEN: `src/lib/eventLog.ts` + `.test.ts` — pure derivation
      `buildEventLog(processes, result)`; one event per arrival/cpu-start/
      cpu-end/io-start/io-end/finish, sorted by time then fixed kind
      priority then ascending `processId`; 4 tests (no-io sequence, full
      io sequence, same-time tie-break, empty list)
- [x] D.3 `src/lib/contrastColor.ts` — small `pickTextColor(hex)` helper
      (YIQ perceived-brightness formula, threshold 128) returning
      `'light' | 'dark'`, used by `QueueSection` pills for readable text
      against any palette color (not covered by a dedicated test file;
      exercised indirectly through `QueueSection.test.tsx`)
- [x] D.4 RED/GREEN: `src/components/QueueSection.tsx` + `.test.tsx` — one
      "Cola — X" titled block: numbered ruler (sequential integers up to
      ~40ms span, evenly-spaced fallback beyond that), `packIntervals`-based
      pill tracks, `data-slice`/`data-color`/`data-width`/`data-track`/
      `data-text-color` attributes; 6 tests (title, ruler, proportional
      width, multi-track packing, empty state, contrast text color both
      ways)
- [x] D.5 RED/GREEN: `src/components/PerProcessGantt.tsx` + `.test.tsx` —
      `<h2>Diagrama de Gantt (CPU)</h2>` + subtitle, color legend (first-
      appearance order, shared `colorMap`), shared numbered ruler, one row
      per distinct process showing only its own slices, reuses `.gantt-slice`
      styling; empty-state message mirrors `GanttChart`'s; 6 tests (title/
      subtitle, legend count, per-row slice isolation, proportional width,
      empty state, legend/row color cross-check)
- [x] D.6 RED/GREEN: `src/components/EventLog.tsx` + `.test.tsx` —
      collapsed-by-default disclosure (`useState(false)`), header with
      chevron + count badge, expands to an ordered list of event labels with
      a `t=` time badge per row; collapsed state does not render list items
      (not just hidden); 4 tests (collapsed by default, expand shows all in
      order, re-collapse, empty events expanded message)
- [x] D.7 `src/App.tsx` — rewired section order: Métricas (unchanged) →
      `GanttChart` under a new "Línea de tiempo global" heading (unchanged
      props) → `QueueSection` ×2 (SJF-filtered and RR-filtered subsets of
      `result.queues.ready`, computed from `ranProcesses` mirroring the
      retired `QueueLanes` filter logic) → `EventLog` (fed
      `buildEventLog(ranProcesses, result)`) → `PerProcessGantt` (fed
      `result.timeline`); one shared `colorMap` built once via
      `buildColorMap(result.timeline.map(s => s.processId))` and passed to
      both `QueueSection` instances and `PerProcessGantt`
- [x] D.8 Deleted `src/components/QueueLanes.tsx` and
      `QueueLanes.test.tsx` (confirmed no other importers before deleting)
- [x] D.9 `src/App.css` — `box-shadow: var(--shadow)` added to `.card`
      (previously-unused custom property) + padding bump; replaced the
      retired `.queue-lanes*`/`.queue-lane-slice`/`.queue-axis*` rules with
      `.queue-section*`/`.queue-pill` (10px radius), `.per-process-gantt*`
      (reuses `.gantt-slice`'s existing 4px-radius styling for its blocks),
      and `.event-log*` (disclosure header, rotating chevron, count badge,
      list rows with time badge); every new/changed rule uses existing
      theme-aware custom properties, verified correct in both
      `prefers-color-scheme: light` and `dark`
- [x] D.10 Verification: `npx vitest run` 151/151 passing (143 baseline -
      12 retired `QueueLanes.test.tsx` tests + 20 new: 4 eventLog + 6
      QueueSection + 6 PerProcessGantt + 4 EventLog = 131 + 20 = 151, zero
      regressions elsewhere); `npx tsc -b` zero errors; `npx oxlint` zero
      errors (exit 0); `git diff --stat -- src/core/` shows only
      pre-existing drift from prior (uncommitted) sessions — confirmed via
      file mtimes that this add-on's session never opened/edited any
      `src/core/*` file; `GanttChartProps` still exactly
      `{ timeline: ExecutionSlice[] }`, `src/components/GanttChart.tsx`
      mtime predates this session (untouched); `StatsPanelProps` unchanged;
      all 8 `--series-N` hex values (light + dark) read back from
      `src/index.css` and confirmed to match the requested order exactly

## Add-on 5 — Strict-light-mode dashboard redesign (Sections 1-6 layout)
(post-hoc, applied directly by orchestrator design)

Purely visual/layout restructure into a fixed-order Sections 1-6 page (header
title + SJF/RR info cards, "1. Cargar datos del ejercicio", "2. Tabla de
procesos", "3. Desarrollo del ejercicio" strictly-vertical stack, "4. Resumen
del ejercicio", "5/6. Tiempo de espera promedio / Tiempo de ejecución medio"),
hardcoded to strict light mode via new `--page-bg`/`--card-bg`/
`--card-border`/`--text-strong`/`--text-muted`/`--card-shadow` tokens plus 4
new semantic section-chrome tokens (`--accent-sjf`/`--accent-rr`/
`--accent-io`/`--accent-cpu` + `-bg` variants), added to `src/index.css`
`:root` only (dark `@media` block untouched/unused by this redesign). Zero
changes to `src/core/sjf.ts`, `roundRobin.ts`, `mlq.ts`, `ioOperations.ts`,
`queues.ts`, `index.ts` (confirmed via mtimes predating this session — no
Read/Edit touched them; `git diff --stat -- src/core/` is non-empty only from
prior-session uncommitted drift). `GanttChart.tsx` and `EventLog.tsx` kept
importable/untouched but no longer rendered from `App.tsx` (superseded by the
new "Cola de CPU" `QueueSection` row and the removal of the event-log section
from the new fixed layout, per explicit instruction).

- [x] E.1 `src/index.css` — added the 6 new page/card tokens + 8 new accent
      tokens to `:root` only; `--series-1..8` values confirmed unchanged
- [x] E.2 RED/GREEN: `src/components/ProcessTable.tsx` +
      `ProcessTable.test.tsx` — added required `colorMap: Map<string,
      string>` prop, `.process-color-dot` swatch rendered before each
      process id (display row only) using `colorMap.get(process.id)`;
      relocated the Excel import/export controls (file input + export
      button + import error) out of `ProcessTable` entirely, up to
      `App.tsx`'s new Section 1 "Cargar desde Excel" card — import/export
      logic (`readProcessesFromXlsx`/`writeProcessesToXlsx`) and error
      handling kept byte-identical, just relocated; added `id="agregar-
      proceso"` to the existing add-process form div as Section 1's
      "Ingresar manualmente" anchor-link target; updated all 25 existing
      `render(<ProcessTable .../>)` call sites with a `colorMap` fixture
      (`new Map()`), +1 new test asserting the swatch color
- [x] E.3 RED/GREEN: `src/components/QueueSection.tsx` +
      `QueueSection.test.tsx` — added required `accent: 'sjf'|'rr'|'io'|
      'cpu'` prop applying `accent-${accent}` to the root
      `.queue-section` element (chrome only — individual pill colors still
      driven solely by `colorMap`, unchanged); updated all 6 existing tests
      with an `accent` prop, +4 new parametrized tests (one per accent
      value)
- [x] E.4 RED/GREEN: `src/components/PerProcessGantt.tsx` +
      `PerProcessGantt.test.tsx` — added optional `hideLegend?: boolean`
      (default `false`, fully backward-compatible) so `App.tsx` can drop
      the internal legend row (table swatches now serve as the page-wide
      process-color legend) without duplicating it; +1 new test
- [x] E.5 `src/components/StatsPanel.tsx` + `StatsPanel.test.tsx` —
      restructured into Section 4 only: kept the existing per-process
      table verbatim (task 5.2 intent preserved), replaced
      `averageWaitingTime`/`averageTurnaroundTime` props with a required
      `algorithm: Algorithm` prop, added an auto-generated summary
      paragraph (process count + algorithm label + makespan +
      ráfaga-promedio, all derived from already-available
      `processResults`/`processes`, no new formulas) and a
      `.metric-tile-sm-grid` of 4 tiles (número de procesos, tiempo total
      de simulación/makespan = `max(finishTime)`, ráfaga de CPU promedio =
      pre-existing `averageBurstTime` calc moved here, algoritmo);
      task 5.1's average-rendering intent moved to the new
      `AverageTimeCards` component/test file (see E.6)
- [x] E.6 RED/GREEN: `src/components/AverageTimeCards.tsx` +
      `AverageTimeCards.test.tsx` (new) — the two large Sections 5-6 cards
      ("Tiempo de espera promedio" accent-sjf / "Tiempo de ejecución medio"
      accent-rr), rendering the exact same `(w1 + w2 + ...) / n = avg`
      formula breakdown `StatsPanel` used to render, byte-identical
      data/formulas, split out only for layout; preserves task 5.1's intent
      explicitly
- [x] E.7 `src/App.tsx` — full restructure into Sections 1-6 in the exact
      requested order; shared `colorMap` now built from
      `processes.map(p => p.id)` (current table order, always available)
      instead of `result.timeline`, passed to `ProcessTable`, every
      `QueueSection`, and `PerProcessGantt`; Section 3's wrapper is
      `<div className="section-stack">` (`flex-direction: column`,
      verified below) containing, in order: Cola de SJF (accent-sjf,
      `queues.ready` filtered to SJF-queue processes), Cola de Round Robin
      (accent-rr, filtered to RR-queue), Cola de Operaciones de entrada/
      salida (accent-io, **unfiltered** combined `queues.io`, deliberate
      reversion per instruction), Cola de CPU (accent-cpu, `queues.cpu` fed
      into `QueueSection` instead of reusing `GanttChart`), Diagrama de
      Gantt (`PerProcessGantt` with `hideLegend`); `GanttChart` and
      `EventLog` no longer imported/rendered (files untouched); lifted
      `importError`/`handleImport`/`handleExport` from `ProcessTable` into
      `App.tsx`, rendered inside Section 1's "Cargar desde Excel" card;
      added static header (h1 + 2 info-cards) and Section 1's 2 option-cards
      (no logic, no test requirement per instruction)
- [x] E.8 `src/App.css` — added `.card-v2`, `.process-color-dot`,
      `.section-stack`, `.option-card`/`.info-card` (+ `-icon`/`-body`/
      `-title`/`-desc`), `.header-info-cards`/`.section1-cards` row
      wrappers, `.accent-sjf`/`.accent-rr`/`.accent-io`/`.accent-cpu`
      modifier classes (left border-stripe + title/icon color, composed
      onto `.queue-section`, `.info-card`, `.option-card`,
      `.avg-time-card-lg`), `.metric-tile-sm-grid`/`.metric-tile-sm` (the
      only grid in this redesign, per instruction), `.avg-time-cards`/
      `.avg-time-card-lg` (+ `-label`/`-value`/`-formula`); switched every
      touched/restyled rule (`.card-v2`, `.field`, `.btn*`, `.process-
      table*`, `.process-form*`, `.gantt*`, `.queue-*`, `.per-process-
      gantt*`) from the old adaptive tokens (`--bg`/`--code-bg`/`--text`/
      `--text-h`/`--border`/`--shadow`) to the new fixed-light tokens;
      left `--accent`/`--accent-bg`/`--accent-border`/`--danger`/
      `--danger-bg` untouched (no fixed-light replacement was specified
      for these in the request; primary/danger button hues may still
      shift 1 shade under OS dark-mode preference — noted as a scoped,
      deliberate, minor deviation, layout/structure unaffected); old
      `.card`/`.stat-tiles`/`.stat-tile*` rules left in place, unused/
      harmless (no longer referenced by `App.tsx`)
- [x] E.9 Verification: `npx vitest run` 162/162 passing (152 baseline +
      10 new: 1 ProcessTable swatch + 4 QueueSection accent + 1 StatsPanel
      net (2→3, one intent moved to AverageTimeCards) + 3 AverageTimeCards +
      1 PerProcessGantt hideLegend, zero regressions); `npx tsc -b` zero
      errors; `npx oxlint` / `npx oxlint src` zero errors (exit 0, sanity-
      checked against a deliberately-bad scratch file to confirm the
      linter runs — config only enables `correctness` + 2 explicit react
      rules by default, so this is consistent); `git diff --stat --
      src/core/` non-empty but 100% pre-existing uncommitted drift from
      prior sessions (confirmed via `stat` mtimes: all `src/core/*` files
      last modified before this session's first edit; this session never
      called Read/Edit on any `src/core/*` file); `--series-1..8` (light +
      dark) confirmed byte-identical to the pre-session values;
      `.section-stack { display: flex; flex-direction: column; gap: 20px;
      }` confirmed as the literal Section 3 wrapper rule; `GanttChartProps`
      still exactly `{ timeline: ExecutionSlice[] }`,
      `src/components/GanttChart.tsx` mtime predates this session
      (untouched, just unused from `App.tsx`)
