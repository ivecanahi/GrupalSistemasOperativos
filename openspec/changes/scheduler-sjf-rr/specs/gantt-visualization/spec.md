# Gantt Visualization Specification

## Purpose

Render a `SchedulingResult.timeline` (`ExecutionSlice[]`) as a proportional,
per-process-colored Gantt chart, including idle gaps.

## Requirements

### Requirement: Proportional Timeline Rendering

The system MUST render each `ExecutionSlice` with a visual width/length
proportional to its duration (`end - start`) relative to the total timeline
span.

#### Scenario: Slices proportional to duration

- GIVEN a timeline with slices of duration 2, 5, and 3 time units
- WHEN rendered
- THEN the rendered widths are proportional to 2:5:3

### Requirement: Distinct Per-Process Color

The system MUST assign each distinct `processId` a consistent, visually
distinguishable color across all of its slices in the timeline.

#### Scenario: Same process keeps same color across slices

- GIVEN process P has two non-contiguous slices in the timeline (Round Robin)
- WHEN rendered
- THEN both slices for P use the same color, distinct from other processes' colors

### Requirement: Idle Gap Indication

The system MUST visually indicate any interval of the timeline not covered by
an `ExecutionSlice` (CPU idle) as distinct from executing slices.

#### Scenario: Idle gap before first arrival

- GIVEN the first process arrives at time 3 (no slice covers [0,3))
- WHEN rendered
- THEN the [0,3) interval is shown as a distinct idle gap, not as execution

#### Scenario: Empty timeline renders without error

- GIVEN an empty timeline (no processes scheduled)
- WHEN rendered
- THEN the component renders a placeholder/empty state without throwing
