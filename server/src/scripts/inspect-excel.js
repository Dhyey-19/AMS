const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const files = fs.readdirSync('excel files').filter(f => f.endsWith('.xlsx') && !f.startsWith('~'));
console.log('Found files:', files);

for (const f of files) {
  const wb = xlsx.readFile(path.join('excel files', f));
  console.log('\n========================================');
  console.log('Workbook:', f);
  console.log('========================================');
  
  for (const sName of wb.SheetNames) {
    const sheet = wb.Sheets[sName];
    if (!sheet) continue;

    for (let r = 2; r <= 35; r++) {
      const cellDate = sheet['A' + r];
      const cellStatus = sheet['B' + r];
      const cellOT = sheet['Q' + r];
      const cellAin = sheet['H' + r];
      const cellAout = sheet['I' + r];
      const cellDur = sheet['J' + r];
      const cellWork = sheet['N' + r];
      const cellLate = sheet['P' + r];
      const cellRate = sheet['R' + r];
      const cellSal = sheet['S' + r];
      const cellLateSal = sheet['T' + r];
      const cellOtPay = sheet['U' + r];
      const cellTotSal = sheet['V' + r];

      // Check if this matches 2-May or any WO with punches or overtime
      const dateVal = String(cellDate?.v || cellDate?.w || '');
      const statusVal = String(cellStatus?.v || '').trim();

      if (dateVal.includes('2-May') || dateVal.includes('02-May') || (statusVal === 'WO' && cellAin)) {
        console.log(`Sheet: "${sName}", Row ${r}:`);
        console.log({
          Date: dateVal,
          Status: statusVal,
          SchedIn: sheet['C' + r]?.v || sheet['C' + r]?.w,
          SchedOut: sheet['D' + r]?.v || sheet['D' + r]?.w,
          SchedDur: sheet['E' + r]?.v || sheet['E' + r]?.w,
          SchedWork: sheet['G' + r]?.v || sheet['G' + r]?.w,
          ActualIn: cellAin?.v || cellAin?.w,
          ActualOut: cellAout?.v || cellAout?.w,
          ActualDur: cellDur?.v || cellDur?.w,
          ActualWork: cellWork?.v || cellWork?.w,
          Diff: sheet['O' + r]?.v || sheet['O' + r]?.w,
          Late: cellLate?.v || cellLate?.w,
          OT: cellOT?.v || cellOT?.w,
          OT_formula: cellOT?.f || 'none',
          Rate: cellRate?.v,
          Salary: cellSal?.v,
          LateSalary: cellLateSal?.v,
          OTPay: cellOtPay?.v,
          TotSalary: cellTotSal?.v
        });
      }
    }
  }
}
