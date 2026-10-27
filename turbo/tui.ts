import { Plugin } from "@opencode/plugin/tui"
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

// TUI half of the turbo plugin.
//   /turbo <off|fast|max|status>         -> this session only
//   /turbo global <off|fast|max|status>  -> every session
// It only writes turbo-modes.json; the server half reads it on the next request, so no model turn.

const STATE_FILE = fileURLToPath(new URL("../turbo-modes.json", import.meta.url))
const PROBE_FILE = "/tmp/opencode/turbo-tui-probe.json"
const MODES = ["off", "fast", "max"]
const DEFAULT_MODE = "fast"

export default Plugin.define({
  id: "turbo.tui",
  setup(context) {
    try {
      const read = (): Record<string, unknown> => {
        try {
          const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8"))
          return parsed && typeof parsed === "object" ? parsed : {}
        } catch {
          return {}
        }
      }
      const write = (modes: Record<string, unknown>) => writeFileSync(STATE_FILE, `${JSON.stringify(modes, null, 2)}\n`)
      const isMode = (v: unknown): v is string => typeof v === "string" && MODES.includes(v)
      const toast = (message: string, title = "Turbo", variant?: string) => {
        try {
          context.ui.toast.show({ title, message, ...(variant ? { variant } : {}) } as never)
        } catch {}
      }

      // The current session id is not part of the documented command input, so try the plausible
      // accessors and refuse to write a wrong session when none of them resolve.
      const activeSession = (): string | undefined => {
        const candidates: unknown[] = []
        const push = (fn: () => unknown) => {
          try {
            candidates.push(fn())
          } catch {}
        }
        push(() => (context.ui as unknown as { router?: { current?: () => unknown } }).router?.current?.())
        push(() => (context as unknown as { router?: { current?: () => unknown } }).router?.current?.())
        push(() => (context as unknown as { route?: () => unknown }).route?.())
        for (const candidate of candidates) {
          const record = candidate as Record<string, unknown> | undefined
          const nested = [record, record?.data, record?.params, record?.route].filter(Boolean) as Record<string, unknown>[]
          for (const r of nested) {
            for (const key of ["sessionID", "sessionId", "session", "id"]) {
              const v = r[key]
              if (typeof v === "string" && v.startsWith("ses")) return v
            }
          }
        }
        return undefined
      }

      context.keymap.layer(() => ({
        mode: "global",
        commands: [
          {
            id: "turbo.mode",
            title: "Turbo execution mode",
            group: "Turbo",
            palette: true,
            slash: { name: "turbo", arguments: true },
            run: (input: string | undefined) => {
              const tokens = String(input ?? "")
                .trim()
                .toLowerCase()
                .split(/\s+/)
                .filter(Boolean)
              const global = tokens[0] === "global"
              const action = global ? tokens[1] : tokens[0]
              const modes = read()
              const sessionID = activeSession()
              const scope = global ? "global" : sessionID ? `session ${sessionID.slice(0, 12)}` : undefined
              let message: string

              if (action === undefined || action === "status") {
                const inherited = isMode(modes["*"]) ? (modes["*"] as string) : DEFAULT_MODE
                const own = sessionID && isMode(modes[sessionID]) ? (modes[sessionID] as string) : undefined
                message =
                  `turbo: ${own ?? inherited}${own ? "" : " (from global)"} · global ${inherited}` +
                  (sessionID ? ` · ${sessionID.slice(0, 12)}` : " · session unknown")
              } else if (!isMode(action)) {
                message = `turbo: unknown "${action}" — use off | fast | max, or global off`
              } else if (global) {
                modes["*"] = action
                write(modes)
                message = `turbo: global ${action}`
              } else if (sessionID) {
                modes[sessionID] = action
                write(modes)
                message = `turbo: ${action} for ${scope}`
              } else {
                message = "turbo: cannot resolve the current session — use `/turbo global <mode>`"
              }

              toast(message, "Turbo", action && !isMode(action) === false ? "info" : undefined)
              return message
            },
          },
          {
            id: "turbo.probe",
            title: "Turbo: dump session resolution (diagnostics)",
            group: "Turbo",
            slash: { name: "turboprobe", arguments: false },
            run: () => {
              const dump: Record<string, unknown> = {}
              const safe = (name: string, fn: () => unknown) => {
                try {
                  dump[name] = fn()
                } catch (e) {
                  dump[name] = `ERROR: ${String(e)}`
                }
              }
              safe("contextKeys", () => Object.keys(context))
              safe("uiKeys", () => Object.keys(context.ui ?? {}))
              safe("routerKeys", () => Object.keys((context.ui as never as { router?: object })?.router ?? {}))
              safe("routerCurrent", () => (context.ui as never as { router?: { current?: () => unknown } }).router?.current?.())
              safe("tabsEnabled", () => (context.ui as never as { tabs?: { enabled?: () => boolean } }).tabs?.enabled?.())
              safe("tabsList", () => (context.ui as never as { tabs?: { list?: () => unknown } }).tabs?.list?.())
              safe("sessionList", () =>
                (context.data.session.list() ?? []).map((s: { id?: string; title?: string }) => ({ id: s.id, title: s.title })),
              )
              safe("resolved", () => activeSession())
              try {
                writeFileSync(PROBE_FILE, JSON.stringify(dump, null, 2))
                toast(`probe written to ${PROBE_FILE}`, "Turbo")
              } catch (e) {
                toast(`probe failed: ${String(e)}`, "Turbo", "error")
              }
              return "probe"
            },
          },
        ],
      }))
    } catch {
      // Never let the TUI half break boot; the server default (fast) still applies.
    }
  },
})
