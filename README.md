# opencode-turbo

A Turbo execution mode for [OpenCode](https://opencode.ai) v2: a session-scoped prompt policy plus a
request-level `reasoningEffort` lever, with an instant TUI toggle.

Ported from two DeepSeek Harness plugins — [`dsh-turbo`](https://github.com/burning-frappuccino/dsh-turbo)
(the prompt policy) and [`dsh-tool-turbo`](https://github.com/Electricitysheep/dsh-tool-turbo) (the
per-request reasoning effort idea). See `NOTICE`.

## What it does

Two hooks, nothing else:

| Half | File | Behaviour |
|---|---|---|
| server | `turbo/index.ts` | On every model call (`session.hook("context")`) push one system section and, in `fast` gear, set `options.reasoningEffort = "low"` |
| TUI | `turbo/tui.ts` | `/turbo off\|fast\|max\|status` (this session) and `/turbo global ...` write `turbo-modes.json` and show a toast — no model turn |

| Gear | policy section | reasoningEffort |
|---|---|---|
| `off` | not injected | untouched |
| `fast` (default) | injected | `low` |
| `max` | injected + parallel-budget block | untouched |

`off` is byte-identical to not installing the plugin: the section is simply not pushed.

## Measured

`vzenith/deepseek-flash` behind an OpenAI-compatible gateway, hidden-acceptance tasks, 70+ runs.
Wall clock includes process start. Full method and every number: `bench/REPORT.md`.

| task | off | policy only | policy + low |
|---|---|---|---|
| timeclock (5 modules, 3 min) | 210.6 s | 142.6 s | **56.0 s** |
| expense-cli (3 modules) | 101.4 s | 41.8 s | — |
| bug-hunt (2 real defects) | 24.1 s | 14.4 s | — |
| csv-report (CSV→JSON CLI) | 38.6 s | 41.0 s | 21.9 s |
| short single-file tasks | — | −5%…−16% | no reliable difference |

- Hidden acceptance: 70+ runs, 0 regressions, 0 tampered test files.
- Reasoning tokens: forced `low` −44%, forced `high` +12% — the gateway honours the request-level
  option. Model *variants* (`-m model#high`) were ignored by the same gateway, which is why this
  plugin sets the option instead.
- `max` is not "faster": it won on the long read-heavy task and lost to `fast` on a write-heavy one
  (58.2 s vs 41.8 s, 14.5 vs 9.0 tool calls). Default is `fast`.

## Install

```bash
git clone <this repo> ~/.config/opencode/turbo
```

Then declare it in `~/.config/opencode/opencode.json` so options reach the plugin and the `./tui`
export is picked up:

```jsonc
{
  "plugins": [
    {
      "package": "/home/<you>/.config/opencode/turbo",
      "options": { "defaultMode": "fast", "fastEffort": "low" }
    }
  ]
}
```

Restart the TUI once (the TUI half joins the boot graph; config hot-reload is not enough for that).
`turbo-modes.json` is created next to the package on first toggle.

Options: `defaultMode` (`off|fast|max`, default `fast`), `fastEffort` (`low|high|max|inherit`,
default `low`), `maxEffort` (default `inherit`), `events` (default `true`), `eventsFile`
(default `~/.local/share/opencode/turbo-events.jsonl`).

## Use

- `/turbo status` — instant toast: effective gear, global default, and the session id it resolved.
- `/turbo off|fast|max` — **this session only** (writes `"ses_xxx": "<mode>"`).
- `/turbo global off|fast|max` — every session that has no override (writes `"*"`).
- Resolution order: session key → `"*"` → `defaultMode`. Changes apply from the next request, no
  restart. If the current session cannot be resolved the command refuses to write and says so; use
  `/turbo global <mode>` instead. `/turboprobe` dumps the resolution diagnostics to
  `/tmp/opencode/turbo-tui-probe.json`.
- Uninstall: remove the `plugins[]` entry and delete `turbo-modes.json`.

## Caveats

- **Provider dependent.** `reasoningEffort` is protocol-semantic. On a gateway that does not forward
  it, `fast` degrades to policy-only (silently, no error). Verify by comparing `tokens.reasoning` on
  a real task.
- **Not universal.** Short single-file tasks show no reliable difference; the gain comes from
  multi-module work that needs re-reading and iteration.
- **Quality evidence is bounded.** Every benchmark task had a complete spec, so "passes the cheap
  check but is subtly wrong" was not exercised. Tasks were 1–3 minutes, one model, one machine,
  n=2–4 per cell. If a hard task feels under-thought, use `/turbo max`.
- No Web/desktop UI: the toggle is TUI-only.

## Observability

Every turn appends one JSON line, so you can judge `fast` on your own work instead of trusting a
benchmark:

```json
{"ts":"2026-10-27T06:16:55.092Z","sessionID":"ses_...","outcome":"succeeded","mode":"fast",
 "effort":"low","wallMs":6564,"steps":3,"toolCalls":3,"toolFailures":1,"verified":false,
 "cost":0,"tokens":{"input":17885,"output":148,"reasoning":266,"cacheRead":38272}}
```

`verified` is true when a shell command in that turn looked like a build/test/lint (same idea as
dsh-turbo's evidence metric: an observation, not a claim). `toolFailures` counts non-zero exits.

```bash
jq -r 'select(.toolFailures>0) | [.ts,.mode,.steps,.toolFailures] | @tsv' \
  ~/.local/share/opencode/turbo-events.jsonl | tail
```

This exists because the "does `fast` hurt quality?" question was not answerable from a one-off
benchmark: 12 hidden-acceptance runs on a task with deliberately unconventional values in a doc showed
`fast` matching `off` exactly (and faster), so the risk stays open until real sessions say otherwise.

## Benchmark

```bash
cd bench
BENCH_DIR=$PWD MODEL=vzenith/deepseek-flash TAG=run1 node run.mjs 2   # 2 reps, all arms
```

Each task has `seed/`, a hidden `assert.sh`, a `ref/` solution and a `validate.sh` proving the task
is fair (bare seed fails, seed+ref passes). `PWD` must be set in the child environment — `opencode
run` resolves its working directory from `PWD`, not from `process.cwd()`, so a runner that only sets
`cwd` writes the agent's files into the parent directory.

## License

MIT — see `LICENSE` and `NOTICE`.
