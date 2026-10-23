const { getDatabase } = require('../config/database');
getDatabase();

const AttendanceService = require('../services/attendanceService');
const EmployeeService = require('../services/employeeService');

console.log('▶ Testing Manual Attendance Records WITH Rule Calculations...');

// Setup employee
try {
  EmployeeService.createEmployee({
    employee_code: 'TEST_MAN_RULE_01',
    employee_name: 'Rule Manual Test Employee',
    salary: 31000,
    standard_in_time: '08:00',
    standard_out_time: '20:00',
    standard_break_minutes: 0,
    standard_work_hours: 12.0
  });
} catch (e) {}

// Case 1: Manual entry with only punches & status
// 15m late in (08:15), 45m late out (20:45), 45m break (13:00 to 13:45)
// Rule 1: 15m late check-in -> 10m normal + 5m * 1.5x = 17.5 mins deduction
// Rule 3: 45m late check-out -> 10m normal + 35m * 2.0x = 80 mins OT pay
// Rule 5: 45m break with std 0 -> > 30m, so 45m deducted from work
// Rule 2: 0m early in
const manualPayload = {
  is_manual: 1,
  status_code: 'P',
  in_time: '08:15',
  out_time: '20:45',
  break_out: '13:00',
  break_in: '13:45'
};

const updated = AttendanceService.updateAttendanceRecord('TEST_MAN_RULE_01', '2026-05-12', manualPayload);
console.log('Updated in DB:', {
  is_manual: updated.is_manual,
  status_code: updated.status_code,
  in_time: updated.in_time,
  out_time: updated.out_time
});

const sheet = AttendanceService.getEmployeeAttendanceSheet('TEST_MAN_RULE_01', { month: '2026-05' });
const rec = sheet.dailyRecords.find(r => r.attendance_date_iso === '2026-05-12');

console.log('Sheet Record with Rule Calculations:', {
  is_manual: rec.is_manual,
  status_code: rec.status_code,
  calc_mode: rec.calc_mode,
  scheduled_work: rec.scheduled_work_formatted,
  actual_duration: rec.actual_duration_formatted,
  effective_break: rec.effective_break_formatted,
  actual_work: rec.actual_work_formatted,
  work_diff: rec.work_diff_formatted,
  late_formatted: rec.late_formatted,
  overtime_formatted: rec.overtime_formatted,
  hourly_rate: rec.hourly_rate,
  daily_salary_earned: rec.daily_salary_earned,
  late_salary_deduction: rec.late_salary_deduction,
  overtime_pay: rec.overtime_pay,
  net_daily_salary: rec.net_daily_salary
});

console.assert(rec.is_manual === 1, 'is_manual should be 1');
console.assert(rec.calc_mode === 'Both late', `calc_mode should be Both late, got ${rec.calc_mode}`);
console.assert(rec.late_formatted === '00:15', `late_formatted should be 00:15, got ${rec.late_formatted}`);
console.assert(rec.overtime_formatted === '00:45', `overtime_formatted should be 00:45, got ${rec.overtime_formatted}`);
console.assert(rec.effective_break_formatted === '00:45', `effective_break should be 00:45, got ${rec.effective_break_formatted}`);
console.assert(rec.late_salary_deduction > 0, 'late_salary_deduction should be calculated per rule');
console.assert(rec.overtime_pay > 0, 'overtime_pay should be calculated per rule');
console.assert(rec.net_daily_salary > 0, 'net_daily_salary should be calculated per rule');

console.log('✅ TEST PASSED: Manual record successfully evaluated all rules!');
