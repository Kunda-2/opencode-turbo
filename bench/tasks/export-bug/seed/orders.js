const ORDERS = [
  { id: 1, customer: 'Ann Lee', address: '12 Main St', amount: 19.5 },
  { id: 2, customer: 'Bob Ray', address: '12 Main St, Apt 4', amount: 7 },
  { id: 3, customer: 'Cy Diaz', address: '9 Elm Rd', amount: 120.25 },
]

function toCsv(rows) {
  const lines = ['id,customer,address,amount']
  for (const r of rows) {
    lines.push([r.id, r.customer, r.address, r.amount.toFixed(2)].join(','))
  }
  return lines.join('\n') + '\n'
}

module.exports = { ORDERS, toCsv }
