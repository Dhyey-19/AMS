const { getDatabase } = require('../config/database');
getDatabase();

const AttendanceService = require('../services/attendanceService');
const EmployeeService = require('../services/employeeService');

console.log('▶ Testing Manual Attendance Records (Type and Save Only, No Salary Rules)...');

// 1. Setup employee
try {
  EmployeeService.createEmployee({
    employee_code: 'TEST_MANUAL_01',
    employee_name: 'Manual Test Employee',
    salary: 31000,
    standard_in_time: '08:00',
    standard_out_time: '20:00',
    standard_break_minutes: 0,
    standard_work_hours: 12.0
  });
} catch (e) {}

// 2. Save a manual record with custom arbitrary values (bypassing all rules)
// e.g. late by 45 mins, but late_deduction is explicitly set to 0 or 25 (not the 1.5x rule amount)
// and daily_salary is custom 1500, net_daily_salary is 1620, etc.
const manualPayload = {
  is_manual: 1,
  status_code: 'P',
  calc_mode: 'Custom Manual',
  scheduled_in_time: '09:00',
  scheduled_out_time: '18:00',
  scheduled_work_formatted: '09:00',
  in_time: '09:45',
  out_time: '19:15',
  actual_duration_formatted: '09:30',
  break_out: '13:00',
  break_in: '13:45',
  effective_break_formatted: '00:45',
  actual_work_formatted: '08:45',
  work_diff_formatted: '-00:15',
  late_formatted: '00:45',
  overtime_formatted: '01:15',
  hourly_rate: 150,
  daily_salary_earned: 1500,
  late_salary_deduction: 25,
  overtime_pay: 145,
  leave_deduction: 0,
  penalty_amount: 0,
  net_daily_salary: 1620,
  remarks: 'Admin custom manual typed values'
};

const updated = AttendanceService.updateAttendanceRecord('TEST_MANUAL_01', '2026-05-10', manualPayload);
console.log('Updated in DB:', {
  is_manual: updated.is_manual,
  status_code: updated.status_code,
  daily_salary: updated.daily_salary,
  late_deduction: updated.late_deduction,
  net_daily_salary: updated.net_daily_salary
});

// 3. Fetch calculated month sheet
const sheet = AttendanceService.getEmployeeAttendanceSheet('TEST_MANUAL_01', { month: '2026-05' });
const rec = sheet.dailyRecords.find(r => r.attendance_date_iso === '2026-05-10');

console.log('Sheet Record:', {
  is_manual: rec.is_manual,
  status_code: rec.status_code,
  calc_mode: rec.calc_mode,
  scheduled_work: rec.scheduled_work_formatted,
  actual_duration: rec.actual_duration_formatted,
  actual_work: rec.actual_work_formatted,
  late_formatted: rec.late_formatted,
  daily_salary_earned: rec.daily_salary_earned,
  late_salary_deduction: rec.late_salary_deduction,
  overtime_pay: rec.overtime_pay,
  net_daily_salary: rec.net_daily_salary,
  remarks: rec.remarks
});

console.assert(rec.is_manual === 1, 'is_manual should be 1');
console.assert(rec.calc_mode === 'Custom Manual', 'calc_mode should be preserved exactly');
console.assert(rec.daily_salary_earned === 1500, 'daily_salary_earned should be 1500 without rule override');
console.assert(rec.late_salary_deduction === 25, 'late_salary_deduction should be 25 without 1.5x rule');
console.assert(rec.overtime_pay === 145, 'overtime_pay should be 145 without 2.0x rule');
console.assert(rec.net_daily_salary === 1620, 'net_daily_salary should be 1620 without rule override');
console.assert(rec.actual_work_formatted === '08:45', 'actual_work should be 08:45');

// 4. Test reverting back to automatic (is_manual: 0)
const reverted = AttendanceService.updateAttendanceRecord('TEST_MANUAL_01', '2026-05-10', {
  is_manual: 0,
  status_code: 'P',
  in_time: '08:00',
  out_time: '20:00'
});
const sheetAuto = AttendanceService.getEmployeeAttendanceSheet('TEST_MANUAL_01', { month: '2026-05' });
const recAuto = sheetAuto.dailyRecords.find(r => r.attendance_date_iso === '2026-05-10');
console.log('Reverted to Auto:', {
  is_manual: recAuto.is_manual,
  calc_mode: recAuto.calc_mode,
  daily_salary_earned: recAuto.daily_salary_earned,
  net_daily_salary: recAuto.net_daily_salary
});
console.assert(recAuto.is_manual === 0, 'Should be auto record');
console.assert(recAuto.calc_mode === 'Normal', 'Should recompute Normal calc_mode');

console.log('✅ TEST PASSED: Manual record saved & returned without any calculations or salary rules! (And revert to auto works)');
