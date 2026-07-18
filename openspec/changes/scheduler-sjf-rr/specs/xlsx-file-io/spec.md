# XLSX File I/O Specification

## Purpose

Load and save the process list exclusively via `.xlsx` files (SheetJS CDN
build), with strict validation and no partial imports.

## Requirements

### Requirement: XLSX-Only File Format

The system MUST restrict file load and save operations to the `.xlsx`
format. It MUST NOT accept `.csv`, `.xls`, `.ods`, or any other extension for
loading.

#### Scenario: Reject non-xlsx file on load

- GIVEN a user selects a `.csv` or `.xls` file
- WHEN the load action runs
- THEN the system rejects the file with a clear error and imports nothing

#### Scenario: Save produces xlsx

- GIVEN a current list of processes
- WHEN the user saves/exports
- THEN a valid `.xlsx` file is produced containing columns `id, name, arrivalTime, burstTime`

### Requirement: Required Columns

Every row in a loaded `.xlsx` file MUST contain non-empty `id` and `name`
values and numeric `arrivalTime` and `burstTime` values.

#### Scenario: Valid file loads all rows

- GIVEN an `.xlsx` file where every row has id, name, and numeric arrivalTime/burstTime
- WHEN loaded
- THEN all rows are imported as `ProcessInput[]`

### Requirement: Reject Entire File on Any Invalid Row

If ANY row in the loaded file fails validation (missing required column,
non-numeric `arrivalTime` or `burstTime`, empty `id`/`name`, etc.), the
system MUST reject the ENTIRE file and import ZERO rows. It MUST display a
clear, user-facing error identifying that the file was rejected. Partial
import MUST NOT occur.

#### Scenario: One row missing a required column

- GIVEN an `.xlsx` file where one row is missing `burstTime`
- WHEN the file is loaded
- THEN the system imports zero rows, leaves any existing process list unchanged, and shows a clear error

#### Scenario: One row has non-numeric arrivalTime

- GIVEN an `.xlsx` file where one row has text (e.g., "abc") in `arrivalTime`
- WHEN the file is loaded
- THEN the system rejects the entire file with a clear error and imports nothing

#### Scenario: All rows valid except one bad type

- GIVEN a file with 10 valid rows and 1 row with a non-numeric `burstTime`
- WHEN loaded
- THEN none of the 10 valid rows are imported; the whole file is rejected
