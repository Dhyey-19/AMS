const { getDatabase } = require('../config/database');
const AttendanceService = require('../services/attendanceService');
const EmployeeService = require('../services/employeeService');

console.log('Testing direct attendance record editing in database...');

// 1. Create a dummy employee if not exists
try {
  EmployeeService.createEmployee({
    employee_code: 'TEST_EMP_99',
    employee_name: 'Test Record Editor',
    salary: 31000,
    standard_in_time: '08:00',
    standard_out_time: '20:00',
    standard_break_minutes: 0,
    standard_work_hours: 12.0
  });
} catch (e) {
  // Already exists
}

// 2. Direct edit / upsert record
const updatedRow = AttendanceService.updateAttendanceRecord('TEST_EMP_99', '2026-05-15', {
  status_code: 'P',
  in_time: '08:05',
  out_time: '20:05',
  break_out: '13:00',
  break_in: '13:30',
  penalty_amount: 50,
  remarks: 'Manual correction by admin'
});

console.log('Updated Row in SQLite DB:', updatedRow);
console.assert(updatedRow.in_time === '08:05', 'In time update failed');
console.assert(updatedRow.out_time === '20:05', 'Out time update failed');
console.assert(updatedRow.penalty_amount === 50, 'Penalty update failed');
console.assert(updatedRow.remarks === 'Manual correction by admin', 'Remarks update failed');

// 3. Test on-the-fly sheet recalculation
const sheet = AttendanceService.getEmployeeAttendanceSheet('TEST_EMP_99', { month: '2026-05' });
const dayRec = sheet.dailyRecords.find(r => r.attendance_date_iso === '2026-05-15');

console.log('Recalculated Day Record from DB:', {
  date: dayRec.attendance_date_iso,
  calc_mode: dayRec.calc_mode,
  duration: dayRec.actual_duration_formatted,
  penalty: dayRec.penalty_amount,
  net_salary: dayRec.net_daily_salary
});

console.assert(dayRec.calc_mode === 'Normal', 'Calc mode failed');
console.assert(dayRec.actual_duration_formatted === '12:05', 'Duration failed');
console.assert(dayRec.penalty_amount === 50, 'Penalty in sheet failed');

console.log('✅ Direct database record editing & on-the-fly recalculation tested successfully!');
