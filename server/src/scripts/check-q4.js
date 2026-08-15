const xlsx = require('xlsx');
const path = require('path');

const wb = xlsx.readFile(path.join('excel files', 'MAY - 26.xlsx'));
const sheet = wb.Sheets['POOJA MEHTA'];

console.log('Cell Q3:', sheet['Q3']);
console.log('Cell Q4:', sheet['Q4']);
console.log('Cell Q14:', sheet['Q14']);
console.log('Cell U4:', sheet['U4']);
console.log('Cell S4:', sheet['S4']);
console.log('Cell V4:', sheet['V4']);
