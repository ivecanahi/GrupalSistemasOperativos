# Design: CPU Scheduling Simulator (SJF + Round Robin), 5-Way Parallel Split

## Technical Approach

Client-side Vite + React 19 + TypeScript app, no backend, already scaffolded
with 7 stub files that throw `pendiente de implementación`. `src/types/scheduling.ts`
(`ProcessInput`, `ExecutionSlice`, `ProcessResult`, `SchedulingResult`,
`Algorithm`, `SchedulerConfig`) is frozen and is the sole cross-unit contract —
not re-decided here. xlsx I/O uses SheetJS's own CDN `.tgz` build (already
pinned in `package.json`), not npm's `xlsx` (2 unpatched CVEs) — not
re-decided here. Each of the 5 capabilities maps 1:1 to an existing stub file
and can be implemented, tested, and reviewed independently against that
frozen contract. This design adds the one missing piece that blocks all
TDD work — a test runner — and formalizes two contract-boundary decisions
the spec phase left open.

## Architecture Decisions

### Decision: Test runner — Vitest

**Choice**: Add `vitest` (+ `jsdom`, `@testing-library/react`,
`@testing-library/jest-dom` for component tests) as devDependencies.
Config: `vitest.config.ts` extending the existing Vite config,
`environment: 'jsdom'` globally (engine/lib tests don't need DOM but incur
negligible cost; avoids per-file `@vitest-environment` pragmas). Test files
are colocated: `src/core/sjf.test.ts`, `src/core/roundRobin.test.ts`,
`src/core/index.test.ts`, `src/lib/xlsxIO.test.ts`,
`src/components/ProcessTable.test.tsx`, `src/components/GanttChart.test.tsx`,
`src/components/StatsPanel.test.tsx`. Add `"test": "vitest run"` and
`"test:watch": "vitest"` to `package.json` scripts.

**Alternatives considered**: Jest (extra transform/ESM config fighting
Vite's native ESM+Rolldown pipeline, duplicate config surface); Node's
built-in test runner (no component-render story, no jsdom integration,
weaker assertion ergonomics for React).

**Rationale**: Vitest shares Vite's config/transform pipeline zero-config,
is the de facto standard for Vite projects, and unblocks Strict TDD on
module 1 (engine) immediately — the highest-test-density, hardest-to-get-
right module (tie-breaks, quantum rotation, idle gaps).

### Decision: Module interface contract — confirm existing stub signatures as frozen

**Choice**: The 5 modules already interface through concrete signatures
committed in the stub files; this design formalizes them as frozen (no
further negotiation needed):
- `schedule(processes: ProcessInput[], config: SchedulerConfig): SchedulingResult` (`src/core/index.ts`)
- `runSJF(processes: ProcessInput[]): SchedulingResult`
- `runRoundRobin(processes: ProcessInput[], quantum: number): SchedulingResult`
- `readProcessesFromXlsx(file: File): Promise<ProcessInput[]>`, `writeProcessesToXlsx(processes: ProcessInput[], filename: string): void`
- `ProcessTableProps { processes: ProcessInput[]; onChange: (processes: ProcessInput[]) => void }`
- `GanttChartProps { timeline: ExecutionSlice[] }`
- `StatsPanelProps { processResults: ProcessResult[]; averageWaitingTime: number; averageTurnaroundTime: number }`

**Alternatives considered**: Introducing new shared hooks/context to pass
data between modules — rejected, adds coupling and a 6th shared file that
would force sequencing instead of parallelism.

**Rationale**: Each function/component signature is a hard boundary; a
team member can implement and unit-test their file in isolation, mocking
only these already-typed signatures. `src/App.tsx` (module 5) is the only
integration point and is explicitly last-in-dependency-order per the
proposal.

### Decision: Process `id` uniqueness — explicitly deferred

**Choice**: Do NOT add a duplicate-id constraint in this change. The
accepted `process-input-table` spec only requires positive-numeric /
non-empty validation; adding a uniqueness rule now would silently expand a
locked spec outside the design phase's authority.

**Alternatives considered**: Add client-side duplicate-id rejection in
`ProcessTable` now — rejected because it changes accepted spec behavior
without a spec-phase amendment, and is not required by any of the 5 specs'
scenarios.

**Rationale**: Keeps design consistent with locked specs. Documented as a
known limitation: duplicate ids could produce ambiguous SJF tie-breaks and
key collisions if `processResults`/Gantt coloring key by `processId`.
Recommend a follow-up change to add duplicate-id validation; not a blocker
for this change's success criteria.

## Data Flow

    ProcessTable (CRUD) ──┐
    xlsxIO.readProcesses ─┴──→ App.tsx `processes` state
                                     │
                          schedule(processes, config)
                                     │
                        ┌────────────┴────────────┐
                     runSJF                  runRoundRobin
                        └────────────┬────────────┘
                              SchedulingResult
                                     │
                        ┌────────────┴────────────┐
                   GanttChart                 StatsPanel
                (timeline)                (processResults, averages)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/core/sjf.ts` | Modify | Implement non-preemptive SJF per spec tie-break rules |
| `src/core/roundRobin.ts` | Modify | Implement RR with runtime quantum, circular queue, simultaneous-arrival tie-break |
| `src/lib/xlsxIO.ts` | Modify | Implement strict-validate-then-import read; column-mapped write |
| `src/components/ProcessTable.tsx` | Modify | CRUD form/table with validation |
| `src/components/GanttChart.tsx` | Modify | Proportional, per-process-colored timeline with idle gaps |
| `src/components/StatsPanel.tsx` | Modify | Per-process rows + averages |
| `src/App.tsx` | Modify | Finish wiring (already mostly wired) |
| `src/core/*.test.ts`, `src/lib/xlsxIO.test.ts`, `src/components/*.test.tsx` | Create | Vitest specs, one per module |
| `vitest.config.ts` | Create | Vitest config extending Vite config, jsdom environment |
| `package.json` | Modify | Add vitest/testing-library devDependencies + test scripts |

## Interfaces / Contracts

See `src/types/scheduling.ts` (unchanged) and the frozen function/prop
signatures listed under "Module interface contract" above — no new types
introduced.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | SJF/RR tie-breaks, idle gaps, quantum rotation | Vitest, table-driven cases per spec scenario |
| Unit | xlsx malformed-file all-or-nothing rejection | Vitest with in-memory `File`/`ArrayBuffer` fixtures |
| Component | ProcessTable CRUD + validation, GanttChart proportional/idle rendering, StatsPanel averages | Vitest + Testing Library, jsdom |
| Integration | End-to-end run (select algorithm → schedule → Gantt/stats reflect result) | Vitest + Testing Library on `App.tsx` |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file
classification, or process-integration boundary. xlsx handling is
client-side `File`/`ArrayBuffer` parsing only.

## Migration / Rollout

No migration required. Each unit's changes are isolated to its own file(s);
rollback per-file via git. `src/types/scheduling.ts` stays frozen and
unchanged throughout.

## Open Questions

- [ ] Should a follow-up change add duplicate-`id` validation to
      `process-input-table`? (Deferred, not blocking.)
