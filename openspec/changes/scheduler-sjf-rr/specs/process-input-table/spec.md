# Process Input Table Specification

## Purpose

Manual CRUD UI for building/editing the `ProcessInput[]` list fed into the
scheduling engine, with input validation.

## Requirements

### Requirement: CRUD Operations on Process Rows

The system MUST allow adding, editing, and deleting `ProcessInput` rows in
the table. Deleting a row MUST remove it from the list used as scheduling
input.

#### Scenario: Add a valid row

- GIVEN valid id, name, arrivalTime, and burstTime values
- WHEN the user submits the add form
- THEN a new `ProcessInput` row appears in the table

#### Scenario: Edit an existing row

- GIVEN an existing row
- WHEN the user edits `burstTime` to a new valid positive number and saves
- THEN the row reflects the updated value

#### Scenario: Delete a row

- GIVEN an existing row
- WHEN the user deletes it
- THEN it is removed from the table and excluded from the next scheduling run

### Requirement: Positive Numeric Validation

The system MUST validate that `arrivalTime` and `burstTime` are numeric and
strictly greater than zero, and that `id` and `name` are non-empty, before
accepting an add or edit operation.

#### Scenario: Reject non-positive arrivalTime

- GIVEN a user enters `arrivalTime = 0` or a negative number
- WHEN they submit
- THEN the system shows a validation error and does not add/update the row

#### Scenario: Reject non-numeric burstTime

- GIVEN a user enters non-numeric text for `burstTime`
- WHEN they submit
- THEN the system shows a validation error and does not add/update the row

#### Scenario: Reject empty id or name

- GIVEN a user leaves `id` or `name` empty
- WHEN they submit
- THEN the system shows a validation error and does not add/update the row
