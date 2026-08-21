/**
 * Test script to verify W.E.F. (With Effect From) salary revisions,
 * shift schedule changes, and mid-month dynamic calculations.
 */

const { getDatabase } = require('../config/database');
const EmployeeService = require('../services/employeeService');
const CalculationEngine = require('../services/calculationEngine');
const AttendanceService = require('../services/attendanceService');

async function runWefTests() {
  console.log('--- Starting W.E.F. (With Effect From) System Tests ---');
  const db = getDatabase();

  const testEmpCode = 'TEST_WEF_999';

  // Cleanup prior test data
  db.prepare('DELETE FROM attendance WHERE employee_code = ?').run(testEmpCode);
  db.prepare('DELETE FROM employee_wef_history WHERE employee_code = ?').run(testEmpCode);
  db.prepare('DELETE FROM employees WHERE employee_code = ?').run(testEmpCode);

  console.log('1. Creating test employee with baseline Salary ₹30,000, 08:00-20:00 shift, 00:00 break...');
  const created = EmployeeService.createEmployee({
    employee_code: testEmpCode,
    employee_name: 'Test WEF Employee',
    department: 'Medical Officer',
    designation: 'Doctor',
    salary: 30000,
    incentive: 0,
    wef_date: '2026-05-01',
    standard_in_time: '08:00',
    standard_out_time: '20:00',
    standard_break_time: '00:00',
    standard_work_hours: '12:00',
    payment_mode: 'Bank'
  });

  console.log('Created emp baseline wef_date:', created.wef_date, 'Salary:', created.salary);
  console.log('WEF history records count:', created.wef_history?.length);

  if (created.wef_history?.length !== 1) {
    throw new Error(`Expected 1 baseline WEF history record, got ${created.wef_history?.length}`);
  }

  console.log('2. Adding Mid-Month WEF revision from 2026-05-15: Salary ₹45,000, 09:00-18:00 shift, 01:00 break...');
  const updatedEmp = EmployeeService.addWefRevision(testEmpCode, {
    effective_date: '2026-05-15',
    salary: 45000,
    incentive: 1000,
    standard_in_time: '09:00',
    standard_out_time: '18:00',
    standard_break_time: '01:00',
    standard_work_hours: '08:00',
    payment_mode: 'Bank',
    remarks: 'Promotion to Senior Consultant'
  });

  const history = EmployeeService.getWefHistory(testEmpCode);
  console.log(`Fetched ${history.length} WEF revisions:`);
  history.forEach(h => {
    console.log(`  - W.E.F. ${h.effective_date}: Salary ₹${h.salary}, Shift ${h.standard_in_time}-${h.standard_out_time}, Break ${h.standard_break_minutes}m, Target ${h.standard_work_hours}h (${h.remarks})`);
  });

  if (history.length !== 2) {
    throw new Error(`Expected 2 WEF revisions, got ${history.length}`);
  }

  console.log('3. Generating month sheet for 2026-05 (31 days)...');
  // Day 1 to 14: Present full day 08:00 to 20:00
  // Day 15 to 31: Present full day 09:00 to 18:00
  const records = [];
  for (let d = 1; d <= 31; d++) {
    const dayStr = String(d).padStart(2, '0');
    const isoDate = `2026-05-${dayStr}`;
    if (d < 15) {
      records.push({
        employee_code: testEmpCode,
        attendance_date_iso: isoDate,
        attendance_date: `${d}-May-2026`,
        in_time: '08:00',
        out_time: '20:00',
        break_out: '',
        break_in: '',
        status_code: 'P'
      });
    } else {
      records.push({
        employee_code: testEmpCode,
        attendance_date_iso: isoDate,
        attendance_date: `${d}-May-2026`,
        in_time: '09:00',
        out_time: '18:00',
        break_out: '13:00',
        break_in: '14:00',
        status_code: 'P'
      });
    }
  }

  const sheet = CalculationEngine.calculateEmployeeMonthSheet(updatedEmp, records, '2026-05');
  console.log('Calculation summary:');
  console.log('  - isMultiWefMonth:', sheet.summary.isMultiWefMonth);
  console.log('  - wefDatesUsed:', sheet.summary.wefDatesUsed);
  console.log('  - grossEarnedSalary: ₹' + sheet.summary.grossEarnedSalary);
  console.log('  - netPayableSalary: ₹' + sheet.summary.netPayableSalary);

  // Check Day 5
  const day5 = sheet.dailyRecords[4];
  console.log(`Day 5 (Before 15th): W.E.F. ${day5.wef_date}, Eff Salary: ₹${day5.effective_salary}, Sched In/Out: ${day5.scheduled_in_time}-${day5.scheduled_out_time}, Sched Break: ${day5.scheduled_break_formatted}, Daily Rate: ₹${day5.daily_rate}, Earned: ₹${day5.daily_salary_earned}`);

  // Check Day 20
  const day20 = sheet.dailyRecords[19];
  console.log(`Day 20 (From 15th onwards): W.E.F. ${day20.wef_date}, Eff Salary: ₹${day20.effective_salary}, Sched In/Out: ${day20.scheduled_in_time}-${day20.scheduled_out_time}, Sched Break: ${day20.scheduled_break_formatted}, Daily Rate: ₹${day20.daily_rate}, Earned: ₹${day20.daily_salary_earned}`);

  if (day5.effective_salary !== 30000 || day20.effective_salary !== 45000) {
    throw new Error(`Dynamic effective salary resolution failed! Day 5: ${day5.effective_salary}, Day 20: ${day20.effective_salary}`);
  }

  if (day5.scheduled_in_time !== '08:00' || day20.scheduled_in_time !== '09:00') {
    throw new Error(`Dynamic shift resolution failed! Day 5 in: ${day5.scheduled_in_time}, Day 20 in: ${day20.scheduled_in_time}`);
  }

  if (day5.scheduled_break_minutes !== 0 || day20.scheduled_break_minutes !== 60) {
    throw new Error(`Dynamic break resolution failed! Day 5 break: ${day5.scheduled_break_minutes}, Day 20 break: ${day20.scheduled_break_minutes}`);
  }

  console.log('4. Testing AttendanceService.getEmployeeAttendanceSheet integration...');
  // Insert test attendance into db
  const insertAttStmt = db.prepare(`
    INSERT INTO attendance (
      employee_code, attendance_date, attendance_date_iso, employee_name,
      designation, department, in_time, out_time, break_out, break_in,
      status_code, created_at
    ) VALUES (
      @employee_code, @attendance_date, @attendance_date_iso, 'Test WEF Employee',
      'Doctor', 'Medical Officer', @in_time, @out_time, @break_out, @break_in,
      @status_code, CURRENT_TIMESTAMP
    )
  `);

  records.forEach(r => insertAttStmt.run(r));

  const serviceSheet = AttendanceService.getEmployeeAttendanceSheet(testEmpCode, { month: '2026-05' });
  console.log('AttendanceService Month Sheet:');
  console.log('  - isMultiWefMonth:', serviceSheet.summary.isMultiWefMonth);
  console.log('  - Present days:', serviceSheet.summary.presentDays);
  console.log('  - Net Salary:', serviceSheet.summary.totalNetSalaryEarned);

  if (!serviceSheet.summary.isMultiWefMonth) {
    throw new Error('AttendanceService should identify multi-WEF month');
  }

  // Cleanup test employee
  db.prepare('DELETE FROM attendance WHERE employee_code = ?').run(testEmpCode);
  db.prepare('DELETE FROM employee_wef_history WHERE employee_code = ?').run(testEmpCode);
  db.prepare('DELETE FROM employees WHERE employee_code = ?').run(testEmpCode);

  console.log('\nAll W.E.F. system and dynamic calculation tests passed successfully!');
}

runWefTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
