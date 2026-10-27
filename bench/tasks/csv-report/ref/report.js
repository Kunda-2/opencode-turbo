'use strict';
const fs = require('fs');

const HEADER = 'date,description,category,amount';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

function round2(n) {
  const r = Math.sign(n) * (Math.round(Math.abs(n) * 100) / 100);
  return r === 0 ? 0 : r;
}

const file = process.argv[2];
let text;
try {
  text = fs.readFileSync(file, 'utf8');
} catch {
  process.exit(2);
}

const rows = parseCsv(text);
if (rows.length === 0 || rows[0].join(',') !== HEADER) process.exit(2);

const sums = new Map();
let total = 0;
for (const row of rows.slice(1)) {
  if (row.length !== 4) process.exit(2);
  const amount = round2(Number(row[3]));
  total += amount;
  sums.set(row[2], (sums.get(row[2]) || 0) + amount);
}

const byCategory = {};
for (const key of [...sums.keys()].sort()) byCategory[key] = round2(sums.get(key));

let top = null;
for (const [category, amount] of Object.entries(byCategory)) {
  if (top === null || amount > top.amount) top = { category, amount };
}

process.stdout.write(
  JSON.stringify({ rows: rows.length - 1, total: round2(total), byCategory, top }) + '\n',
);
