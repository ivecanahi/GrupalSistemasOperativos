# Stats and Integration Specification

## Purpose

Compute/display waiting and turnaround statistics from a `SchedulingResult`
and wire the engine, xlsx I/O, table, and Gantt view together in `src/App.tsx`.

## Requirements

### Requirement: Average Waiting and Turnaround Time

The system MUST compute `averageWaitingTime` and `averageTurnaroundTime` as
the arithmetic mean of `waitingTime` and `turnaroundTime` across all entries
in `processResults`, and MUST display both values after a run.

#### Scenario: Averages match computed values

- GIVEN a `SchedulingResult` with 3 `processResults` entries
- WHEN the stats panel renders
- THEN it displays `averageWaitingTime` and `averageTurnaroundTime` equal to the sum of each field divided by 3

### Requirement: Per-Process Entry/Exit Time Display

For each entry in `processResults`, the system MUST display `arrivalTime`,
`startTime` (entry), and `finishTime` (exit), alongside `waitingTime` and
`turnaroundTime`.

#### Scenario: Per-process row shows all timing fields

- GIVEN a completed scheduling run
- WHEN the stats view renders
- THEN each process row shows arrivalTime, startTime, finishTime, waitingTime, and turnaroundTime

### Requirement: End-to-End Wiring

The system MUST let the user pick `SchedulerConfig.algorithm` (`SJF` | `RR`)
and, when `RR`, a `quantum`, trigger a run, and see the resulting timeline,
per-process stats, and averages reflected consistently in the Gantt view and
stats panel.

#### Scenario: Run RR with a chosen quantum

- GIVEN the user selects `RR` and sets `quantum = 4`
- WHEN they click Run
- THEN the engine is invoked with `quantum = 4` and the Gantt/stats views reflect that result

#### Scenario: Switching algorithm replaces prior results

- GIVEN a completed RR run is displayed
- WHEN the user switches to `SJF` and clicks Run again
- THEN the previous RR results are replaced (not merged) by the new SJF results across Gantt and stats views
