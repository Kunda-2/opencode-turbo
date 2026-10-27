'use strict';
// Hidden acceptance for csv-report. Only checks rules stated in seed/SPEC.md.
const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

const cwd = process.argv[2];
const hidden = process.argv[3];

function run(args) {
  return spawnSync(process.execPath, ['report.js', ...args], { cwd, encoding: 'utf8', timeout: 20000 });
}

function report(fixture) {
  const r = run([path.join(hidden, fixture)]);
  assert.strictEqual(r.status, 0, `report.js ${fixture} exited ${r.status}: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

function eq(what, actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${what}: expected ${expected}, got ${actual}`);
}

// quoted fields with commas / escaped quotes / negative amount
let o = report('quotes.csv');
assert.strictEqual(o.rows, 4, 'quotes rows');
eq('quotes total', o.total, 12);
eq('quotes books', o.byCategory.books, 12.25);
eq('quotes meals', o.byCategory.meals, 4.75);
eq('quotes transport', o.byCategory.transport, -5);
assert.deepStrictEqual(Object.keys(o.byCategory), ['books', 'meals', 'transport'], 'quotes byCategory order');
assert.deepStrictEqual(o.top, { category: 'books', amount: 12.25 }, 'quotes top');

// CRLF line endings, blank line, half-away-from-zero rounding
o = report('crlf.csv');
assert.strictEqual(o.rows, 2, 'crlf rows');
eq('crlf total', o.total, 3.38);
eq('crlf meals', o.byCategory.meals, 2.38);
eq('crlf transport', o.byCategory.transport, 1);
assert.deepStrictEqual(o.top, { category: 'meals', amount: 2.38 }, 'crlf top');

// tie for top -> alphabetically first
o = report('tie.csv');
eq('tie total', o.total, 20);
assert.deepStrictEqual(Object.keys(o.byCategory), ['alpha', 'beta'], 'tie byCategory order');
assert.deepStrictEqual(o.top, { category: 'alpha', amount: 10 }, 'tie top');

// header only
o = report('header-only.csv');
assert.deepStrictEqual(o, { rows: 0, total: 0, byCategory: {}, top: null }, 'header only');

// unreadable file
const missing = run([path.join(hidden, 'no-such-file.csv')]);
assert.strictEqual(missing.status, 2, `missing file must exit 2, got ${missing.status}`);

console.log('csv-report: hidden checks ok');
