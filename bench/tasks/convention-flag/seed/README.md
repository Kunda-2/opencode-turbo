# stockctl

`node cli.js <command> [args]` reads the records in `data.json`.

## Commands

- `list` — prints one line per record: `#<id> <name> x<qty>`.
- `list --json` — prints the full record array as one JSON document.
- `show <id>` — prints the record as `<name> x<qty>`.

## Errors

Every command reports a failure the same way, with no exceptions:

- nothing on stdout,
- one JSON document on stderr: `{"ok":false,"error":"<CODE>"}`,
- exit status 1.

Codes: `NOT_FOUND` (no record with that id), `BAD_ARGS` (missing or malformed arguments),
`IO_ERROR` (data.json cannot be read).

## Machine-readable output

Commands that support a `--json` flag print the record or records exactly as they are stored in
`data.json` — no extra fields, no renaming.
