'use strict';

const DAY = 1440;

function toMinutes(timestamp) {
  return Date.parse(timestamp + ':00Z') / 60000;
}

function shiftEndMinutes(value) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function pair(punches, shiftEnd) {
  const byEmployee = new Map();
  for (const punch of punches) {
    if (!byEmployee.has(punch.employee)) byEmployee.set(punch.employee, []);
    byEmployee.get(punch.employee).push({ punch, at: toMinutes(punch.timestamp) });
  }

  const shifts = [];
  const errors = [];

  // Sorting per employee keeps equal timestamps in file order (Node sort is stable).
  for (const employee of byEmployee.keys()) {
    const list = byEmployee.get(employee).sort((a, b) => a.at - b.at);
    let open = null;
    for (const item of list) {
      if (item.punch.kind === 'in') {
        if (open) {
          errors.push({ employee, timestamp: item.punch.timestamp, reason: 'in without out' });
          continue;
        }
        open = item;
        continue;
      }
      if (!open) {
        errors.push({ employee, timestamp: item.punch.timestamp, reason: 'out without in' });
        continue;
      }
      shifts.push({ employee, date: open.punch.timestamp.slice(0, 10), from: open.at, to: item.at });
      open = null;
    }
    if (open) {
      const dayStart = open.at - (open.at % DAY);
      let end = dayStart + shiftEndMinutes(shiftEnd);
      if (end <= open.at) end = dayStart + DAY - 1;
      shifts.push({ employee, date: open.punch.timestamp.slice(0, 10), from: open.at, to: end, inferred: true });
    }
  }

  return { shifts, errors };
}

module.exports = { pair };
