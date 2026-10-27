'use strict';
// Accepts any valid CSV quoting style: parse the output back into a grid.
const assert = require('assert');
const path = require('path');
const cwd = process.argv[2];
const { toCsv } = require(path.join(cwd, 'orders.js'));

function parseCsv(text) {
  const rows = []
  let row = [], f = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { f += '"'; i++ } else quoted = false
      } else f += c
      continue
    }
    if (c === '"') { quoted = true; continue }
    if (c === ',') { row.push(f); f = ''; continue }
    if (c === '\r') continue
    if (c === '\n') { row.push(f); f = ''; rows.push(row); row = []; continue }
    f += c
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row) }
  return rows
}

const input = [
  { id: 1, customer: 'He said "hi", then left', address: '1 A St', amount: 5 },
  { id: 2, customer: 'Plain', address: 'Line1\nLine2', amount: 2.5 },
  { id: 3, customer: 'Cy', address: '9 Elm Rd', amount: 120.25 },
]
const grid = parseCsv(toCsv(input))
const expected = [
  ['id', 'customer', 'address', 'amount'],
  ['1', 'He said "hi", then left', '1 A St', '5.00'],
  ['2', 'Plain', 'Line1\nLine2', '2.50'],
  ['3', 'Cy', '9 Elm Rd', '120.25'],
]
assert.deepStrictEqual(grid, expected, `round-trip mismatch:\n${JSON.stringify(grid)}`)
console.log('export-bug: hidden checks ok')
