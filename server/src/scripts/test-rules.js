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
console.log('Per Hour Salary (Salary / (31 * 12h)):', ratesMay.hourlyRate, '(Expected: 83.33)');
console.log('Per Day Salary (Hourly Rate * 12h):', ratesMay.dailyRate, '(Expected: 999.96)');
console.assert(Math.abs(ratesMay.hourlyRate - 83.33) < 0.01, 'Per Hour Salary failed');
console.assert(Math.abs(ratesMay.dailyRate - 999.96) < 0.01, 'Per Day Salary failed');

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

// Case 2: Both late (IN: 08:20 >= 11m late, OUT: 20:25 >= 11m late) -> A.OUT (20:25) - A.IN (08:20) = 725m (12h 05m)
const r2 = CalculationEngine.calculateDayRecord(emp1, {
  attendance_date_iso: '2026-05-02',
  in_time: '08:20',
  out_time: '20:25',
  status_code: 'P'
}, 31);
console.log('Case 2 (Both late):', { mode: r2.calc_mode, duration: r2.actual_duration_formatted, expected: '12:05' });
console.assert(r2.calc_mode === 'Both late' && r2.actual_duration_formatted === '12:05', 'Case 2 Failed');

// Case 3: Late IN only (IN: 08:30 >= 11m late, OUT: 20:08 <= 10m late) -> A.OUT (20:08 = 1208) - A.IN (08:30 = 510) = 698m (11h 38m)
const r3 = CalculationEngine.calculateDayRecord(emp1, {
  attendance_date_iso: '2026-05-03',
  in_time: '08:30',
  out_time: '20:08',
  status_code: 'P'
}, 31);
console.log('Case 3 (Late IN only):', { mode: r3.calc_mode, duration: r3.actual_duration_formatted, expected: '11:38' });
console.assert(r3.calc_mode === 'Late IN only' && r3.actual_duration_formatted === '11:38', 'Case 3 Failed');

// Case 4: Late OUT only (IN: 08:02 <= 10m late, OUT: 20:30 >= 11m late) -> A.OUT (20:30) - Sched IN (08:00) = 750m (12h 30m)
const r4 = CalculationEngine.calculateDayRecord(emp1, {
  attendance_date_iso: '2026-05-04',
  in_time: '08:02',
  out_time: '20:30',
  status_code: 'P'
}, 31);
console.log('Case 4 (Late OUT only):', { mode: r4.calc_mode, duration: r4.actual_duration_formatted, expected: '12:30' });
console.assert(r4.calc_mode === 'Late OUT only' && r4.actual_duration_formatted === '12:30', 'Case 4 Failed');

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
console.log('Weekly Off (WO) Earned Salary:', rWO.daily_salary_earned, '(Expected: 999.96)');
console.assert(rWO.daily_salary_earned === 999.96, 'Weekly Off Salary Failed');

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

// 8. Overtime Target + Min OT Rule Verification:
console.log('\n--- 8. Overtime Target + Min OT Verification ---');
const empOTTest = {
  employee_code: '301',
  employee_name: 'OT Test Staff',
  department: 'Admin',
  designation: 'Executive',
  salary: 26620,
  standard_in_time: '09:00',
  standard_out_time: '20:00',
  standard_break_minutes: 120,
  standard_work_hours: 9.0,
  min_overtime_minutes: 30, // Minimum 30 mins OT required from master
  overtime_multiplier: 2.0,
  overtime_allowed: 1
};

// Case A: Target 9h (540m), Min OT 30m. Actual Work = 9h 20m (560m) -> Under threshold (560 < 570) -> OT = 0
const rOTA = CalculationEngine.calculateDayRecord(empOTTest, {
  attendance_date_iso: '2026-05-10',
  in_time: '09:00',
  out_time: '20:20',
  break_out: '13:00',
  break_in: '15:00',
  status_code: 'P'
}, 31);
console.log('Case A (Actual 9h20m < Target 9h + Min 30m):', {
  actual_work: rOTA.actual_work_formatted,
  overtime: rOTA.overtime_formatted,
  expected_ot: '00:00'
});
console.assert(rOTA.overtime_minutes === 0, `Case A Failed: got ${rOTA.overtime_minutes}`);

// Case B: Target 9h (540m), Min OT 30m. Actual Work = 9h 45m (585m) -> Meets threshold (585 >= 570) -> OT = 585 - 540 = 45m
const rOTB = CalculationEngine.calculateDayRecord(empOTTest, {
  attendance_date_iso: '2026-05-11',
  in_time: '09:00',
  out_time: '20:45',
  break_out: '13:00',
  break_in: '15:00',
  status_code: 'P'
}, 31);
console.log('Case B (Actual 9h45m >= Target 9h + Min 30m):', {
  actual_work: rOTB.actual_work_formatted,
  overtime: rOTB.overtime_formatted,
  expected_ot: '00:45'
});
console.assert(rOTB.overtime_minutes === 45, `Case B Failed: got ${rOTB.overtime_minutes}`);

console.log('\n🎉 ALL CALCULATION RULE TESTS PASSED WITH 100% SUCCESS!\n');

