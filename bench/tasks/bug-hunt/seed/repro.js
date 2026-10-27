'use strict';
// Minimal reproducer for a single reported symptom.
const { createStore } = require('./store');
const { reserve } = require('./inventory');

const store = createStore();
store.stock.widget = 3;

const result = reserve(store, 'widget', 3);
if (!result.ok) {
  console.error('repro failed: a reservation was refused (' + result.error + ')');
  process.exit(1);
}

if (store.stock.widget !== 0) {
  console.error('repro failed: stock is ' + store.stock.widget + ' after the reservation');
  process.exit(1);
}

console.log('repro passed');
