#!/usr/bin/env node
// Full 3-arm ON/OFF benchmark for a dsh-turbo-style prompt policy in opencode.
// Usage: node run.mjs [reps] [tasks] [arms]
//   node run.mjs                  # default reps per task, all tasks, off|fast|max
//   node run.mjs 2                 # 2 reps everywhere
//   node run.mjs "" M1 csv-report  # one task
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync, statSync } from "node:fs"
import { join } from "node:path"

const B = process.env.BENCH_DIR ?? process.cwd() // expects tasks/ and run output under this dir
const MODEL = process.env.MODEL ?? "vzenith/deepseek-flash"
const TAG = process.env.TAG ?? "main"
const DEFAULT_REPS = { "csv-report": 4, "bug-hunt": 4, "expense-cli": 2, "timeclock": 2, "export-bug": 3, "convention-flag": 3 }
const TIMEOUT = { "expense-cli": 1_800_000, timeclock: 2_400_000 }
const reps = (t) => DEFAULT_REPS[t] ?? 2

const arg = (i, d) => (process.argv[i] === undefined || process.argv[i] === "" ? d : process.argv[i])
const REPS_OVERRIDE = Number(arg(2, "")) || 0
const TASK_FILTER = arg(3, "").split(",").filter(Boolean)
const ARMS = arg(4, "off,fast,max").split(",")

const tasks = readdirSync(join(B, "tasks")).filter((t) => !TASK_FILTER.length || TASK_FILTER.includes(t))
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 12)
const results = []

const rotate = (list, n) => list.map((_, i) => list[(i + n) % list.length])

for (let rep = 1; rep <= (REPS_OVERRIDE || 99); rep++) {
  const repTasks = rotate(tasks, rep - 1)
  if (!REPS_OVERRIDE && repTasks.every((t) => rep > reps(t))) break
  for (let ti = 0; ti < repTasks.length; ti++) {
    const task = repTasks[ti]
    if (!REPS_OVERRIDE && rep > reps(task)) continue
    const dir = join(B, "tasks", task)
    const prompt = readFileSync(join(dir, "prompt.txt"), "utf8").trim()

    for (const arm of rotate(ARMS, rep + ti - 1)) {
      const ws = join(B, "runs", task, `${arm}-r${rep}`)
      rmSync(ws, { recursive: true, force: true })
      mkdirSync(ws, { recursive: true })
      if (existsSync(join(dir, "seed"))) cpSync(join(dir, "seed"), ws, { recursive: true })

      // integrity: hash the fixtures the agent must not rewrite
      const guarded = readdirSync(ws)
        .filter((f) => /test|spec|repro|readme|^data\.(json|csv)$/i.test(f))
        .map((f) => [f, sha(join(ws, f))])
      const before = readdirSync(ws).length

      const started = Date.now()
      const proc = spawnSync("opencode", ["run", "--standalone", "--auto", "--format", "json", "-m", MODEL, prompt], {
        cwd: ws,
        timeout: TIMEOUT[task] ?? 900_000,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, PWD: ws, XDG_CONFIG_HOME: join(B, `xdg-${arm}`), XDG_DATA_HOME: join(B, "data") },
      })
      const wall = Date.now() - started
      writeFileSync(join(B, "logs", `${TAG}-${task}-${arm}-r${rep}.jsonl`), `${proc.stdout ?? ""}\n${proc.stderr ?? ""}`)

      const events = (proc.stdout ?? "")
        .split("\n")
        .filter((l) => l.startsWith("{"))
        .map((l) => {
          try {
            return JSON.parse(l)
          } catch {
            return null
          }
        })
        .filter(Boolean)
      const steps = events.filter((e) => e.type === "step_finish")
      const tools = events.filter((e) => e.type === "tool_use").map((e) => e.part?.tool)
      const text = events.filter((e) => e.type === "text").map((e) => e.part?.text).join("")
      const sum = (f) => steps.reduce((a, s) => a + (f(s.part) ?? 0), 0)
      const verifyCmd = events.some(
        (e) =>
          /^(shell|bash)$/.test(e.part?.tool ?? "") &&
          /\b(node|bun|python3?|npx)\b|\bgrep\b|\btest -f\b|\bwc -l\b/.test(
            JSON.stringify(e.part?.state?.input ?? {}),
          ),
      )
      const check = spawnSync("bash", [join(dir, "assert.sh")], { cwd: ws, timeout: 120_000, encoding: "utf8" })
      const tampered = guarded.some(([f, h]) => !existsSync(join(ws, f)) || sha(join(ws, f)) !== h)

      results.push({
        tag: TAG,
        model: MODEL,
        task,
        arm,
        rep,
        wallS: +(wall / 1000).toFixed(1),
        exit: proc.status,
        timedOut: proc.status === null,
        hiddenPass: check.status === 0,
        steps: steps.length,
        toolCalls: tools.length,
        toolNames: tools,
        tokens: {
          input: sum((p) => p?.tokens?.input),
          output: sum((p) => p?.tokens?.output),
          reasoning: sum((p) => p?.tokens?.reasoning),
          cacheRead: sum((p) => p?.tokens?.cache?.read),
          cacheWrite: sum((p) => p?.tokens?.cache?.write),
        },
        cost: +sum((p) => p?.cost).toFixed(6),
        filesAdded: readdirSync(ws).length - before,
        tamperedTests: tampered,
        ranVerification: verifyCmd,
        claimedVerified: /Verified:\s*(?!none)/.test(text),
        verifiedLine: (text.match(/Verified:[^\n]*/) ?? [""])[0].slice(0, 80),
      })
      const r = results.at(-1)
      console.log(
        `${task.padEnd(11)} ${arm.padEnd(4)} r${rep} wall=${String(r.wallS).padStart(6)}s pass=${r.hiddenPass ? "Y" : "N"} steps=${r.steps} tools=${r.toolCalls} out=${r.tokens.output} cache=${r.tokens.cacheRead} tamper=${r.tamperedTests ? "Y" : "n"} exit=${r.exit}`,
      )
      writeFileSync(join(B, `results-${TAG}-partial.json`), JSON.stringify(results, null, 1))
    }
  }
}

writeFileSync(join(B, `results-${TAG}.json`), JSON.stringify(results, null, 1))

const med = (a) => {
  const s = [...a].sort((x, y) => x - y)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
const agg = {}
for (const r of results) {
  for (const k of [`${r.task}|${r.arm}`, `ALL|${r.arm}`]) {
    const a = (agg[k] ??= { n: 0, pass: 0, walls: [], steps: 0, tools: 0, out: 0, cache: 0, cost: 0, verify: 0, tamper: 0 })
    a.n++
    a.pass += r.hiddenPass ? 1 : 0
    a.walls.push(r.wallS)
    a.steps += r.steps
    a.tools += r.toolCalls
    a.out += r.tokens.output
    a.cache += r.tokens.cacheRead
    a.cost += r.cost
    a.verify += r.ranVerification ? 1 : 0
    a.tamper += r.tamperedTests ? 1 : 0
  }
}
console.log(
  `\n${"cell".padEnd(18)}${"n".padStart(3)}${"pass".padStart(7)}${"medS".padStart(8)}${"meanS".padStart(8)}${"steps".padStart(7)}${"tools".padStart(7)}${"outTok".padStart(8)}${"cacheTok".padStart(10)}${"cost".padStart(8)}${"verify".padStart(8)}${"tamper".padStart(7)}`,
)
for (const [k, a] of Object.entries(agg)) {
  const mean = a.walls.reduce((x, y) => x + y, 0) / a.n
  console.log(
    `${k.padEnd(18)}${String(a.n).padStart(3)}${`${a.pass}/${a.n}`.padStart(7)}${med(a.walls).toFixed(1).padStart(8)}${mean.toFixed(1).padStart(8)}${(a.steps / a.n).toFixed(2).padStart(7)}${(a.tools / a.n).toFixed(2).padStart(7)}${Math.round(a.out / a.n).toString().padStart(8)}${Math.round(a.cache / a.n).toString().padStart(10)}${a.cost.toFixed(3).padStart(8)}${`${a.verify}/${a.n}`.padStart(8)}${String(a.tamper).padStart(7)}`,
  )
}
