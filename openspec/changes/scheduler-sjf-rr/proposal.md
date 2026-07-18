# Proposal: CPU Scheduling Simulator (SJF + Round Robin), Split Across 5 Parallel Work Units

## Intent

The repo has frozen types, wired UI shell, and 7 stub files that all throw
"pendiente de implementación." A 5-person student team needs to build the
remaining logic in parallel without file collisions. This proposal formalizes
that split: one work unit per person, `src/types/scheduling.ts` as the frozen
contract between them, so implementation, spec, design, and tasks phases can
proceed per-unit instead of as one monolithic change.

## Scope

### In Scope
- SJF (non-preemptive) engine: tie-break by arrivalTime then id.
- Round Robin engine: runtime-configured quantum, circular queue, mid-quantum
  arrival handling, CPU idle gaps.
- xlsx-only load/save (SheetJS CDN build), required columns
  (id, name, arrivalTime, burstTime), malformed-file handling.
- Gantt-style timeline visualization, proportional to time, per-process color.
- Manual process CRUD table with validation.
- Stats panel (avg waiting time, avg turnaround time) + end-to-end wiring/testing
  across all 5 units.
- Documenting the 5-way ownership split as the contract for downstream spec/tasks phases.

### Out of Scope
- Preemptive SJF, priority scheduling, multilevel feedback queues.
- Any file format other than `.xlsx` (explicitly rejected, not deferred).
- Backend/server persistence — stays fully client-side.
- Adding a test runner is NOT in this proposal's scope but is flagged as a
  hard prerequisite risk (see Risks) since Strict TDD is globally enabled.

## Capabilities

### New Capabilities
- `scheduling-engine`: SJF + RR core algorithms (src/core/*).
- `xlsx-file-io`: load/save restricted to `.xlsx` via SheetJS CDN build (src/lib/xlsxIO.ts).
- `gantt-visualization`: timeline rendering of execution slices (src/components/GanttChart.tsx).
- `process-input-table`: manual process CRUD UI (src/components/ProcessTable.tsx).
- `stats-and-integration`: waiting/turnaround stats + App-level wiring and manual/e2e testing (src/components/StatsPanel.tsx, src/App.tsx).

### Modified Capabilities
- None — no existing specs precede this change.

## Approach

Keep `src/types/scheduling.ts` frozen as the sole cross-unit contract. Each of
the 5 capabilities gets its own delta spec and can be designed/tasked/applied
independently once specs exist, since stub signatures already define the
boundaries. Integration (unit 5) is intentionally last-in-dependency-order.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/core/sjf.ts`, `src/core/roundRobin.ts`, `src/core/index.ts` | Modified | Replace stub throws with real SJF/RR logic |
| `src/lib/xlsxIO.ts` | Modified | Implement xlsx-only read/write |
| `src/components/GanttChart.tsx` | Modified | Implement timeline rendering |
| `src/components/ProcessTable.tsx` | Modified | Implement CRUD form/table |
| `src/components/StatsPanel.tsx`, `src/App.tsx` | Modified | Implement stats calc + finish integration |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| No test runner installed; Strict TDD is enabled globally | High | Add vitest as a prerequisite task before engine (unit 1) work starts |
| RR mid-quantum-arrival queue order is ambiguous | Med | Resolve explicitly in spec phase (arrived process joins queue after the preempted one) |
| xlsx malformed-file behavior undefined | Med | Resolve explicitly in spec phase (reject with user-facing error, no partial import) |
| Parallel work still touches shared `src/App.tsx` (unit 5) | Med | Unit 5 starts last, after other 4 stub replacements land |

## Rollback Plan

Each unit's changes are isolated to its own file(s); revert per-file via git if
a unit's implementation breaks integration. No shared state is mutated outside
`src/types/scheduling.ts`, which stays frozen and unchanged.

## Dependencies

- Unit 5 (stats + integration) depends on units 1-4 being functionally complete.
- Vitest (or equivalent) must be added before unit 1 (engine) applies TDD.

## Success Criteria

- [ ] SJF and RR both run correctly from UI-selected input, including runtime quantum.
- [ ] Load/save works exclusively via `.xlsx`; other formats are rejected.
- [ ] Gantt view and stats (avg waiting/turnaround) render correctly end-to-end.
- [ ] All 5 stub files have real implementations with no leftover "pendiente" throws.

## Proposal question round

Two ambiguities remain despite the agreed functional requirements; proposed
resolution is provisional pending user confirmation before spec phase locks
behavior:

1. **RR mid-quantum arrival ordering**: when a new process arrives at the exact
   instant a quantum expires, does it join the ready queue before or after the
   process just preempted? Assumption used above: after (arrived-then-preempted order).
2. **xlsx malformed-file handling**: on missing/invalid columns or bad types,
   should the app reject the whole file with an error, or import valid rows and
   skip invalid ones? Assumption used above: reject whole file, no partial import.

If either assumption is wrong, correct it before sdd-spec locks the delta specs;
otherwise these will be formalized as-is.
