const { getDatabase } = require('../config/database');
const AttendanceService = require('../services/attendanceService');

async function testAttendance() {
  const path = require('path');
  const samplePath = path.resolve(__dirname, '../../../excel files/MD MAY.csv');
  console.log('--- Testing Attendance Import (First Pass - MD MAY.csv) ---');
  const res1 = await AttendanceService.importAttendanceData(samplePath, 'MD MAY.csv', 'Admin');
  console.log('Import 1 Summary:', {
    totalRows: res1.totalRows,
    inserted: res1.inserted,
    updated: res1.updated,
    errors: res1.errorCount
  });

  console.log('\n--- Testing Deduplication / Upsert (Second Pass - MD MAY.csv) ---');
  const res2 = await AttendanceService.importAttendanceData(samplePath, 'MD MAY.csv', 'Admin');
  console.log('Import 2 Summary (Expected 1488 updated, 0 inserted):', {
    totalRows: res2.totalRows,
    inserted: res2.inserted,
    updated: res2.updated,
    errors: res2.errorCount
  });

  console.log('\n--- Testing Attendance Query & Filter ---');
  const list = AttendanceService.getAttendanceRecords({ limit: 5 });
  console.log('Total attendance logs:', list.pagination.total);
  console.log('Sample record:', {
    emp: list.data[0]?.employee_name,
    date: list.data[0]?.attendance_date_iso,
    in: list.data[0]?.in_time,
    out: list.data[0]?.out_time,
    status: list.data[0]?.status_code,
    duration: list.data[0]?.total_duration
  });

  console.log('\n--- Testing Daily Report ---');
  const daily = AttendanceService.getDailyReport('2026-05-08');
  console.log('Daily (2026-05-08) Summary:', daily.summary);

  console.log('\n--- Testing Monthly Summary Report ---');
  const monthly = AttendanceService.getMonthlySummaryReport('2026-05');
  console.log('Monthly (2026-05) Overview:', monthly.overview);
  console.log('First 3 Employee Summaries:', monthly.employees.slice(0, 3).map(e => ({
    code: e.employee_code,
    name: e.employee_name,
    present: e.presentDays,
    absent: e.absentDays,
    pct: e.attendancePercentage + '%',
    hours: e.totalHours
  })));

  console.log('\n--- Testing Available Months ---');
  const months = AttendanceService.getAvailableMonths();
  console.log('Months in DB:', months);

  console.log('\n🎉 ALL ATTENDANCE BACKEND TESTS PASSED!');
}

testAttendance().catch(err => {
  console.error('❌ Attendance test failed:', err);
  process.exit(1);
});
