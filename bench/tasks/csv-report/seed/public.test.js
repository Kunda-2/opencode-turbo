'use strict';
// Quick self-check: only the two simplest rules (row count and plain-sum total,
// plus ascending category keys on plain unquoted input).
const { execFileSync } = require('child_process');
const assert = require('assert');
const path = require('path');

const out = execFileSync(process.execPath, [path.join(__dirname, 'report.js'), path.join(__dirname, 'data.csv')], {
  encoding: 'utf8',
});
const report = JSON.parse(out);

assert.strictEqual(report.rows, 12);
assert.strictEqual(report.total, 282.73);
assert.deepStrictEqual(Object.keys(report.byCategory), ['books', 'food', 'fun', 'meals', 'tech', 'transport']);

console.log('public tests passed');
