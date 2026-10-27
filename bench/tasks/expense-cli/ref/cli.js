'use strict';
const fs = require('fs');
const { parse, HEADER } = require('./parse');
const { evaluate } = require('./rules');

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--json') process.exit(2);

let text;
try {
  text = fs.readFileSync(args[1], 'utf8');
} catch {
  process.exit(2);
}

const rows = parse(text);
if (rows.length === 0 || rows[0].join(',') !== HEADER.join(',')) process.exit(2);

const records = [];
for (const row of rows.slice(1)) {
  if (row.length !== 5) process.exit(2);
  records.push({ date: row[0], employee: row[1], category: row[2], amount: row[3], currency: row[4] });
}

process.stdout.write(JSON.stringify(evaluate(records)) + '\n');
