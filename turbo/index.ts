import { Plugin } from "@opencode/plugin"
import { readFileSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"

// Turbo: session-scoped execution policy + reasoning-effort lever, ported from
// dsh-turbo (burning-frappuccino/dsh-turbo) and dsh-tool-turbo (Electricitysheep/dsh-tool-turbo).
//
// Measured on this machine (vzenith/deepseek-flash, hidden acceptance, 70+ runs):
//   timeclock (5 modules): off 210.6s / policy 142.6s / policy+low 56.0s
//   short tasks, policy vs policy+low: -5%..-16%, 18/18 pass
//   reasoning tokens: forced low -44%, forced high +12% (request-level option is honoured;
//   model variants are not).
//
// Mode lives in turbo-modes.json next to this package so the TUI half can write it without an
// RPC round-trip: { "*": "fast", "ses_abc": "off" }. Session keys win over "*".

type Mode = "off" | "fast" | "max"
type Effort = "low" | "high" | "max" | "inherit"
const MODES: Mode[] = ["off", "fast", "max"]
const EFFORTS: Effort[] = ["low", "high", "max", "inherit"]
const DEFAULT_MODE: Mode = "fast"
const DEFAULT_FAST_EFFORT: Effort = "low"
const MARKER = "TURBO EXECUTION MODE"
const STATE_FILE = fileURLToPath(new URL("../turbo-modes.json", import.meta.url))

const BASE = [
  MARKER,
  "",
  "Optimize for minimum wall-clock completion time.",
  "",
  "Plan briefly, then execute as soon as the necessary context is in hand. Do not re-derive facts you already have, do not re-read the same file, and do not compare equivalent options.",
  "",
  "Keep planning compact. Put implementation into tool calls instead of drafting it at length before acting.",
  "",
  "Prefer one complete implementation pass over incremental rewriting. Use parallel tool calls when the operations are independent; keep dependent steps in dependency order.",
  "",
  "Do not open optional review, reflection, or re-verification stages. Do not start full suites, builds, formatters, or linters that the user did not ask for and that the acceptance criteria do not require.",
  "",
  "Before you call a code change finished, run the single cheapest command that would catch a wrong result — one test file, one typecheck, or one script that exercises the change. That check is part of finishing the task, not an optional stage.",
  "",
  "Tool failures that block completion still get the minimal repair they need: a retry or a fix is part of finishing the task, not an optional stage.",
  "",
  "Deliver the result as soon as it is complete. End the reply with one line stating what you actually ran: `Verified: <the command or check>` or `Verified: none`. Never describe code as tested when no test ran.",
  "",
  "Mandatory permissions, approvals, sandbox rules, and checks are never skipped for speed.",
]

const MAX_GEAR = [
  "MAX GEAR: lower wall-clock latency is worth extra token and tool budget.",
  "",
  "Gather all likely-needed context up front. Launch every independent read, search, tool call, and available subagent in the same turn instead of serially. Parallel duplicate exploration is allowed only when the result can be checked cheaply; never duplicate a mutating or non-idempotent action.",
  "",
  "Keep dependent operations ordered. Use the extra breadth to finish sooner, not to add prose or ceremonial review.",
  "",
]

function renderPolicy(mode: Mode): string {
  if (mode === "off") return ""
  const lines = [...BASE]
  if (mode === "max") lines.splice(8, 0, ...MAX_GEAR)
  return lines.join("\n")
}

const pick = <T extends string>(list: T[], v: unknown): T | undefined =>
  typeof v === "string" && (list as string[]).includes(v) ? (v as T) : undefined

export default Plugin.define({
  id: "turbo",
  setup(ctx) {
    const options = (ctx.options ?? {}) as { defaultMode?: unknown; fastEffort?: unknown; maxEffort?: unknown }
    const defaultMode = pick(MODES, options.defaultMode) ?? DEFAULT_MODE
    // "inherit" keeps the provider default. MAX gear never downgrades on its own.
    const fastEffort = pick(EFFORTS, options.fastEffort) ?? DEFAULT_FAST_EFFORT
    const maxEffort = pick(EFFORTS, options.maxEffort) ?? "inherit"

    // Re-read the state file only when it changes; a stat per model call is cheap and keeps the
    // TUI toggle effective without restarting the server.
    let cached: { mtime: number; modes: Record<string, unknown> } = { mtime: -1, modes: {} }
    const state = (): Record<string, unknown> => {
      try {
        const mtime = statSync(STATE_FILE).mtimeMs
        if (mtime !== cached.mtime) {
          const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8"))
          cached = { mtime, modes: parsed && typeof parsed === "object" ? parsed : {} }
        }
      } catch {
        // missing or malformed file: fall back to the configured default
      }
      return cached.modes
    }

    const modeOf = (sessionID: string): Mode => {
      const modes = state()
      return pick(MODES, modes[sessionID]) ?? pick(MODES, modes["*"]) ?? defaultMode
    }
    const effortFor = (mode: Mode): Effort => (mode === "fast" ? fastEffort : mode === "max" ? maxEffort : "inherit")

    return (async () => {
      await ctx.session.hook("context", (event) => {
        // Sync on purpose: an async hook can run after the request is assembled.
        const mode = modeOf(event.sessionID)
        const already = event.system.some(
          (p) => typeof (p as { text?: unknown }).text === "string" && (p as { text: string }).text.includes(MARKER),
        )
        if (mode !== "off" && !already) event.system.push({ type: "text", text: renderPolicy(mode) })
        const effort = effortFor(mode)
        if (effort !== "inherit") (event.options as Record<string, unknown>).reasoningEffort = effort
      })
    })()
  },
})
