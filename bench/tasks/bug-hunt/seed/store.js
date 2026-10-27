'use strict';
const fs = require('fs');

function createStore() {
  return { stock: {}, orders: {}, nextId: 1 };
}

function load(path) {
  const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
  return { stock: raw.stock || {}, orders: raw.orders || {}, nextId: raw.nextId || 1 };
}

module.exports = { createStore, load };
