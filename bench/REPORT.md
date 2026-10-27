# dsh-turbo prompt policy in opencode — full benchmark (48 valid runs)

2026-10-27. Model `vzenith/deepseek-flash` (local gateway, deepseek-flash). Reasoned variant test was
invalidated (see §5), so all arms ran at the provider default.

## 1. Design

- `opencode run --standalone --auto --format json`, fresh workspace, isolated `XDG_CONFIG_HOME`
  (no user plugins/skills/MCP/AGENTS.md), `PWD` set explicitly.
- Arms differ only by the injected system section:
  `off` = no plugin · `fast` = dsh-turbo v2 policy · `max` = policy + MAX GEAR parallel block.
- 6 tasks, each with a hidden acceptance suite outside the workspace, `validate.sh` proving
  "bare seed fails / seed+ref passes", hand-verified fixtures, and a tamper guard (sha of the fixtures
  the prompt forbids editing).
- Arm order rotated per rep; task order rotated per rep.

## 2. Result (valid runs: 48; all arms 100% hidden-acceptance pass)

| task (kind) | off 中位 | fast | max |
|---|---|---|---|
| export-bug (修 CSV 转义, 3 reps) | 11.2 s | 9.5 s (−15%) | — |
| convention-flag (按既有约定加 `--json`, 3) | 13.9 s | 10.7 s (−23%) | — |
| bug-hunt (修 2 个真 bug, 4) | 24.1 s | **14.4 s (−40%)** | 15.1 s (−37%) |
| csv-report (CSV→JSON CLI, 4) | 38.6 s | 41.0 s (**+6%**) | 32.8 s (−15%) |
| expense-cli (3 模块, 写重, 2) | 101.4 s | **41.8 s (−59%)** | 58.2 s (−43%) |
| timeclock (5 模块, 长任务, 2) | 184.3 s | **101.8 s (−45%)** | **82.2 s (−55%)** |
| **ALL (18 / 18 / 12)** | **27.9 s** | **18.1 s (−35%)** | 32.8 s |

Mechanism, on the long task: steps 24.0→16.5 (fast)/10.0 (max), tool calls 32.5→23.0/16.5,
reasoning tokens 16 825→9 546/8 089, cache-read 867 584→440 448/234 176 (−49%/−73%).

## 3. What is robust vs what is not

Robust (same direction on all 4 multi-module tasks, and the only cells with tight variance):
- `fast` beats `off` by 40–59% on tasks that need iteration and re-reading (~1–3 minutes, ≥3 files).
- Cache-read drops 2×, i.e. the default path re-reads files it already has.

Not robust (n=2–4 per cell, single model, one machine):
- Short single-file tasks (export-bug, csv-report-fast) show −15%…+6% — no reliable difference.
- `max` flips sign with task shape: best overall on the long read-heavy task (82 s), worse than `fast`
  on the write-heavy one (58 s vs 42 s, 14.5 vs 9.0 tool calls). Do not treat MAX as "faster".
- The reasoning-lever control failed (§5), so "the gain is prompt discipline, not less thinking" is
  **not** established; measured reasoning tokens drop by ~50% in the policy arms.

## 4. Quality

56 runs total (48 valid + 8 in the invalidated variant batch): **56/56 hidden acceptance pass, 0 tampered
fixtures, 0 timeouts, 0 wrong exit codes**. On the two deliberately under-specified tasks the policy arms
did *less* discovery (mean 2.3 vs 3.8 read/glob/grep calls; two runs read nothing and still passed) but
still followed the documented conventions. No quality regression was observed — which is absence of
evidence, not proof: all tasks had a complete, unambiguous spec.

## 5. Failed control

`-m vzenith/deepseek-flash#high` was supposed to pin reasoning effort for both arms. Measured reasoning
tokens came out *lower* than the default run (3 141 vs 5 048 mean), so the variant did not take effect on
this gateway. Those 8 runs are excluded from arm comparisons (kept for pass/fail only). Re-testing the
"less thinking" hypothesis needs a provider where reasoning effort is observably honoured.

## 6. Verdict

Port the prompt policy plus a two-position switch; default FAST, keep MAX for large read-heavy tasks.
Expect no measurable change on quick single-file work and 40–60% wall-clock plus ~50% cache-read
reduction on multi-module work. Do not port the reasoning-effort lever (unverifiable here, and it has no
safe revert in opencode). TUI slot rendering remains unverified — it needs a human looking at a terminal.

Artifacts: `run.mjs`, `tasks/{export-bug,convention-flag,bug-hunt,csv-report,expense-cli,timeclock}/`,
`results-{all,ambiguous,long,reason-high}.json`, `logs/`, `batch*.log`.
