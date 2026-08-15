const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const files = fs.readdirSync('excel files').filter(f => f.endsWith('.xlsx') && !f.startsWith('~'));

for (const f of files) {
  const wb = xlsx.readFile(path.join('excel files', f));
  for (const sName of wb.SheetNames) {
    const sheet = wb.Sheets[sName];
    if (!sheet) continue;
    for (let r = 1; r <= 40; r++) {
      for (const col of ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V']) {
        const cell = sheet[col + r];
        const val = String(cell?.v || cell?.w || '');
        if (val.includes('17:16') || val.includes('04:35') || val.includes('4:35') || (val.includes('10:20') && sheet['I' + r])) {
          console.log(`Found match in File: ${f}, Sheet: "${sName}", Row: ${r}:`);
          const rowData = {};
          ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'].forEach(c => {
            if (sheet[c + r]) {
              rowData[c] = {
                val: sheet[c + r].v,
                formatted: sheet[c + r].w,
                formula: sheet[c + r].f
              };
            }
          });
          console.log(JSON.stringify(rowData, null, 2));
        }
      }
    }
  }
}
