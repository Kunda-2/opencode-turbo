# Inventory

Two CommonJS modules in this directory, no dependencies:

- `store.js`
- `inventory.js`

## store.js

- `createStore()` returns a store `{ stock, orders, nextId }`.
  `stock` maps item name to quantity (a number), `orders` maps order id to `{ item, qty }`.
- `load(path)` reads a JSON file shaped like
  `{ "stock": { "<name>": <number> }, "orders": { "<id>": { "item": "<name>", "qty": <number> } }, "nextId": <number> }`
  and returns an equivalent store. Quantities are restored exactly, including floats such as `2.5` and `-1`.

## inventory.js

- `reserve(store, item, qty)`:
  - `available` is `store.stock[item] || 0`.
  - When `qty <= available` it returns `{ ok: true, orderId }`, reduces `stock[item]` by `qty` and records the order.
  - Otherwise it returns `{ ok: false, error: 'INSUFFICIENT' }` and changes nothing.
- `release(store, orderId)`:
  - It adds the order quantity back to `stock[order.item]` and returns `{ ok: true }`.
  - It is idempotent: releasing the same order a second time returns `{ ok: false, error: 'UNKNOWN_ORDER' }`
    and must not change stock.
- `remove(store, name)`:
  - Deletes the item and returns `true`.
  - If the item is absent it returns `false` and changes nothing.

Stock must never be negative as a result of these operations.

`node repro.js` must exit 0 once the code is correct.
