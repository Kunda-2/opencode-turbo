'use strict';
// Hidden acceptance for expense-cli. Only checks rules stated in seed/SPEC.md.
const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

const cwd = process.argv[2];
const hidden = process.argv[3];

function run(args) {
  return spawnSync(process.execPath, ['cli.js', ...args], { cwd, encoding: 'utf8', timeout: 20000 });
}

function report(fixture) {
  const r = run(['--json', path.join(hidden, fixture)]);
  assert.strictEqual(r.status, 0, `cli.js ${fixture} exited ${r.status}: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

function eq(what, actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${what}: expected ${expected}, got ${actual}`);
}

// caps: weekend multiplier, boundary at cap, other, rejected, flagged order
let o = report('caps.csv');
eq('caps total', o.total, 1645);
eq('caps Alice', o.byEmployee.Alice, 840);
eq('caps Bob', o.byEmployee.Bob, 370);
eq('caps Eve', o.byEmployee.Eve, 410);
eq('caps meals', o.byCategory.meals, 490);
eq('caps transport', o.byCategory.transport, 530);
eq('caps hotel', o.byCategory.hotel, 600);
eq('caps other', o.byCategory.other, 25);
assert.deepStrictEqual(Object.keys(o.byCategory), ['hotel', 'meals', 'other', 'transport'], 'caps byCategory order');
assert.deepStrictEqual(Object.keys(o.byEmployee), ['Alice', 'Bob', 'Dan', 'Eve'], 'caps byEmployee order');
assert.strictEqual(o.rejected, 2, 'caps rejected');
assert.strictEqual(o.flagged.length, 3, 'caps flagged count');
assert.deepStrictEqual(o.flagged.map((f) => f.employee), ['Bob', 'Eve', 'Dan'], 'caps flagged order');
eq('caps Bob over', o.flagged[0].over, 70);
eq('caps Eve over', o.flagged[1].over, 30);
eq('caps Dan over', o.flagged[2].over, 25);

// tie: rounding, quoted name with comma, CRLF, tie on over, rejected non-CNY
o = report('tie.csv');
eq('tie total', o.total, 230.38);
eq('tie Amy', o.byEmployee.Amy, 10.38);
eq('tie Smith', o.byEmployee['Smith, John'], 110);
eq('tie Zoe', o.byEmployee.Zoe, 110);
assert.ok(!('Bob' in o.byEmployee), 'tie rejected employee must not appear');
assert.strictEqual(o.rejected, 1, 'tie rejected');
assert.strictEqual(o.flagged.length, 2, 'tie flagged count');
assert.deepStrictEqual(o.flagged.map((f) => f.employee), ['Smith, John', 'Zoe'], 'tie flagged order');
eq('tie Smith over', o.flagged[0].over, 10);
eq('tie Zoe over', o.flagged[1].over, 10);

// argument errors
assert.strictEqual(run(['--json']).status, 2, '--json without path must exit 2');
assert.strictEqual(run([]).status, 2, 'no args must exit 2');

console.log('expense-cli: hidden checks ok');
