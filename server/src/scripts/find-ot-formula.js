const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const files = fs.readdirSync('excel files').filter(f => f.endsWith('.xlsx') && !f.startsWith('~'));

for (const f of files) {
  const wb = xlsx.readFile(path.join('excel files', f));
  for (const sName of wb.SheetNames) {
    const sheet = wb.Sheets[sName];
    if (!sheet) continue;
    for (let r = 3; r <= 35; r++) {
      const cellQ = sheet['Q' + r];
      if (cellQ && (cellQ.f || cellQ.v)) {
        console.log(`File: ${f}, Sheet: "${sName}", Row ${r} -> Q formula: ${cellQ.f || 'none'}, value: ${cellQ.v}, formatted: ${cellQ.w}`);
        // print a few formulas only
        break;
      }
    }
  }
}
