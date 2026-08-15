const xlsx = require('xlsx');
const path = require('path');

const wb = xlsx.readFile(path.join('excel files', 'MAY - 26.xlsx'));
const sheet = wb.Sheets['POOJA MEHTA'];

console.log('POOJA MEHTA rows 1 to 35:');
for (let r = 1; r <= 35; r++) {
  const row = {};
  ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V'].forEach(c => {
    if (sheet[c + r]) {
      row[c] = sheet[c + r].w || sheet[c + r].v;
    }
  });
  if (Object.keys(row).length > 0) {
    console.log(`Row ${r}:`, row);
  }
}
