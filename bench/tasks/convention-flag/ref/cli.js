const fs = require('fs')
const path = require('path')

function load() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'))
  } catch {
    fail('IO_ERROR')
  }
}

function fail(code) {
  process.stdout.write('')
  process.stderr.write(JSON.stringify({ ok: false, error: code }) + '\n')
  process.exit(1)
}

const [command, ...rest] = process.argv.slice(2)

if (command === 'list') {
  const records = load()
  if (rest.includes('--json')) process.stdout.write(JSON.stringify(records, null, 2) + '\n')
  else for (const r of records) console.log(`#${r.id} ${r.name} x${r.qty}`)
} else if (command === 'show') {
  const id = Number(rest[0])
  if (!Number.isInteger(id)) fail('BAD_ARGS')
  const record = load().find((r) => r.id === id)
  if (!record) fail('NOT_FOUND')
  if (rest.includes('--json')) process.stdout.write(JSON.stringify(record, null, 2) + '\n')
  else console.log(`${record.name} x${record.qty}`)
} else {
  fail('BAD_ARGS')
}
