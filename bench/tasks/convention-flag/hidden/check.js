'use strict';
const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');
const cwd = process.argv[2];
const run = (...args) => spawnSync(process.execPath, ['cli.js', ...args], { cwd, encoding: 'utf8', timeout: 20000 })

let r = run('show', '2', '--json')
assert.strictEqual(r.status, 0, `show 2 --json exited ${r.status}: ${r.stderr}`)
assert.deepStrictEqual(JSON.parse(r.stdout), { id: 2, name: 'nut', qty: 0 }, 'record printed exactly as stored')

r = run('show', '99', '--json')
assert.strictEqual(r.status, 1, 'unknown id must exit 1')
assert.strictEqual(r.stdout, '', 'unknown id must print nothing to stdout')
assert.deepStrictEqual(JSON.parse(r.stderr), { ok: false, error: 'NOT_FOUND' }, 'unknown id uses the documented error shape')

r = run('show')
assert.strictEqual(r.status, 1, 'missing id must exit 1')
assert.deepStrictEqual(JSON.parse(r.stderr), { ok: false, error: 'BAD_ARGS' }, 'missing id keeps BAD_ARGS')

r = run('show', '2')
assert.strictEqual(r.status, 0, 'show without the flag must still work')
assert.strictEqual(r.stdout.trim(), 'nut x0', 'human output unchanged')

r = run('list', '--json')
assert.strictEqual(r.status, 0, 'list --json regression')
assert.strictEqual(JSON.parse(r.stdout).length, 3, 'list --json regression: 3 records')
console.log('convention-flag: hidden checks ok')
