# CSV report

`data.csv` is a small expense export. Write `report.js`, run as:

    node report.js <file.csv>

It must print exactly one JSON object to stdout:

    {"rows":<int>,"total":<number>,"byCategory":{"<category>":<number>,...},"top":{"category":<string>,"amount":<number>}|null}

## Input format

- The first line is the header `date,description,category,amount`.
- Fields may be double-quoted. A quoted field may contain commas. Inside a quoted field `""` is an escaped quote.
- Lines may end with LF or CRLF.
- Blank lines are skipped and are not rows.
- Every other line is one data row with four fields.

## Rules

- Each `amount` is rounded half away from zero to 2 decimals before it is used.
- `rows` is the number of data rows (a header-only file has 0).
- `total` is the sum of the rounded amounts, rounded again to 2 decimals.
- `byCategory` maps each category to the rounded sum of its amounts. Keys are sorted ascending.
- `top` is the category with the highest category total. Ties are broken by the alphabetically first category name. `top` is `null` when there are no data rows.
- A file with only a header yields `{"rows":0,"total":0,"byCategory":{},"top":null}`.
- If the file cannot be read, or its first line is not the header, exit with status 2.

Numbers are JSON numbers, so `0` and `0.0` are the same output.
