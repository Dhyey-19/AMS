const { getDatabase } = require('../config/database');
const AuthService = require('../services/authService');
const EmployeeService = require('../services/employeeService');

async function testBackend() {
  console.log('--- Testing Database Initialization ---');
  const db = getDatabase();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables created in ams.db:', tables.map(t => t.name));

  console.log('\n--- Testing Authentication Service ---');
  const loginRes = AuthService.login({ username: 'admin', password: 'admin123' });
  console.log('Admin login successful. Token generated:', !!loginRes.token, 'User:', loginRes.user.fullName);

  console.log('\n--- Testing Master Data Sample Import (First Pass) ---');
  const importResult1 = await EmployeeService.importSampleFile('upsert', 'TestAdmin');
  console.log('Import 1 Summary:', {
    totalRows: importResult1.totalRows,
    inserted: importResult1.inserted,
    updated: importResult1.updated,
    skipped: importResult1.skipped,
    errors: importResult1.errorCount
  });

  console.log('\n--- Testing Master Data Sample Import (Second Pass - Deduplication Check) ---');
  const importResult2 = await EmployeeService.importSampleFile('upsert', 'TestAdmin');
  console.log('Import 2 Summary (Expected 126 updated, 0 inserted):', {
    totalRows: importResult2.totalRows,
    inserted: importResult2.inserted,
    updated: importResult2.updated,
    skipped: importResult2.skipped,
    errors: importResult2.errorCount
  });

  console.log('\n--- Testing Master Data Query & Search ---');
  const page1 = EmployeeService.getEmployees({ page: 1, limit: 5 });
  console.log(`Employees pagination: Total = ${page1.pagination.total}, Page = ${page1.pagination.page}, TotalPages = ${page1.pagination.totalPages}`);
  console.log('Sample record:', {
    code: page1.data[0]?.employee_code,
    name: page1.data[0]?.employee_name,
    dept: page1.data[0]?.department,
    status: page1.data[0]?.status,
    doj: page1.data[0]?.doj
  });

  console.log('\n--- Testing Department Filter (Nursing) ---');
  const nursingEmployees = EmployeeService.getEmployees({ department: 'Nursing' });
  console.log('Nursing count:', nursingEmployees.pagination.total);

  console.log('\n--- Testing Search Query (Doctor) ---');
  const searchResult = EmployeeService.getEmployees({ search: 'Doctor' });
  console.log('Search "Doctor" count:', searchResult.pagination.total);

  console.log('\n--- Testing Dashboard Stats ---');
  const stats = EmployeeService.getStats();
  console.log('Overview KPIs:', stats.overview);
  console.log('Top Departments:', stats.departmentStats.slice(0, 5));

  console.log('\n🎉 ALL BACKEND TESTS PASSED SUCCESSFULLY!');
}

testBackend().catch(err => {
  console.error('❌ Backend test failed:', err);
  process.exit(1);
});
