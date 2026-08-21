/**
 * Test script for Master Data Complete Export & Import Verification
 */

const { getDatabase } = require('../config/database');
const EmployeeService = require('../services/employeeService');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

async function runMasterExportImportTest() {
  console.log('--- Testing Full Master Data Export & Import ---');
  const db = getDatabase();

  // 1. Check total count of employees in db
  const totalInDb = db.prepare('SELECT COUNT(*) as count FROM employees').get().count;
  console.log(`Current Total Employees in Database: ${totalInDb}`);

  // 2. Test Export to XLSX
  console.log('1. Testing Master Data Export to XLSX...');
  const xlsxExport = EmployeeService.exportMasterData({ format: 'xlsx' });
  console.log(`Generated XLSX Buffer Size: ${xlsxExport.buffer.length} bytes, Filename: ${xlsxExport.filename}`);

  const parsedWb = xlsx.read(xlsxExport.buffer, { type: 'buffer' });
  console.log(`Exported Workbook Sheets: ${parsedWb.SheetNames.join(', ')}`);

  if (!parsedWb.SheetNames.includes('Employee Master Data')) {
    throw new Error('Missing "Employee Master Data" sheet in XLSX export');
  }

  const masterSheet = parsedWb.Sheets['Employee Master Data'];
  const masterRows = xlsx.utils.sheet_to_json(masterSheet);
  console.log(`Exported Employees Count in XLSX: ${masterRows.length}`);

  if (masterRows.length !== totalInDb) {
    throw new Error(`Expected ${totalInDb} exported employees, got ${masterRows.length}`);
  }

  // Check columns in first row
  const firstRow = masterRows[0];
  console.log('Sample Exported Employee Fields (First Record):', Object.keys(firstRow));
  
  const requiredColumns = [
    'EmployeeCode', 'EmployeeName', 'Department', 'Designation', 'Salary', 'Incentive',
    'WEFDate', 'StandardInTime', 'StandardOutTime', 'StandardBreakTime', 'StandardBreakMinutes',
    'StandardWorkHours', 'PaymentMode', 'LateGraceMinutes', 'LateDeductionMultiplier',
    'OvertimeMultiplier', 'OvertimeAllowed', 'WOP', 'YPL', 'SpecialRules'
  ];

  for (const col of requiredColumns) {
    if (!(col in firstRow)) {
      throw new Error(`Missing expected column "${col}" in exported Master Data`);
    }
  }

  // 3. Test Export to CSV
  console.log('2. Testing Master Data Export to CSV...');
  const csvExport = EmployeeService.exportMasterData({ format: 'csv' });
  console.log(`Generated CSV Buffer Size: ${csvExport.buffer.length} bytes, Filename: ${csvExport.filename}`);

  const csvLines = csvExport.buffer.toString('utf-8').trim().split('\n');
  console.log(`CSV Lines Count (Header + Rows): ${csvLines.length}`);

  if (csvLines.length !== totalInDb + 1) {
    throw new Error(`Expected ${totalInDb + 1} CSV lines, got ${csvLines.length}`);
  }

  // 4. Test Re-Import from the exported XLSX
  console.log('3. Testing Re-Import from exported XLSX file...');
  const tempFilePath = path.join(__dirname, 'temp_test_export.xlsx');
  fs.writeFileSync(tempFilePath, xlsxExport.buffer);

  const importResult = await EmployeeService.importMasterData(tempFilePath, 'temp_test_export.xlsx', 'upsert', 'TestAdmin');
  console.log('Import Result:', importResult);

  if (importResult.updated !== totalInDb) {
    throw new Error(`Expected ${totalInDb} updated records on upsert re-import, got ${importResult.updated}`);
  }

  if (fs.existsSync(tempFilePath)) {
    fs.unlinkSync(tempFilePath);
  }

  console.log('\n✅ All Master Data Export & Import tests PASSED with 100% of fields and records!');
}

runMasterExportImportTest().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
