'use strict';

const CAPS = { meals: 100, transport: 200, hotel: 600, other: 0 };

function round2(n) {
  const r = Math.sign(n) * (Math.round(Math.abs(n) * 100) / 100);
  return r === 0 ? 0 : r;
}

function isWeekend(date) {
  const day = new Date(date + 'T00:00:00Z').getUTCDay();
  return day === 0 || day === 6;
}

function evaluate(records) {
  let rejected = 0;
  let total = 0;
  const catSum = new Map();
  const empSum = new Map();
  const overSum = new Map();

  for (const rec of records) {
    if (rec.currency !== 'CNY' || !Object.prototype.hasOwnProperty.call(CAPS, rec.category)) {
      rejected++;
      continue;
    }
    const amount = round2(Number(rec.amount));
    total += amount;
    catSum.set(rec.category, (catSum.get(rec.category) || 0) + amount);
    empSum.set(rec.employee, (empSum.get(rec.employee) || 0) + amount);

    const cap = CAPS[rec.category] * (isWeekend(rec.date) ? 1.5 : 1);
    if (amount > cap) {
      overSum.set(rec.employee, (overSum.get(rec.employee) || 0) + (amount - cap));
    }
  }

  const byCategory = {};
  for (const key of [...catSum.keys()].sort()) byCategory[key] = round2(catSum.get(key));

  const byEmployee = {};
  for (const key of [...empSum.keys()].sort()) byEmployee[key] = round2(empSum.get(key));

  const flagged = [...overSum.entries()]
    .map(([employee, over]) => ({ employee, over: round2(over) }))
    .sort((a, b) => b.over - a.over || (a.employee < b.employee ? -1 : a.employee > b.employee ? 1 : 0));

  return { total: round2(total), byCategory, byEmployee, flagged, rejected };
}

module.exports = { CAPS, round2, isWeekend, evaluate };
