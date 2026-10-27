import { Plugin } from "@opencode/plugin/tui"
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

// TUI half of the turbo plugin: instant `/turbo off|fast|max|status` with a toast, no model turn.
// It only writes turbo-modes.json; the server half reads it on the next request.

const STATE_FILE = fileURLToPath(new URL("../turbo-modes.json", import.meta.url))
const MODES = ["off", "fast", "max"]

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
      const current = (): string => {
        const mode = read()["*"]
        return typeof mode === "string" && MODES.includes(mode) ? mode : "fast"
      }
      const toast = (message: string) => {
        try {
          context.ui.toast.show({ title: "Turbo", message })
        } catch {}
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
              const arg = String(input ?? "").trim().toLowerCase()
              let message: string
              if (MODES.includes(arg)) {
                const modes = read()
                modes["*"] = arg
                try {
                  writeFileSync(STATE_FILE, `${JSON.stringify(modes, null, 2)}\n`)
                  message = `turbo: ${arg}`
                } catch (e) {
                  message = `turbo: cannot write state (${String(e)})`
                }
              } else if (arg === "" || arg === "status") {
                message = `turbo: ${current()}`
              } else {
                message = `turbo: unknown "${arg}" — use off | fast | max`
              }
              toast(message)
              return message
            },
          },
        ],
      }))
    } catch {
      // Never let the TUI half break boot; the server default (fast) still applies.
    }
  },
})
