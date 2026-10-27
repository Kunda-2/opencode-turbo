'use strict';
const fs = require('fs');

function load(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const data = JSON.parse(text);
  return Array.isArray(data.punches) ? data.punches : [];
}

function id(punch) {
  return punch.employee + '\u0000' + punch.timestamp + '\u0000' + punch.kind;
}

function save(file, punches) {
  const merged = load(file);
  const seen = new Set(merged.map(id));
  for (const punch of punches) {
    const key = id(punch);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(punch);
  }
  fs.writeFileSync(file, JSON.stringify({ punches: merged }) + '\n');
}

module.exports = { load, save };
