# orders export

`orders.js` holds the order data and the CSV serializer. `report.js` is the CLI that writes the export.

- `toCsv(rows)` returns the CSV text for an array of order records `{id, customer, address, amount}`.
- Columns are always, in this order: `id,customer,address,amount`.
- `amount` is always formatted with exactly 2 decimals.
- Addresses and customer names are free text entered by customers: they may contain commas, double quotes and newlines.
- The export is written as UTF-8, one record per line, with a header row.
