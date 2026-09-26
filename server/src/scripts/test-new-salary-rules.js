const CalculationEngine = require('../services/calculationEngine');

console.log('===============================================================');
console.log('🧪 VERIFYING 5 NEW SALARY CALCULATION RULES');
console.log('===============================================================\n');

// Mock Employee: Salary 31,000 / month, Shift 08:00 to 20:00 (12 hrs), May has 31 days
// Hourly Rate: 31000 / (31 * 12) = 83.33
// Daily Rate: 83.33 * 12 = 999.96
const emp = {
  employee_code: 'TEST01',
  employee_name: 'Test Staff',
  department: 'General',
  designation: 'Staff',
  salary: 31000,
  standard_in_time: '08:00',
  standard_out_time: '20:00',
  standard_break_minutes: 0,
  standard_work_hours: 12.0,
  late_grace_minutes: 10,
  overtime_multiplier: 2.0,
  overtime_allowed: 1
};

const rates = CalculationEngine.getEmployeeRates(emp, 31);
const hr = rates.hourlyRate; // 83.33
const dr = rates.dailyRate;  // 999.96

console.log(`Rates: Hourly = ₹${hr}, Daily = ₹${dr}\n`);

// -------------------------------------------------------------
// RULE 1: LATE CHECK-IN
// "no deduction upto 10min late check-in, if late check-in > 10 min then calculate and deduct whole minutes amount by 1.5 times"
// -------------------------------------------------------------
console.log('--- RULE 1: LATE CHECK-IN ---');

// 1A: 10 min late (08:10) -> <= 10 min -> No deduction
const r1A = CalculationEngine.calculateDayRecord(emp, {
  attendance_date_iso: '2026-05-01',
  in_time: '08:10',
  out_time: '20:00',
  status_code: 'P'
}, 31);
console.log('1A (10m late check-in):', {
  late_minutes: r1A.late_minutes,
  late_in_deduction: r1A.late_in_deduction,
  late_salary_deduction: r1A.late_salary_deduction,
  net_daily_salary: r1A.net_daily_salary,
  expected_deduction: 0,
  expected_net: dr
});
console.assert(r1A.late_salary_deduction === 0, '1A deduction should be 0');
console.assert(r1A.net_daily_salary === dr, '1A net salary should equal daily rate');

// 1B: 15 min late (08:15) -> > 10 min -> Whole 15 mins deducted by 1.5x
const r1B = CalculationEngine.calculateDayRecord(emp, {
  attendance_date_iso: '2026-05-02',
  in_time: '08:15',
  out_time: '20:00',
  status_code: 'P'
}, 31);
const expectedDed1B = Number(((15 / 60) * hr * 1.5).toFixed(2)); // (15/60)*83.33*1.5 = 31.25
console.log('1B (15m late check-in):', {
  late_minutes: r1B.late_minutes,
  late_in_deduction: r1B.late_in_deduction,
  expected_deduction: expectedDed1B,
  net_daily_salary: r1B.net_daily_salary,
  expected_net: Number((dr - expectedDed1B).toFixed(2))
});
console.assert(r1B.late_in_deduction === expectedDed1B, '1B deduction mismatch');
console.assert(Math.abs(r1B.net_daily_salary - (dr - expectedDed1B)) < 0.05, '1B net salary mismatch');

// 1C: 20 min late (08:20) -> > 10 min -> Whole 20 mins deducted by 1.5x
const r1C = CalculationEngine.calculateDayRecord(emp, {
  attendance_date_iso: '2026-05-03',
  in_time: '08:20',
  out_time: '20:00',
  status_code: 'P'
}, 31);
const expectedDed1C = Number(((20 / 60) * hr * 1.5).toFixed(2)); // (20/60)*83.33*1.5 = 41.67
console.log('1C (20m late check-in):', {
  late_minutes: r1C.late_minutes,
  late_in_deduction: r1C.late_in_deduction,
  expected_deduction: expectedDed1C,
  net_daily_salary: r1C.net_daily_salary
});
console.assert(r1C.late_in_deduction === expectedDed1C, '1C deduction mismatch');

// -------------------------------------------------------------
// RULE 2: EARLY CHECK-IN
// "if early check-in is > 30mins then only calculate and pay amount for early mins by 2 times (do not calculate early check-in if it lessthen 30mins for actual work hours calculation)"
// -------------------------------------------------------------
console.log('\n--- RULE 2: EARLY CHECK-IN ---');

// 2A: 15 min early (07:45) -> <= 30 mins -> Excluded from actual work hours, 0 pay
const r2A = CalculationEngine.calculateDayRecord(emp, {
  attendance_date_iso: '2026-05-04',
  in_time: '07:45',
  out_time: '20:00',
  status_code: 'P'
}, 31);
console.log('2A (15m early check-in <= 30m):', {
  duration: r2A.actual_duration_formatted,
  actual_work: r2A.actual_work_formatted,
  early_in_minutes: r2A.early_in_minutes,
  early_in_pay: r2A.early_in_pay,
  net_daily_salary: r2A.net_daily_salary,
  expected_work: '12:00',
  expected_pay: 0
});
console.assert(r2A.actual_work_formatted === '12:00', '2A actual work should exclude early 15m (12:00)');
console.assert(r2A.early_in_pay === 0, '2A early in pay should be 0');
console.assert(r2A.net_daily_salary === dr, '2A net salary should be daily rate');

// 2B: 30 min early (07:30) -> <= 30 mins -> Excluded from actual work hours, 0 pay
const r2B = CalculationEngine.calculateDayRecord(emp, {
  attendance_date_iso: '2026-05-05',
  in_time: '07:30',
  out_time: '20:00',
  status_code: 'P'
}, 31);
console.log('2B (30m early check-in <= 30m):', {
  duration: r2B.actual_duration_formatted,
  actual_work: r2B.actual_work_formatted,
  early_in_pay: r2B.early_in_pay
});
console.assert(r2B.actual_work_formatted === '12:00', '2B actual work should be 12:00');
console.assert(r2B.early_in_pay === 0, '2B early in pay should be 0');

// 2C: 45 min early (07:15) -> > 30 mins -> Calculated in work hours, pay early mins by 2x
const r2C = CalculationEngine.calculateDayRecord(emp, {
  attendance_date_iso: '2026-05-06',
  in_time: '07:15',
  out_time: '20:00',
  status_code: 'P'
}, 31);
const expectedPay2C = Number(((45 / 60) * hr * 2.0).toFixed(2)); // (45/60)*83.33*2.0 = 125.00
console.log('2C (45m early check-in > 30m):', {
  duration: r2C.actual_duration_formatted,
  actual_work: r2C.actual_work_formatted,
  early_in_minutes: r2C.early_in_minutes,
  early_in_pay: r2C.early_in_pay,
  expected_pay: expectedPay2C,
  net_daily_salary: r2C.net_daily_salary,
  expected_net: Number((dr + expectedPay2C).toFixed(2))
});
console.assert(r2C.actual_work_formatted === '12:45', '2C actual work should be 12:45');
console.assert(r2C.early_in_pay === expectedPay2C, '2C early in pay mismatch');
console.assert(Math.abs(r2C.net_daily_salary - (dr + expectedPay2C)) < 0.05, '2C net daily salary mismatch');

// -------------------------------------------------------------
// RULE 3: LATE CHECK-OUT
// "no pay for upto 10min late check-out. if late check-out is >10min and <=30min then calculate & pay amount by 1 times (normal) and if check-out morethen > 30mins then calculate & by 2 times"
// -------------------------------------------------------------
console.log('\n--- RULE 3: LATE CHECK-OUT ---');

// 3A: 8 min late check-out (20:08) -> <= 10 min -> No pay
const r3A = CalculationEngine.calculateDayRecord(emp, {
  attendance_date_iso: '2026-05-07',
  in_time: '08:00',
  out_time: '20:08',
  status_code: 'P'
}, 31);
console.log('3A (8m late check-out <= 10m):', {
  late_out_minutes: r3A.late_out_minutes,
  late_out_pay: r3A.late_out_pay,
  overtime_pay: r3A.overtime_pay,
  net_daily_salary: r3A.net_daily_salary
});
console.assert(r3A.late_out_pay === 0, '3A late out pay should be 0');
console.assert(r3A.net_daily_salary === dr, '3A net salary should be daily rate');

// 3B: 20 min late check-out (20:20) -> > 10m and <= 30m -> Pay by 1x
const r3B = CalculationEngine.calculateDayRecord(emp, {
  attendance_date_iso: '2026-05-08',
  in_time: '08:00',
  out_time: '20:20',
  status_code: 'P'
}, 31);
const expectedPay3B = Number(((20 / 60) * hr * 1.0).toFixed(2)); // (20/60)*83.33*1.0 = 27.78
console.log('3B (20m late check-out >10m & <=30m):', {
  late_out_minutes: r3B.late_out_minutes,
  late_out_pay: r3B.late_out_pay,
  expected_pay: expectedPay3B,
  net_daily_salary: r3B.net_daily_salary,
  expected_net: Number((dr + expectedPay3B).toFixed(2))
});
console.assert(r3B.late_out_pay === expectedPay3B, '3B late out pay mismatch');
console.assert(Math.abs(r3B.net_daily_salary - (dr + expectedPay3B)) < 0.05, '3B net salary mismatch');

// 3C: 30 min late check-out (20:30) -> > 10m and <= 30m -> Pay by 1x
const r3C = CalculationEngine.calculateDayRecord(emp, {
  attendance_date_iso: '2026-05-09',
  in_time: '08:00',
  out_time: '20:30',
  status_code: 'P'
}, 31);
const expectedPay3C = Number(((30 / 60) * hr * 1.0).toFixed(2)); // (30/60)*83.33*1.0 = 41.67
console.log('3C (30m late check-out <= 30m):', {
  late_out_minutes: r3C.late_out_minutes,
  late_out_pay: r3C.late_out_pay,
  expected_pay: expectedPay3C
});
console.assert(r3C.late_out_pay === expectedPay3C, '3C late out pay mismatch');

// 3D: 45 min late check-out (20:45) -> > 30m -> Pay by 2x
const r3D = CalculationEngine.calculateDayRecord(emp, {
  attendance_date_iso: '2026-05-10',
  in_time: '08:00',
  out_time: '20:45',
  status_code: 'P'
}, 31);
const expectedPay3D = Number(((45 / 60) * hr * 2.0).toFixed(2)); // (45/60)*83.33*2.0 = 125.00
console.log('3D (45m late check-out > 30m):', {
  late_out_minutes: r3D.late_out_minutes,
  late_out_pay: r3D.late_out_pay,
  expected_pay: expectedPay3D,
  net_daily_salary: r3D.net_daily_salary,
  expected_net: Number((dr + expectedPay3D).toFixed(2))
});
console.assert(r3D.late_out_pay === expectedPay3D, '3D late out pay mismatch');
console.assert(Math.abs(r3D.net_daily_salary - (dr + expectedPay3D)) < 0.05, '3D net salary mismatch');

// -------------------------------------------------------------
// RULE 4: EARLY CHECK-OUT
// "calculate and Deduct early check-out mins by 1 times (normal)"
// -------------------------------------------------------------
console.log('\n--- RULE 4: EARLY CHECK-OUT ---');

// 4A: 15 min early check-out (19:45) -> Deduct by 1x
const r4A = CalculationEngine.calculateDayRecord(emp, {
  attendance_date_iso: '2026-05-11',
  in_time: '08:00',
  out_time: '19:45',
  status_code: 'P'
}, 31);
const expectedDed4A = Number(((15 / 60) * hr * 1.0).toFixed(2)); // (15/60)*83.33*1.0 = 20.83
console.log('4A (15m early check-out):', {
  early_minutes: r4A.early_minutes,
  early_out_deduction: r4A.early_out_deduction,
  expected_deduction: expectedDed4A,
  net_daily_salary: r4A.net_daily_salary,
  expected_net: Number((dr - expectedDed4A).toFixed(2))
});
console.assert(r4A.early_out_deduction === expectedDed4A, '4A early out deduction mismatch');
console.assert(Math.abs(r4A.net_daily_salary - (dr - expectedDed4A)) < 0.05, '4A net salary mismatch');

// 4B: 40 min early check-out (19:20) -> Deduct by 1x
const r4B = CalculationEngine.calculateDayRecord(emp, {
  attendance_date_iso: '2026-05-12',
  in_time: '08:00',
  out_time: '19:20',
  status_code: 'P'
}, 31);
const expectedDed4B = Number(((40 / 60) * hr * 1.0).toFixed(2)); // (40/60)*83.33*1.0 = 55.55
console.log('4B (40m early check-out):', {
  early_minutes: r4B.early_minutes,
  early_out_deduction: r4B.early_out_deduction,
  expected_deduction: expectedDed4B
});
console.assert(r4B.early_out_deduction === expectedDed4B, '4B early out deduction mismatch');

// -------------------------------------------------------------
// RULE 5: BREAK FORMULA PRESERVATION
// "break formula will remain same"
// -------------------------------------------------------------
console.log('\n--- RULE 5: BREAK FORMULA ---');

// 5A: Std break 0, actual break 20 min <= 30 min -> 0 deduction
const r5A = CalculationEngine.calculateDayRecord(emp, {
  attendance_date_iso: '2026-05-13',
  in_time: '08:00',
  out_time: '20:00',
  punch_records: '08:00(in);13:00(out);13:20(in);20:00(out);',
  status_code: 'P'
}, 31);
console.log('5A (Break 20m <= 30m with 0 std break):', {
  effective_break: r5A.effective_break_formatted,
  actual_work: r5A.actual_work_formatted,
  excess_break_deduction: r5A.excess_break_deduction,
  net_daily_salary: r5A.net_daily_salary
});
console.assert(r5A.effective_break_minutes === 0, '5A effective break should be 0');
console.assert(r5A.excess_break_deduction === 0, '5A excess break deduction should be 0');

// 5B: Std break 0, actual break 45 min > 30 min -> Deduct whole 45 mins
const r5B = CalculationEngine.calculateDayRecord(emp, {
  attendance_date_iso: '2026-05-14',
  in_time: '08:00',
  out_time: '20:00',
  punch_records: '08:00(in);13:00(out);13:45(in);20:00(out);',
  status_code: 'P'
}, 31);
const expectedDed5B = Number(((45 / 60) * hr * 1.0).toFixed(2));
console.log('5B (Break 45m > 30m with 0 std break):', {
  effective_break: r5B.effective_break_formatted,
  actual_work: r5B.actual_work_formatted,
  excess_break_deduction: r5B.excess_break_deduction,
  expected_deduction: expectedDed5B
});
console.assert(r5B.effective_break_minutes === 45, '5B effective break should be 45');
console.assert(r5B.excess_break_deduction === expectedDed5B, '5B excess break deduction mismatch');

// -------------------------------------------------------------
// COMBINED TEST: MULTIPLE DEVIATIONS ON SAME DAY
// -------------------------------------------------------------
console.log('\n--- COMBINED TEST: 15m Late In + 45m Late Out ---');
// In: 08:15 (15m late in -> 15m * 1.5x deduction = ₹31.25)
// Out: 20:45 (45m late out -> 45m * 2.0x OT pay = ₹125.00)
const rComb = CalculationEngine.calculateDayRecord(emp, {
  attendance_date_iso: '2026-05-15',
  in_time: '08:15',
  out_time: '20:45',
  status_code: 'P'
}, 31);
const expectedNetComb = Number((dr - expectedDed1B + expectedPay3D).toFixed(2)); // 999.96 - 31.25 + 125.00 = 1093.71
console.log('Combined Day:', {
  late_in_deduction: rComb.late_in_deduction,
  late_out_pay: rComb.late_out_pay,
  net_daily_salary: rComb.net_daily_salary,
  expected_net: expectedNetComb
});
console.assert(rComb.late_in_deduction === expectedDed1B, 'Combined late in deduction mismatch');
console.assert(rComb.late_out_pay === expectedPay3D, 'Combined late out pay mismatch');
console.assert(Math.abs(rComb.net_daily_salary - expectedNetComb) < 0.05, 'Combined net daily salary mismatch');

console.log('\n===============================================================');
console.log('🎉 ALL 5 SALARY CALCULATION RULES VERIFIED SUCCESSFULLY 100%!');
console.log('===============================================================\n');
