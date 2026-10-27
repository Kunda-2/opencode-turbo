# Timeclock

    node cli.js --json <punches.csv> [--shift-end HH:MM] [--month YYYY-MM] [--rate N]

Reads a punch export and prints exactly one JSON object to stdout, then exits 0.

## Modules

Five CommonJS files in this directory, no dependencies, no network:

- `parse.js` — `parse(text)` returns the CSV rows as arrays of raw string fields, header row included.
- `pairs.js` — `pair(punches, shiftEnd)` where `shiftEnd` is `"HH:MM"`; returns `{shifts, errors}`.
  A shift is `{employee, date, from, to}` (`from`/`to` are minutes, `date` is `YYYY-MM-DD`).
- `rules.js` — `buildReport(shifts, errors, {rate, month})` returns the report object described under Output.
- `store.js` — `load(path)` / `save(path, punches)`, see "Punch store".
- `cli.js` — argument parsing, file reading, calling the three modules above, printing the JSON.

## Input format

- The first line is the header `employee,timestamp,kind`.
- Fields may be double-quoted. A quoted field may contain commas. Inside a quoted field `""` is an
  escaped quote.
- Lines may end with LF or CRLF. Blank lines are skipped and are not rows.
- `timestamp` is `YYYY-MM-DDTHH:MM` in UTC.
- `kind` is `in` or `out`.

## Pairing punches into shifts

Punches are handled per employee, in ascending timestamp order (equal timestamps keep file order).
For one employee:

- `in` with no open shift starts a shift.
- `out` with an open shift closes it. The shift date is the UTC date of its `in` punch; worked
  minutes are `out - in`.
- `out` with no open shift is an error row with reason `out without in`; the punch is ignored.
- `in` while a shift is already open is an error row with reason `in without out`; the new `in` is
  ignored and the already open shift stays open.
- `in` still open when the employee runs out of punches closes at `--shift-end` (default `18:00`)
  on the date of the `in` punch, and the shift is *inferred*. If that shift end is not later than
  the `in` time, the shift ends at `23:59` of the same date instead; it is still inferred.

## Daily rules

Shifts are grouped by employee + shift date (several shifts on one employee+date add up to one day).

For each employee+date:

- `raw` = sum of the shift minutes.
- Break: if `raw > 360`, subtract 30 minutes. `raw` of exactly 360 gets no deduction.
- Round the result UP to the next multiple of 15 minutes: `workedMinutes`.
- `overtimeMinutes` = `workedMinutes - 480` when that is positive, else `0`.
- The day's regular minutes are `workedMinutes - overtimeMinutes` (at most 480 per day).
- `inferred` is `true` when any shift of that day was inferred, else `false`.

Overtime is a daily figure: 1.5x. Regular minutes are added up per employee over the whole file;
Monday–Sunday weeks only group the days, there is no weekly cap and no weekly overtime.

## Pay

`--rate` is the hourly rate, default `100`. Per employee:

    pay = round2((regularMinutes + 1.5 * overtimeMinutes) * rate / 60)

`round2` is half away from zero to 2 decimals.

## Punch store

`store.js` persists punches as JSON `{"punches":[...]}`; a punch is `{employee, timestamp, kind}`.

- `load(path)` returns the punch array, or `[]` when the file does not exist.
- `save(path, punches)` keeps the entries already in the file, then appends the given punches in
  order, skipping any punch whose `employee`, `timestamp` and `kind` all match an entry that is
  already present. Saving the same punch twice therefore yields one entry.

## Output

    {"employees":{"<name>":{"days":[{"date":"YYYY-MM-DD","workedMinutes":n,"overtimeMinutes":n,"inferred":bool}],"regularMinutes":n,"overtimeMinutes":n,"pay":n}},"errors":[{"employee":"..","timestamp":"..","reason":".."}],"totals":{"regularMinutes":n,"overtimeMinutes":n,"pay":n}}

- Only employees with at least one day appear in `employees`; error-only employees do not.
- `days` is sorted by date ascending.
- `employees` keys are sorted ascending (plain code-unit string order, so `"Dana, Q"` sorts before
  `"Ed"`).
- `errors` holds one entry per error row, with the offending punch's `employee` and `timestamp` and
  the exact reason string. It is sorted by timestamp ascending, then employee ascending.
- `totals.regularMinutes` and `totals.overtimeMinutes` are the sums over employees;
  `totals.pay` is `round2` of the sum of the employee pays.
- `--month YYYY-MM` keeps only days whose `date` starts with that month, before any totals and
  before pay. Errors are reported whether or not they fall in that month.
- Values are JSON numbers.

## Errors

Exit with status 2, writing no JSON, when

- `--json` is missing or has no path, or an unknown argument appears,
- `--shift-end`, `--month` or `--rate` has a malformed value,
- the file cannot be read,
- the first line is not the header, a data row does not have exactly 3 fields, a timestamp is not
  a valid `YYYY-MM-DDTHH:MM` UTC timestamp, or `kind` is neither `in` nor `out`.
