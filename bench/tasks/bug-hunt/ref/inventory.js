'use strict';

function available(store, name) {
  return store.stock[name] || 0;
}

function reserve(store, item, qty) {
  const avail = available(store, item);
  if (qty > avail) return { ok: false, error: 'INSUFFICIENT' };
  store.stock[item] = avail - qty;
  const orderId = 'o' + store.nextId++;
  store.orders[orderId] = { item, qty };
  return { ok: true, orderId };
}

function release(store, orderId) {
  const order = store.orders[orderId];
  if (!order) return { ok: false, error: 'UNKNOWN_ORDER' };
  store.stock[order.item] = available(store, order.item) + order.qty;
  delete store.orders[orderId];
  return { ok: true };
}

function remove(store, name) {
  if (!Object.prototype.hasOwnProperty.call(store.stock, name)) return false;
  delete store.stock[name];
  return true;
}

module.exports = { reserve, release, remove };
