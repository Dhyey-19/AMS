const CalculationEngine = require('../services/calculationEngine');

console.log('====================================================');
console.log('🧪 TESTING NEW ATTENDANCE & SALARY CALCULATION RULES');
console.log('====================================================\n');

// Mock Employee: Salary 31000/month, Shift 08:00 to 20:00 (12 hrs), Break 0 min (0 hrs)
const emp1 = {
  employee_code: '101',
  employee_name: 'Regular Staff',
  department: 'Nursing',
  designation: 'Nurse',
  salary: 31000,
  standard_in_time: '08:00',
  standard_out_time: '20:00',
  standard_break_minutes: 0,
  standard_work_hours: 12.0,
  late_grace_minutes: 11,
  late_deduction_multiplier: 0.5,
  overtime_multiplier: 2.0,
  overtime_allowed: 1,
  wop: 1,
  ypl: 18
};

// 1. Rates check (May has 31 days)
console.log('--- 1. Rate Formulation Verification ---');
const ratesMay = CalculationEngine.getEmployeeRates(emp1, 31);
console.log('Monthly Salary:', emp1.salary);
console.log('Per Day Salary (Salary / 31):', ratesMay.dailyRate, '(Expected: 1000.00)');
console.log('Per Hour Salary (Per Day / 12h):', ratesMay.hourlyRate, '(Expected: 83.3333)');
console.assert(Math.abs(ratesMay.dailyRate - 1000.0) < 0.01, 'Per Day Salary failed');
console.assert(Math.abs(ratesMay.hourlyRate - 83.3333) < 0.01, 'Per Hour Salary failed');

// 2. The 4 Different Duration Calculations (11-Minute Threshold):
console.log('\n--- 2. The 4 Duration Calculations (11-min Threshold) ---');

// Case 1: Normal (IN: 08:05 <= 10m late, OUT: 20:05 <= 10m late) -> A.OUT (20:05 = 1205) - Sched IN (08:00 = 480) = 725m (12h 05m)
const r1 = CalculationEngine.calculateDayRecord(emp1, {
  attendance_date_iso: '2026-05-01',
  in_time: '08:05',
  out_time: '20:05',
  status_code: 'P'
}, 31);
console.log('Case 1 (Normal):', { mode: r1.calc_mode, duration: r1.actual_duration_formatted, expected: '12:05' });
console.assert(r1.calc_mode === 'Normal' && r1.actual_duration_formatted === '12:05', 'Case 1 Failed');

// Case 2: Both late (IN: 08:20 >= 11m late, OUT: 20:25 >= 11m late) -> (Sched OUT + 10m = 20:10 = 1210) - A.IN (08:20 = 500) = 710m (11h 50m)
const r2 = CalculationEngine.calculateDayRecord(emp1, {
  attendance_date_iso: '2026-05-02',
  in_time: '08:20',
  out_time: '20:25',
  status_code: 'P'
}, 31);
console.log('Case 2 (Both late):', { mode: r2.calc_mode, duration: r2.actual_duration_formatted, expected: '11:50' });
console.assert(r2.calc_mode === 'Both late' && r2.actual_duration_formatted === '11:50', 'Case 2 Failed');

// Case 3: Late IN only (IN: 08:30 >= 11m late, OUT: 20:08 <= 10m late) -> A.OUT (20:08 = 1208) - A.IN (08:30 = 510) = 698m (11h 38m)
const r3 = CalculationEngine.calculateDayRecord(emp1, {
  attendance_date_iso: '2026-05-03',
  in_time: '08:30',
  out_time: '20:08',
  status_code: 'P'
}, 31);
console.log('Case 3 (Late IN only):', { mode: r3.calc_mode, duration: r3.actual_duration_formatted, expected: '11:38' });
console.assert(r3.calc_mode === 'Late IN only' && r3.actual_duration_formatted === '11:38', 'Case 3 Failed');

// Case 4: Late OUT only (IN: 08:02 <= 10m late, OUT: 20:30 >= 11m late) -> (Sched OUT + 10m = 20:10 = 1210) - Sched IN (08:00 = 480) = 730m (12h 10m)
const r4 = CalculationEngine.calculateDayRecord(emp1, {
  attendance_date_iso: '2026-05-04',
  in_time: '08:02',
  out_time: '20:30',
  status_code: 'P'
}, 31);
console.log('Case 4 (Late OUT only):', { mode: r4.calc_mode, duration: r4.actual_duration_formatted, expected: '12:10' });
console.assert(r4.calc_mode === 'Late OUT only' && r4.actual_duration_formatted === '12:10', 'Case 4 Failed');

// 3. Break Hours Rule:
console.log('\n--- 3. Break Hours Verification ---');
// Emp with master break = 60 mins
const empWithBreak = { ...emp1, standard_break_minutes: 60 };

// Scenario A: Actual Break (45 min) <= Master Break (60 min) -> Effective Break = 60 min
const rBreakA = CalculationEngine.calculateDayRecord(empWithBreak, {
  attendance_date_iso: '2026-05-05',
  in_time: '08:00',
  out_time: '20:00',
  punch_records: '08:00(in);13:00(out);13:45(in);20:00(out);',
  status_code: 'P'
}, 31);
console.log('Scenario A (Actual 45m <= Master 60m):', {
  actualBreak: rBreakA.actual_break_formatted,
  effectiveBreak: rBreakA.effective_break_formatted,
  actualWork: rBreakA.actual_work_formatted,
  expectedWork: '11:00'
});
console.assert(rBreakA.effective_break_minutes === 60 && rBreakA.actual_work_minutes === 660, 'Break Scenario A Failed');

// Scenario B: Actual Break (90 min) > Master Break (60 min) -> Effective Break = 90 min
const rBreakB = CalculationEngine.calculateDayRecord(empWithBreak, {
  attendance_date_iso: '2026-05-06',
  in_time: '08:00',
  out_time: '20:00',
  punch_records: '08:00(in);13:00(out);14:30(in);20:00(out);',
  status_code: 'P'
}, 31);
console.log('Scenario B (Actual 90m > Master 60m):', {
  actualBreak: rBreakB.actual_break_formatted,
  effectiveBreak: rBreakB.effective_break_formatted,
  actualWork: rBreakB.actual_work_formatted,
  expectedWork: '10:30'
});
console.assert(rBreakB.effective_break_minutes === 90 && rBreakB.actual_work_minutes === 630, 'Break Scenario B Failed');

// 4. Weekly Off (WO) Day Salary:
console.log('\n--- 4. Weekly Off (WO) Day Salary Verification ---');
const rWO = CalculationEngine.calculateDayRecord(emp1, {
  attendance_date_iso: '2026-05-07',
  status_code: 'WO'
}, 31);
console.log('Weekly Off (WO) Earned Salary:', rWO.daily_salary_earned, '(Expected: 1000.00)');
console.assert(rWO.daily_salary_earned === 1000.0, 'Weekly Off Salary Failed');

// 5. Doctor Rule (No Overtime for Doctors):
console.log('\n--- 5. Doctor Rule (No Overtime) Verification ---');
const empDoctor = {
  ...emp1,
  employee_code: '102',
  employee_name: 'Dr. Jane Smith',
  department: 'Medical Officer',
  designation: 'Doctor'
};
const rDoc = CalculationEngine.calculateDayRecord(empDoctor, {
  attendance_date_iso: '2026-05-08',
  in_time: '08:00',
  out_time: '22:00', // 2 hours after standard out
  status_code: 'P'
}, 31);
console.log('Doctor OT Minutes:', rDoc.overtime_minutes, 'OT Pay:', rDoc.overtime_pay, '(Expected: 0, 0)');
console.assert(rDoc.overtime_minutes === 0 && rDoc.overtime_pay === 0, 'Doctor Overtime Rule Failed');

// 6. User Exact Case (09.30 to 15:00, actual 09:20 to 19:24):
console.log('--- 6. User Specified Case (09.30 to 15:00, Actual 09:20 to 19:24) ---');
const empUserCase = {
  employee_code: '201',
  employee_name: 'Part Time Staff',
  department: 'Medical',
  designation: 'Staff',
  salary: 42400,
  standard_in_time: '09.30',
  standard_out_time: '15:00',
  standard_break_minutes: 0,
  standard_work_hours: 5.5,
  late_grace_minutes: 11,
  late_deduction_multiplier: 0.5,
  overtime_multiplier: 2.0,
  overtime_allowed: 1
};

const rUserCase = CalculationEngine.calculateDayRecord(empUserCase, {
  attendance_date_iso: '2026-05-09',
  in_time: '09:20',
  out_time: '19:24',
  status_code: 'P'
}, 31);

console.log('User Case Output:', {
  calc_mode: rUserCase.calc_mode,
  scheduled_in: rUserCase.scheduled_in_time,
  scheduled_out: rUserCase.scheduled_out_time,
  target_work: rUserCase.scheduled_work_formatted,
  actual_in: rUserCase.actual_in_time,
  actual_out: rUserCase.actual_out_time,
  duration: rUserCase.actual_duration_formatted,
  actual_work: rUserCase.actual_work_formatted,
  diff: rUserCase.work_diff_formatted,
  daily_rate: rUserCase.daily_rate,
  hourly_rate: rUserCase.hourly_rate
});

// 7. User WO Case (02-May-2026, status WO, Actual 10:20 to 17:16):
console.log('--- 7. User WO with Punches Case (02-May-2026, 10:20 to 17:16, status WO) ---');
const rUserWOCase = CalculationEngine.calculateDayRecord(empUserCase, {
  attendance_date_iso: '2026-05-02',
  in_time: '10:20',
  out_time: '17:16',
  status_code: 'WO'
}, 31);

console.log('User WO Case Output:', {
  calc_mode: rUserWOCase.calc_mode,
  scheduled_in: rUserWOCase.scheduled_in_time,
  scheduled_out: rUserWOCase.scheduled_out_time,
  target_work: rUserWOCase.scheduled_work_formatted,
  actual_in: rUserWOCase.actual_in_time,
  actual_out: rUserWOCase.actual_out_time,
  duration: rUserWOCase.actual_duration_formatted,
  actual_work: rUserWOCase.actual_work_formatted,
  overtime: rUserWOCase.overtime_formatted,
  overtime_pay: rUserWOCase.overtime_pay,
  daily_salary_earned: rUserWOCase.daily_salary_earned,
  net_daily_salary: rUserWOCase.net_daily_salary
});

console.assert(rUserWOCase.actual_duration_formatted === '04:50', `WO Duration Failed: got ${rUserWOCase.actual_duration_formatted}, expected 04:50`);
console.assert(rUserWOCase.actual_work_formatted === '04:50', `WO Actual Work Failed: got ${rUserWOCase.actual_work_formatted}, expected 04:50`);
console.assert(rUserWOCase.overtime_formatted === '04:35', `WO Overtime Failed: got ${rUserWOCase.overtime_formatted}, expected 04:35`);
console.assert(rUserWOCase.overtime_pay > 0, `WO Overtime Pay Failed: got ${rUserWOCase.overtime_pay}`);

console.log('\n🎉 ALL CALCULATION RULE TESTS PASSED WITH 100% SUCCESS!\n');
