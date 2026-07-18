# Scheduling Engine Specification

## Purpose

Core algorithms that turn a list of `ProcessInput` into a `SchedulingResult`
(timeline + per-process results + averages), per `src/types/scheduling.ts`.
Covers SJF (non-preemptive) and Round Robin (runtime-configurable quantum).

## Requirements

### Requirement: SJF Non-Preemptive Scheduling

The system MUST schedule processes using non-preemptive Shortest Job First:
at each decision point, among processes with `arrivalTime <= currentTime` that
have not yet run, it MUST select the one with the smallest `burstTime` and run
it to completion without interruption. Ties MUST be broken first by earliest
`arrivalTime`, then by ascending `id`.

#### Scenario: Shortest burst runs first among arrived processes

- GIVEN processes A(arrival=0, burst=8), B(arrival=1, burst=4), C(arrival=2, burst=2)
- WHEN scheduled with SJF
- THEN A runs first (only one arrived at t=0), then C, then B (shortest-burst-first among arrived)

#### Scenario: Tie-break by arrivalTime then id

- GIVEN two processes with identical `burstTime` and identical `arrivalTime`
- WHEN both are eligible to run
- THEN the process with the lexicographically smaller `id` runs first

#### Scenario: CPU idle before next arrival

- GIVEN no process has arrived yet at `currentTime`
- WHEN the engine advances
- THEN the clock jumps to the next process's `arrivalTime` and no `ExecutionSlice` is produced for the idle gap

### Requirement: Round Robin Scheduling with Runtime Quantum

The system MUST schedule processes using Round Robin with a `quantum` value
taken from `SchedulerConfig.quantum` at run time (not hard-coded). Each
process MUST run for at most `quantum` time units per turn, using a FIFO
circular ready queue; if a process's remaining burst exceeds `quantum`, it
MUST be requeued after being preempted.

#### Scenario: Process finishes within quantum

- GIVEN a process with remaining burst <= quantum
- WHEN its turn starts
- THEN it runs to completion and is not requeued

#### Scenario: Process exceeds quantum

- GIVEN a process with remaining burst > quantum
- WHEN its turn ends
- THEN it is preempted after exactly `quantum` units and moved to the back of the ready queue with reduced remaining burst

#### Scenario: CPU idle gap in Round Robin

- GIVEN the ready queue is empty and the next process has not yet arrived
- WHEN the engine advances
- THEN the clock jumps to the next arrival and no execution slice covers the gap

### Requirement: RR Tie-Break on Simultaneous Arrival and Quantum Expiry

When a new process arrives at the exact same time instant that the currently
running process's quantum expires, the system MUST enqueue the newly arrived
process BEFORE the interrupted (requeued) process, per the Silberschatz
convention.

#### Scenario: Simultaneous arrival and quantum expiry

- GIVEN process X is running and its quantum expires at time T
- AND process Y arrives at exactly time T
- WHEN both are placed into the ready queue
- THEN Y is enqueued ahead of X, so Y runs before X on the next cycle
