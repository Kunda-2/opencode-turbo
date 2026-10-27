const assert = require('assert')
const { ORDERS, toCsv } = require('./orders')

const csv = toCsv(ORDERS)
const lines = csv.trimEnd().split('\n')

assert.strictEqual(lines[0], 'id,customer,address,amount', 'header')
assert.strictEqual(lines[3], '3,Cy Diaz,9 Elm Rd,120.25', 'plain row')
assert.strictEqual(toCsv([{ id: 9, customer: 'Z', address: 'A', amount: 1 }]).trimEnd().split('\n')[1], '9,Z,A,1.00', '2 decimals')
// fails today: the comma inside the address splits the field
assert.strictEqual(lines[2], '2,Bob Ray,"12 Main St, Apt 4",7.00', 'quoted address')
console.log('all tests passed')
