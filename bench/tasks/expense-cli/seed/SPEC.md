# Expense CLI

    node cli.js --json <file.csv>

Reads a CSV export and prints exactly one JSON object to stdout, then exits 0.

## Input format

- The first line is the header `date,employee,category,amount,currency`.
- Fields may be double-quoted. A quoted field may contain commas. Inside a quoted field `""` is an escaped quote.
- Lines may end with LF or CRLF. Blank lines are skipped and are not rows.
- `date` is an ISO date `YYYY-MM-DD` interpreted in UTC.
- `amount` is a decimal number.
- `currency` must be `CNY`.
- `category` is one of `meals`, `transport`, `hotel`, `other`.

## Rejected rows

A row is rejected and excluded from every total, category, employee and flag when

- its currency is not `CNY`, or
- its category is not one of the four listed above.

`rejected` is the number of such rows. Rejected rows never appear in `flagged`.

## Rounding

- Every row amount is rounded half away from zero to 2 decimals before it is used.
- Every total (`total`, each `byCategory` value, each `byEmployee` value and each `over` value)
  is rounded half away from zero to 2 decimals again.

## Caps

Per-category daily caps: `meals` 100, `transport` 200, `hotel` 600, `other` 0.

- If the row date is a Saturday or Sunday (UTC) the cap is multiplied by 1.5.
- A row is over cap when its rounded amount is greater than its effective cap.
  Because `other` has cap 0, every positive `other` row is over cap; it is never rejected.
- A row over cap still counts in `total`, `byCategory` and `byEmployee`.
- Each employee appears at most once in `flagged`, with
  `over` = the sum of `(rounded amount - effective cap)` over that employee's over-cap rows.

## Output

    {"total":n,"byCategory":{...},"byEmployee":{...},"flagged":[{"employee":"...","over":n}],"rejected":n}

- `total` is the sum of the rounded amounts of the accepted rows.
- `byCategory` maps category to the rounded sum of its accepted rows. Keys are sorted ascending.
- `byEmployee` maps employee to the rounded sum of their accepted rows. Keys are sorted ascending.
  Employees with no accepted rows do not appear.
- `flagged` is sorted by `over` descending; ties are broken by employee name ascending
  (plain code-unit string order, so `"Smith, John"` sorts before `"Zoe"`).
- Nothing besides that one JSON object is written to stdout.

## Errors

Exit with status 2 when arguments are missing or malformed (for example `--json` with no path),
and when the file cannot be read or its first line is not the header.
