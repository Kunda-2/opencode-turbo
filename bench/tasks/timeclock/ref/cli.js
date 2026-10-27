'use strict';
const fs = require('fs');
const { parse, HEADER } = require('./parse');
const { pair } = require('./pairs');
const { buildReport } = require('./rules');

const SHIFT_END_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const args = process.argv.slice(2);
let csv = null;
let sawJson = false;
let shiftEnd = '18:00';
let month = null;
let rate = 100;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--json') {
    sawJson = true;
    csv = args[++i];
  } else if (arg === '--shift-end') {
    shiftEnd = args[++i];
  } else if (arg === '--month') {
    month = args[++i];
  } else if (arg === '--rate') {
    rate = Number(args[++i]);
  } else {
    process.exit(2);
  }
}

if (!sawJson || !csv) process.exit(2);
if (!SHIFT_END_RE.test(shiftEnd || '')) process.exit(2);
if (month !== null && !MONTH_RE.test(month || '')) process.exit(2);
if (!Number.isFinite(rate)) process.exit(2);

let text;
try {
  text = fs.readFileSync(csv, 'utf8');
} catch {
  process.exit(2);
}

const rows = parse(text);
if (rows.length === 0 || rows[0].join(',') !== HEADER.join(',')) process.exit(2);

const punches = [];
for (const row of rows.slice(1)) {
  if (row.length !== 3) process.exit(2);
  const [employee, timestamp, kind] = row;
  if (kind !== 'in' && kind !== 'out') process.exit(2);
  if (!TIMESTAMP_RE.test(timestamp) || !Number.isFinite(Date.parse(timestamp + ':00Z'))) process.exit(2);
  punches.push({ employee, timestamp, kind });
}

const { shifts, errors } = pair(punches, shiftEnd);
process.stdout.write(JSON.stringify(buildReport(shifts, errors, { rate, month })) + '\n');
