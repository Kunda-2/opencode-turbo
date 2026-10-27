'use strict';
// Hidden acceptance for timeclock. Only checks rules stated in seed/SPEC.md.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const cwd = process.argv[2];
const hidden = process.argv[3];

function run(args) {
  return spawnSync(process.execPath, ['cli.js', ...args], { cwd, encoding: 'utf8', timeout: 20000 });
}

function report(fixture, extra) {
  const r = run(['--json', path.join(hidden, fixture), ...(extra || [])]);
  assert.strictEqual(r.status, 0, `${fixture} exited ${r.status}: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

function eq(what, actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${what}: expected ${expected}, got ${actual}`);
}

function day(o, employee, date) {
  const days = o.employees[employee].days;
  const found = days.find((d) => d.date === date);
  assert.ok(found, `${employee} ${date}: day missing (have ${days.map((d) => d.date)})`);
  return found;
}

// basic.csv: break boundary (360 vs 361), round-up to 15, daily overtime, inferred shift,
// duplicate "in" error, ordering, totals and pay at the default rate.
let o = report('basic.csv');

eq('Alice 05-06 worked', day(o, 'Alice', '2024-05-06').workedMinutes, 450);
eq('Alice 05-06 overtime', day(o, 'Alice', '2024-05-06').overtimeMinutes, 0);
eq('Alice 05-07 worked (exactly 360, no break)', day(o, 'Alice', '2024-05-07').workedMinutes, 360);
eq('Alice 05-08 worked (361-30=331 rounds up to 345)', day(o, 'Alice', '2024-05-08').workedMinutes, 345);
eq('Alice 05-09 worked', day(o, 'Alice', '2024-05-09').workedMinutes, 570);
eq('Alice 05-09 overtime', day(o, 'Alice', '2024-05-09').overtimeMinutes, 90);
eq('Bob 05-10 worked (inferred to 18:00)', day(o, 'Bob', '2024-05-10').workedMinutes, 540);
eq('Bob 05-10 overtime', day(o, 'Bob', '2024-05-10').overtimeMinutes, 60);
assert.strictEqual(day(o, 'Bob', '2024-05-10').inferred, true, 'Bob 05-10 must be inferred');
assert.strictEqual(day(o, 'Bob', '2024-05-08').inferred, false, 'Bob 05-08 must not be inferred');
eq('Bob 05-08 worked (duplicate in ignored)', day(o, 'Bob', '2024-05-08').workedMinutes, 450);

assert.deepStrictEqual(o.employees.Bob.days.map((d) => d.date), ['2024-05-08', '2024-05-10'], 'Bob days sorted');
assert.deepStrictEqual(Object.keys(o.employees), ['Alice', 'Bob'], 'employee keys sorted');

eq('Alice regular', o.employees.Alice.regularMinutes, 1635);
eq('Alice overtime', o.employees.Alice.overtimeMinutes, 90);
eq('Alice pay', o.employees.Alice.pay, 2950);
eq('Bob regular', o.employees.Bob.regularMinutes, 930);
eq('Bob overtime', o.employees.Bob.overtimeMinutes, 60);
eq('Bob pay', o.employees.Bob.pay, 1700);

assert.strictEqual(o.errors.length, 2, 'basic errors count');
assert.strictEqual(o.errors[0].employee, 'Bob', 'errors[0] employee');
assert.strictEqual(o.errors[0].timestamp, '2024-05-07T17:00', 'errors[0] timestamp');
assert.strictEqual(o.errors[0].reason, 'out without in', 'errors[0] reason');
assert.strictEqual(o.errors[1].timestamp, '2024-05-08T10:00', 'errors[1] timestamp');
assert.strictEqual(o.errors[1].reason, 'in without out', 'errors[1] reason');

eq('basic totals regular', o.totals.regularMinutes, 2565);
eq('basic totals overtime', o.totals.overtimeMinutes, 150);
eq('basic totals pay', o.totals.pay, 4650);

// edges.csv: quoted name with a comma, CRLF, blank line, --month, --shift-end, --rate, 2dp pay.
o = report('edges.csv', ['--month', '2024-06', '--shift-end', '16:30', '--rate', '133']);
assert.deepStrictEqual(Object.keys(o.employees), ['Dana, Q', 'Ed', 'Fay'], 'edges employee keys sorted');
assert.deepStrictEqual(o.employees['Dana, Q'].days.map((d) => d.date), ['2024-06-03'], 'Dana days');
eq('Dana 06-03 worked (493-30 rounds up to 465)', day(o, 'Dana, Q', '2024-06-03').workedMinutes, 465);
eq('Dana 06-03 overtime', day(o, 'Dana, Q', '2024-06-03').overtimeMinutes, 0);
assert.deepStrictEqual(o.employees.Ed.days.map((d) => d.date), ['2024-06-04'], '--month drops Ed 07-01');
eq('Ed 06-04 worked', day(o, 'Ed', '2024-06-04').workedMinutes, 120);
assert.strictEqual(day(o, 'Fay', '2024-06-05').inferred, true, 'Fay must be inferred');
eq('Fay 06-05 worked (shift-end 16:30)', day(o, 'Fay', '2024-06-05').workedMinutes, 420);
eq('Fay 06-05 overtime', day(o, 'Fay', '2024-06-05').overtimeMinutes, 0);
eq('edges totals regular', o.totals.regularMinutes, 1005);
eq('edges totals overtime', o.totals.overtimeMinutes, 0);
eq('edges totals pay (133/h)', o.totals.pay, 2227.75);

// Same file without filters/overrides: default shift end 18:00, July day kept.
o = report('edges.csv');
eq('Ed 07-01 worked', day(o, 'Ed', '2024-07-01').workedMinutes, 540);
eq('Ed 07-01 overtime', day(o, 'Ed', '2024-07-01').overtimeMinutes, 60);
eq('Fay 06-05 worked (default 18:00)', day(o, 'Fay', '2024-06-05').workedMinutes, 510);
eq('Fay 06-05 overtime (default 18:00)', day(o, 'Fay', '2024-06-05').overtimeMinutes, 30);
eq('unfiltered totals regular', o.totals.regularMinutes, 1545);
eq('unfiltered totals overtime', o.totals.overtimeMinutes, 90);

// store.js: load of a missing file, idempotent save.
const store = require(path.join(cwd, 'store.js'));
const file = path.join(cwd, '.store-check.json');
try { fs.unlinkSync(file); } catch {}
assert.deepStrictEqual(store.load(file), [], 'load of missing file returns []');
const p1 = { employee: 'A', timestamp: '2024-05-06T09:00', kind: 'in' };
const p2 = { employee: 'A', timestamp: '2024-05-06T17:00', kind: 'out' };
store.save(file, [p1, p1]);
assert.strictEqual(store.load(file).length, 1, 'save twice with the same punch yields one entry');
store.save(file, [p2]);
assert.strictEqual(store.load(file).length, 2, 'save appends a new punch');
store.save(file, [p1, p2]);
assert.strictEqual(store.load(file).length, 2, 'save is idempotent for existing punches');
assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).punches.length, 2, 'file holds {"punches":[...]}');
fs.unlinkSync(file);

// argument and row errors
assert.strictEqual(run([]).status, 2, 'no args must exit 2');
assert.strictEqual(run(['--json']).status, 2, '--json without path must exit 2');
assert.strictEqual(run(['--json', path.join(cwd, 'no-such-file.csv')]).status, 2, 'unreadable file must exit 2');
const bad = path.join(cwd, '.bad-kind.csv');
fs.writeFileSync(bad, 'employee,timestamp,kind\nAnn,2024-05-06T09:00,in\nAnn,2024-05-06T12:00,break\n');
assert.strictEqual(run(['--json', bad]).status, 2, 'kind other than in/out must exit 2');
fs.unlinkSync(bad);

console.log('timeclock: hidden checks ok');
