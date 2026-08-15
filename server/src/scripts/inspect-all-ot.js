const xlsx = require('xlsx');
const path = require('path');

const wb = xlsx.readFile(path.join('excel files', 'MAY - 26.xlsx'));

for (const sName of wb.SheetNames) {
  const sheet = wb.Sheets[sName];
  if (!sheet) continue;
  for (let r = 3; r <= 35; r++) {
    const qCell = sheet['Q' + r];
    if (qCell && qCell.v && qCell.v !== 'OVER TIME' && typeof qCell.v === 'number') {
      const qMins = Math.round(qCell.v * 1440);
      const h = Math.floor(qMins / 60);
      const m = qMins % 60;
      const otFormatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      
      const bStatus = sheet['B' + r]?.v;
      const cSin = sheet['C' + r]?.w || sheet['C' + r]?.v;
      const dSout = sheet['D' + r]?.w || sheet['D' + r]?.v;
      const hAin = sheet['H' + r]?.w || sheet['H' + r]?.v;
      const iAout = sheet['I' + r]?.w || sheet['I' + r]?.v;
      const jDur = sheet['J' + r]?.w || sheet['J' + r]?.v;
      const nWork = sheet['N' + r]?.w || sheet['N' + r]?.v;

      console.log(`Sheet: ${sName.padEnd(14)}, Row ${String(r).padStart(2)}: Status=${bStatus}, S.In=${cSin}, S.Out=${dSout}, A.In=${hAin}, A.Out=${iAout}, Work=${nWork}, OT=${otFormatted}`);
    }
  }
}
