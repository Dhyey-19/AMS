const CalculationEngine = require('../services/calculationEngine');

console.log('====================================================');
console.log(' TESTING NIGHT DUTY / OVERNIGHT SHIFT CALCULATIONS  ');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(description, condition, actual, expected) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${description}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${description}`);
    console.error(`       Actual:   ${JSON.stringify(actual)}`);
    console.error(`       Expected: ${JSON.stringify(expected)}`);
  }
}

// Common employee mock with Night Shift standard schedule (20:00 to 08:00, 12 hours)
const nightEmployee = {
  employee_code: 'TEST_NIGHT_01',
  employee_name: 'Night Worker',
  salary: 30000,
  daily_rate: 1000,
  hourly_rate: 83.33,
  standard_in_time: '20:00',
  standard_out_time: '08:00',
  standard_break_minutes: 0,
  late_grace_minutes: 11,
  late_deduction_multiplier: 1.5,
  overtime_multiplier: 1.5,
  overtime_allowed: 1,
  is_night_shift: 1
};

// -------------------------------------------------------------------------
// TEST 1: Standard Night Shift (20:00 to 08:00) with Perfect On-Time Punches
// -------------------------------------------------------------------------
console.log('--- Test 1: On-Time Night Shift Punches (20:00 -> 08:00) ---');
const r1 = CalculationEngine.calculateDayRecord(nightEmployee, {
  attendance_date_iso: '2026-05-01',
  status_code: 'P',
  in_time: '20:00',
  out_time: '08:00',
  punch_records: '20:00,08:00'
}, 30);

assert('Scheduled Duration should be 12:00', r1.scheduled_duration_formatted === '12:00', r1.scheduled_duration_formatted, '12:00');
assert('Actual Duration should be 12:00', r1.actual_duration_formatted === '12:00', r1.actual_duration_formatted, '12:00');
assert('Actual Work should be 12:00', r1.actual_work_formatted === '12:00', r1.actual_work_formatted, '12:00');
assert('Work Diff should be 00:00', r1.work_diff_formatted === '00:00' || r1.work_diff_formatted === '+00:00', r1.work_diff_formatted, '00:00');
assert('Late should be 00:00', r1.late_formatted === '00:00', r1.late_formatted, '00:00');
assert('Late deduction should be 0', r1.late_salary_deduction === 0, r1.late_salary_deduction, 0);
assert('Overtime should be 00:00', r1.overtime_formatted === '00:00', r1.overtime_formatted, '00:00');
assert('Calc mode should be Normal', r1.calc_mode === 'Normal', r1.calc_mode, 'Normal');
assert('is_night_shift should be 1', r1.is_night_shift === 1, r1.is_night_shift, 1);

// -------------------------------------------------------------------------
// TEST 2: Night Shift with 15m Late Check-In (20:15) and On-Time Check-Out (08:00)
// -------------------------------------------------------------------------
console.log('\n--- Test 2: Night Shift Late In (20:15 -> 08:00) ---');
const r2 = CalculationEngine.calculateDayRecord(nightEmployee, {
  attendance_date_iso: '2026-05-01',
  status_code: 'P',
  in_time: '20:15',
  out_time: '08:00',
  punch_records: '20:15,08:00'
}, 30);

assert('Late time should be 00:15', r2.late_formatted === '00:15', r2.late_formatted, '00:15');
assert('Calc mode should be Late IN only', r2.calc_mode === 'Late IN only', r2.calc_mode, 'Late IN only');
assert('Actual Duration should be 11:45', r2.actual_duration_formatted === '11:45', r2.actual_duration_formatted, '11:45');
assert('Late deduction should be greater than 0', r2.late_salary_deduction > 0, r2.late_salary_deduction, '> 0');

// -------------------------------------------------------------------------
// TEST 3: Night Shift with 45m Late Check-Out (20:00 -> 08:45, Overtime)
// -------------------------------------------------------------------------
console.log('\n--- Test 3: Night Shift Late Out (20:00 -> 08:45) ---');
const r3 = CalculationEngine.calculateDayRecord(nightEmployee, {
  attendance_date_iso: '2026-05-01',
  status_code: 'P',
  in_time: '20:00',
  out_time: '08:45',
  punch_records: '20:00,08:45'
}, 30);

assert('Overtime should be 00:45', r3.overtime_formatted === '00:45', r3.overtime_formatted, '00:45');
assert('Calc mode should be Late OUT only', r3.calc_mode === 'Late OUT only', r3.calc_mode, 'Late OUT only');
assert('Actual Duration should be 12:45', r3.actual_duration_formatted === '12:45', r3.actual_duration_formatted, '12:45');
assert('Overtime pay should be greater than 0', r3.overtime_pay > 0, r3.overtime_pay, '> 0');

// -------------------------------------------------------------------------
// TEST 4: Night Shift Both Late (20:20 -> 08:40)
// -------------------------------------------------------------------------
console.log('\n--- Test 4: Night Shift Both Late (20:20 -> 08:40) ---');
const r4 = CalculationEngine.calculateDayRecord(nightEmployee, {
  attendance_date_iso: '2026-05-01',
  status_code: 'P',
  in_time: '20:20',
  out_time: '08:40',
  punch_records: '20:20,08:40'
}, 30);

assert('Late time should be 00:20', r4.late_formatted === '00:20', r4.late_formatted, '00:20');
assert('Overtime should be 00:40', r4.overtime_formatted === '00:40', r4.overtime_formatted, '00:40');
assert('Calc mode should be Both late', r4.calc_mode === 'Both late', r4.calc_mode, 'Both late');
assert('Actual Duration should be 12:20', r4.actual_duration_formatted === '12:20', r4.actual_duration_formatted, '12:20');

// -------------------------------------------------------------------------
// TEST 5: Past-Midnight Arrival (Checked in at 00:15 next morning)
// -------------------------------------------------------------------------
console.log('\n--- Test 5: Arrival After Midnight (00:15 -> 08:00) ---');
const r5 = CalculationEngine.calculateDayRecord(nightEmployee, {
  attendance_date_iso: '2026-05-01',
  status_code: 'P',
  in_time: '00:15',
  out_time: '08:00',
  punch_records: '00:15,08:00'
}, 30);

// 20:00 to 00:15 is 4 hours 15 mins (255 mins late)
assert('Late time should be 04:15 (255 mins)', r5.late_formatted === '04:15', r5.late_formatted, '04:15');
assert('Actual Duration should be 07:45', r5.actual_duration_formatted === '07:45', r5.actual_duration_formatted, '07:45');
assert('Calc mode should be Late IN only', r5.calc_mode === 'Late IN only', r5.calc_mode, 'Late IN only');

// -------------------------------------------------------------------------
// TEST 6: Departure Before Midnight (Early check-out at 23:30)
// -------------------------------------------------------------------------
console.log('\n--- Test 6: Departure Before Midnight (20:00 -> 23:30) ---');
const r6 = CalculationEngine.calculateDayRecord(nightEmployee, {
  attendance_date_iso: '2026-05-01',
  status_code: 'P',
  in_time: '20:00',
  out_time: '23:30',
  punch_records: '20:00,23:30'
}, 30);

// 20:00 to 23:30 is 3h30m worked, scheduled until 08:00 (left 8h30m = 510m early)
assert('Actual Duration should be 03:30', r6.actual_duration_formatted === '03:30', r6.actual_duration_formatted, '03:30');
assert('Early departure should cause deduction (Work diff negative)', r6.work_diff_formatted.startsWith('-'), r6.work_diff_formatted, 'negative');

// -------------------------------------------------------------------------
// TEST 7: Cross-Midnight Break (Break Out 23:45, Break In 00:30 next day)
// -------------------------------------------------------------------------
console.log('\n--- Test 7: Cross-Midnight Break Punches (23:45 -> 00:30 = 45m break) ---');
const r7 = CalculationEngine.calculateDayRecord(nightEmployee, {
  attendance_date_iso: '2026-05-01',
  status_code: 'P',
  in_time: '20:00',
  out_time: '08:00',
  punch_records: '20:00,23:45,00:30,08:00'
}, 30);

assert('Effective break should be 00:45', r7.effective_break_formatted === '00:45', r7.effective_break_formatted, '00:45');
assert('Actual Work should be 11:15 (12h - 45m)', r7.actual_work_formatted === '11:15', r7.actual_work_formatted, '11:15');

// -------------------------------------------------------------------------
// TEST 8: Ad-hoc Night Duty for Normally Day Worker (Standard 08:00 to 20:00)
// -------------------------------------------------------------------------
console.log('\n--- Test 8: Day Employee assigned Night Duty (20:00 -> 08:00 next day) ---');
const dayEmployee = {
  employee_code: 'TEST_DAY_01',
  employee_name: 'Day Worker on Night Duty',
  salary: 30000,
  daily_rate: 1000,
  hourly_rate: 83.33,
  standard_in_time: '08:00',
  standard_out_time: '20:00',
  standard_break_minutes: 0,
  is_night_shift: 0
};

const r8 = CalculationEngine.calculateDayRecord(dayEmployee, {
  attendance_date_iso: '2026-05-01',
  status_code: 'P',
  in_time: '20:00',
  out_time: '08:00',
  punch_records: '20:00,08:00'
}, 30);

assert('Should auto-detect night shift is_night_shift = 1', r8.is_night_shift === 1, r8.is_night_shift, 1);
assert('Actual Duration should be 12:00 (not negative or 0)', r8.actual_duration_formatted === '12:00', r8.actual_duration_formatted, '12:00');
assert('Actual Work should be 12:00', r8.actual_work_formatted === '12:00', r8.actual_work_formatted, '12:00');

// -------------------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------------------
console.log('\n====================================================');
console.log(` RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('====================================================');

if (passedTests === totalTests) {
  console.log('ALL NIGHT DUTY TESTS COMPLETED SUCCESSFULLY!\n');
  process.exit(0);
} else {
  console.error('SOME NIGHT DUTY TESTS FAILED!\n');
  process.exit(1);
}
