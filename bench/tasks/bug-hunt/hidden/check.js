'use strict';
// Hidden acceptance for bug-hunt. Only checks behaviour stated in seed/SPEC.md.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const cwd = process.argv[2];
const storeApi = require(path.join(cwd, 'store.js'));
const inv = require(path.join(cwd, 'inventory.js'));

function fresh(stock) {
  const s = storeApi.createStore();
  Object.assign(s.stock, stock);
  return s;
}

// boundary: qty === available is allowed
let s = fresh({ widget: 3 });
let r = inv.reserve(s, 'widget', 3);
assert.strictEqual(r.ok, true, 'reserve of exactly the available quantity must succeed');
assert.strictEqual(s.stock.widget, 0, 'reserve must reduce stock to 0');
assert.ok(r.orderId, 'reserve must return an orderId');

// over available -> INSUFFICIENT, nothing changes
s = fresh({ widget: 3 });
r = inv.reserve(s, 'widget', 4);
assert.deepStrictEqual(r, { ok: false, error: 'INSUFFICIENT' }, 'reserve above available');
assert.strictEqual(s.stock.widget, 3, 'failed reserve must not change stock');

// double release is idempotent and stock stays correct
s = fresh({ widget: 5 });
const reserved = inv.reserve(s, 'widget', 2);
assert.strictEqual(reserved.ok, true, 'reserve 2 of 5');
assert.strictEqual(s.stock.widget, 3, 'stock after reserve');
assert.strictEqual(inv.release(s, reserved.orderId).ok, true, 'first release succeeds');
assert.strictEqual(s.stock.widget, 5, 'release restores stock');
const second = inv.release(s, reserved.orderId);
assert.deepStrictEqual(second, { ok: false, error: 'UNKNOWN_ORDER' }, 'second release');
assert.strictEqual(s.stock.widget, 5, 'second release must not change stock');
assert.ok(s.stock.widget >= 0, 'stock must not be negative');

// release of an unknown order
s = fresh({ widget: 1 });
assert.deepStrictEqual(inv.release(s, 'nope'), { ok: false, error: 'UNKNOWN_ORDER' }, 'release unknown order');
assert.strictEqual(s.stock.widget, 1, 'unknown release must not change stock');

// remove
s = fresh({ widget: 1 });
assert.strictEqual(inv.remove(s, 'nope'), false, 'remove absent');
assert.strictEqual(s.stock.widget, 1, 'remove absent must not change stock');
assert.strictEqual(inv.remove(s, 'widget'), true, 'remove present');
assert.ok(!('widget' in s.stock), 'remove present must delete the item');

// load round-trip keeps floats exact
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-hunt-'));
const file = path.join(dir, 'store.json');
fs.writeFileSync(file, JSON.stringify({ stock: { widget: 2.5, gadget: -1 }, orders: {}, nextId: 1 }));
const loaded = storeApi.load(file);
assert.strictEqual(loaded.stock.widget, 2.5, 'load float 2.5');
assert.strictEqual(loaded.stock.gadget, -1, 'load float -1');
fs.rmSync(dir, { recursive: true, force: true });

console.log('bug-hunt: hidden checks ok');
