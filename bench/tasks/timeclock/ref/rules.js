'use strict';

const BREAK_THRESHOLD = 360;
const BREAK_MINUTES = 30;
const ROUND_STEP = 15;
const DAILY_REGULAR_CAP = 480;

function round2(n) {
  const r = Math.sign(n) * (Math.round(Math.abs(n) * 100) / 100);
  return r === 0 ? 0 : r;
}

function roundUpTo(n, step) {
  return Math.ceil(n / step) * step;
}

function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function buildReport(shifts, errors, options) {
  const month = options.month || null;
  const rate = options.rate;

  const byDay = new Map();
  for (const shift of shifts) {
    if (month && shift.date.slice(0, 7) !== month) continue;
    const key = shift.employee + '\u0000' + shift.date;
    let rec = byDay.get(key);
    if (!rec) {
      rec = { employee: shift.employee, date: shift.date, raw: 0, inferred: false };
      byDay.set(key, rec);
    }
    rec.raw += shift.to - shift.from;
    if (shift.inferred) rec.inferred = true;
  }

  const perEmployee = new Map();
  for (const rec of byDay.values()) {
    const net = rec.raw > BREAK_THRESHOLD ? rec.raw - BREAK_MINUTES : rec.raw;
    const worked = roundUpTo(net, ROUND_STEP);
    const overtime = Math.max(0, worked - DAILY_REGULAR_CAP);
    const day = { date: rec.date, workedMinutes: worked, overtimeMinutes: overtime, inferred: rec.inferred };

    let emp = perEmployee.get(rec.employee);
    if (!emp) {
      emp = { days: [], regularMinutes: 0, overtimeMinutes: 0 };
      perEmployee.set(rec.employee, emp);
    }
    emp.days.push(day);
    emp.regularMinutes += worked - overtime;
    emp.overtimeMinutes += overtime;
  }

  const employees = {};
  let totalRegular = 0;
  let totalOvertime = 0;
  let totalPay = 0;
  for (const name of [...perEmployee.keys()].sort(cmp)) {
    const emp = perEmployee.get(name);
    emp.days.sort((a, b) => cmp(a.date, b.date));
    const pay = round2(((emp.regularMinutes + 1.5 * emp.overtimeMinutes) * rate) / 60);
    employees[name] = { days: emp.days, regularMinutes: emp.regularMinutes, overtimeMinutes: emp.overtimeMinutes, pay };
    totalRegular += emp.regularMinutes;
    totalOvertime += emp.overtimeMinutes;
    totalPay += pay;
  }

  const sortedErrors = errors
    .slice()
    .sort((a, b) => cmp(a.timestamp, b.timestamp) || cmp(a.employee, b.employee));

  return {
    employees,
    errors: sortedErrors,
    totals: { regularMinutes: totalRegular, overtimeMinutes: totalOvertime, pay: round2(totalPay) },
  };
}

module.exports = { round2, roundUpTo, buildReport };
