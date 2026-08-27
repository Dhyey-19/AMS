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

// 2. Duration Calculations (Gross Duration = Actual OUT - Actual IN):
console.log('\n--- 2. Duration Calculations (Actual OUT - Actual IN) ---');

// Case 1: Normal (IN: 08:05, OUT: 20:05) -> Duration = 20:05 - 08:05 = 12h 00m (720m)
const r1 = CalculationEngine.calculateDayRecord(emp1, {
  attendance_date_iso: '2026-05-01',
  in_time: '08:05',
  out_time: '20:05',
  status_code: 'P'
}, 31);
console.log('Case 1 (Normal):', { mode: r1.calc_mode, duration: r1.actual_duration_formatted, expected: '12:00' });
console.assert(r1.calc_mode === 'Normal' && r1.actual_duration_formatted === '12:00', 'Case 1 Failed');

// Case 2: Both late (IN: 08:20 >= 11m late, OUT: 20:25 >= 11m late) -> Duration = 20:25 - 08:20 = 12h 05m (725m)
const r2 = CalculationEngine.calculateDayRecord(emp1, {
  attendance_date_iso: '2026-05-02',
  in_time: '08:20',
  out_time: '20:25',
  status_code: 'P'
}, 31);
console.log('Case 2 (Both late):', { mode: r2.calc_mode, duration: r2.actual_duration_formatted, expected: '12:05' });
console.assert(r2.calc_mode === 'Both late' && r2.actual_duration_formatted === '12:05', 'Case 2 Failed');

// Case 3: Late IN only (IN: 08:30 >= 11m late, OUT: 20:08 <= 10m late) -> Duration = 20:08 - 08:30 = 11h 38m (698m)
const r3 = CalculationEngine.calculateDayRecord(emp1, {
  attendance_date_iso: '2026-05-03',
  in_time: '08:30',
  out_time: '20:08',
  status_code: 'P'
}, 31);
console.log('Case 3 (Late IN only):', { mode: r3.calc_mode, duration: r3.actual_duration_formatted, expected: '11:38' });
console.assert(r3.calc_mode === 'Late IN only' && r3.actual_duration_formatted === '11:38', 'Case 3 Failed');

// Case 4: Late OUT only (IN: 08:02 <= 10m late, OUT: 20:30 >= 11m late) -> Duration = 20:30 - 08:02 = 12h 28m (748m)
const r4 = CalculationEngine.calculateDayRecord(emp1, {
  attendance_date_iso: '2026-05-04',
  in_time: '08:02',
  out_time: '20:30',
  status_code: 'P'
}, 31);
console.log('Case 4 (Late OUT only):', { mode: r4.calc_mode, duration: r4.actual_duration_formatted, expected: '12:28' });
console.assert(r4.calc_mode === 'Late OUT only' && r4.actual_duration_formatted === '12:28', 'Case 4 Failed');

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

// Scenario C: Standard Break 00:00, Actual Break 20 min (< 30 min) -> Effective Break = 0 min, Work = 12:00
const empWithZeroBreak = { ...emp1, standard_break_minutes: 0 };
const rBreakC = CalculationEngine.calculateDayRecord(empWithZeroBreak, {
  attendance_date_iso: '2026-05-05',
  in_time: '08:00',
  out_time: '20:00',
  punch_records: '08:00(in);13:00(out);13:20(in);20:00(out);',
  status_code: 'P'
}, 31);
console.log('Scenario C (Std 00:00, Actual 20m <= 30m):', {
  actualBreak: rBreakC.actual_break_formatted,
  effectiveBreak: rBreakC.effective_break_formatted,
  actualWork: rBreakC.actual_work_formatted,
  expectedWork: '12:00'
});
console.assert(rBreakC.effective_break_minutes === 0 && rBreakC.actual_work_minutes === 720, 'Break Scenario C Failed');

// Scenario D: Standard Break 00:00, Actual Break 30 min (<= 30 min) -> Effective Break = 0 min, Work = 12:00
const rBreakD = CalculationEngine.calculateDayRecord(empWithZeroBreak, {
  attendance_date_iso: '2026-05-05',
  in_time: '08:00',
  out_time: '20:00',
  punch_records: '08:00(in);13:00(out);13:30(in);20:00(out);',
  status_code: 'P'
}, 31);
console.log('Scenario D (Std 00:00, Actual 30m <= 30m):', {
  actualBreak: rBreakD.actual_break_formatted,
  effectiveBreak: rBreakD.effective_break_formatted,
  actualWork: rBreakD.actual_work_formatted,
  expectedWork: '12:00'
});
console.assert(rBreakD.effective_break_minutes === 0 && rBreakD.actual_work_minutes === 720, 'Break Scenario D Failed');

// Scenario E: Standard Break 00:00, Actual Break 45 min (> 30 min) -> Effective Break = 15 min (45-30), Work = 11:45
const rBreakE = CalculationEngine.calculateDayRecord(empWithZeroBreak, {
  attendance_date_iso: '2026-05-05',
  in_time: '08:00',
  out_time: '20:00',
  punch_records: '08:00(in);13:00(out);13:45(in);20:00(out);',
  status_code: 'P'
}, 31);
console.log('Scenario E (Std 00:00, Actual 45m > 30m):', {
  actualBreak: rBreakE.actual_break_formatted,
  effectiveBreak: rBreakE.effective_break_formatted,
  actualWork: rBreakE.actual_work_formatted,
  expectedWork: '11:45'
});
console.assert(rBreakE.effective_break_minutes === 15 && rBreakE.actual_work_minutes === 705, 'Break Scenario E Failed');

// Scenario F: Standard Break 00:00, Actual Break 60 min (> 30 min) -> Effective Break = 30 min (60-30), Work = 11:30
const rBreakF = CalculationEngine.calculateDayRecord(empWithZeroBreak, {
  attendance_date_iso: '2026-05-05',
  in_time: '08:00',
  out_time: '20:00',
  punch_records: '08:00(in);13:00(out);14:00(in);20:00(out);',
  status_code: 'P'
}, 31);
console.log('Scenario F (Std 00:00, Actual 60m > 30m):', {
  actualBreak: rBreakF.actual_break_formatted,
  effectiveBreak: rBreakF.effective_break_formatted,
  actualWork: rBreakF.actual_work_formatted,
  expectedWork: '11:30'
});
console.assert(rBreakF.effective_break_minutes === 30 && rBreakF.actual_work_minutes === 690, 'Break Scenario F Failed');

// Scenario G: 5 Punches in a Day (Last punch tagged (in) treated as Actual OUT)
const rBreakG = CalculationEngine.calculateDayRecord(empWithZeroBreak, {
  attendance_date_iso: '2026-05-05',
  punch_records: '08:10:00(in);13:00:00(out);13:30:00(in);17:00:00(out);21:05:00(in);',
  status_code: 'P'
}, 31);
console.log('Scenario G (5 Punches, Last is (in)):', {
  actualIn: rBreakG.actual_in_time,
  actualOut: rBreakG.actual_out_time,
  duration: rBreakG.actual_duration_formatted,
  actualWork: rBreakG.actual_work_formatted,
  expectedIn: '08:10',
  expectedOut: '21:05',
  expectedDuration: '12:55'
});
console.assert(rBreakG.actual_in_time === '08:10' && rBreakG.actual_out_time === '21:05' && rBreakG.actual_duration_formatted === '12:55' && rBreakG.actual_work_formatted === '12:55', '5-Punch Last OUT Failed');

// Scenario H: 7 Punches in a Day (Odd punch count)
const rBreakH = CalculationEngine.calculateDayRecord(empWithZeroBreak, {
  attendance_date_iso: '2026-05-05',
  punch_records: '10:06:11(in);18:31:51(out);18:31:55(in);18:32:00(out);20:23:29(in);20:26:06(out);20:30:22(in);',
  status_code: 'P'
}, 31);
console.log('Scenario H (7 Punches, Last is 20:30 (in)):', {
  actualIn: rBreakH.actual_in_time,
  actualOut: rBreakH.actual_out_time,
  expectedIn: '10:06',
  expectedOut: '20:30'
});
console.assert(rBreakH.actual_in_time === '10:06' && rBreakH.actual_out_time === '20:30', '7-Punch Last OUT Failed');

// 4. Weekly Off (WO) Day Salary:
console.log('\n--- 4. Weekly Off (WO) Day Salary Verification ---');
const rWO = CalculationEngine.calculateDayRecord(emp1, {
  attendance_date_iso: '2026-05-07',
  status_code: 'WO'
}, 31);
console.log('Weekly Off (WO) Earned Salary:', rWO.daily_salary_earned, '(Expected: 999.96)');
console.assert(rWO.daily_salary_earned === 999.96, 'Weekly Off Salary Failed');

// 5. Overtime Eligibility (Controlled by Master overtime_allowed):
console.log('\n--- 5. Overtime Eligibility Verification ---');
const empDoctorOT = {
  ...emp1,
  employee_code: '102',
  employee_name: 'Dr. Jane Smith',
  department: 'Medical Officer',
  designation: 'Doctor',
  overtime_allowed: 1
};
const rDoc = CalculationEngine.calculateDayRecord(empDoctorOT, {
  attendance_date_iso: '2026-05-08',
  in_time: '08:00',
  out_time: '22:00', // 2 hours after standard out (14 hours total, 12h target -> 2h OT)
  status_code: 'P'
}, 31);
console.log('Doctor OT with OT Allowed:', rDoc.overtime_minutes, 'OT Pay:', rDoc.overtime_pay, '(Expected: 120m, 333.32)');
console.assert(rDoc.overtime_minutes === 120, 'Doctor Overtime Rule Failed');

const empNoOT = {
  ...emp1,
  overtime_allowed: 0
};
const rNoOT = CalculationEngine.calculateDayRecord(empNoOT, {
  attendance_date_iso: '2026-05-08',
  in_time: '08:00',
  out_time: '22:00',
  status_code: 'P'
}, 31);
console.log('Employee with Overtime Disabled:', rNoOT.overtime_minutes, 'OT Pay:', rNoOT.overtime_pay, '(Expected: 0, 0)');
console.assert(rNoOT.overtime_minutes === 0 && rNoOT.overtime_pay === 0, 'No Overtime Rule Failed');

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

// 9. WOP (Weekly Off Present) Work Hours Master Configuration Verification:
console.log('\n--- 9. WOP Work Hours Master Configuration Verification ---');
const empWOPCustom = {
  employee_code: '401',
  employee_name: 'WOP Test Employee',
  department: 'Medical',
  designation: 'Nurse',
  salary: 31000,
  standard_in_time: '08:00',
  standard_out_time: '20:00',
  standard_break_minutes: 0,
  standard_work_hours: 12.0, // Regular day target = 12h
  wop_work_hours: 6.0,       // WOP day target = 6h
  overtime_allowed: 1,
  min_overtime_minutes: 0,
  overtime_multiplier: 2.0
};

// Test 9A: Regular Present Day (P) uses standard_work_hours (12:00)
const rRegDay = CalculationEngine.calculateDayRecord(empWOPCustom, {
  attendance_date_iso: '2026-05-15',
  in_time: '08:00',
  out_time: '20:00',
  status_code: 'P'
}, 31);
console.log('Test 9A (Regular P Day Target):', {
  target: rRegDay.scheduled_work_formatted,
  expectedTarget: '12:00',
  actualWork: rRegDay.actual_work_formatted,
  diff: rRegDay.work_diff_formatted
});
console.assert(rRegDay.scheduled_work_formatted === '12:00', 'Regular day target should be 12:00');

// Test 9B: WOP Day (WOP) uses wop_work_hours (06:00)
const rWOPDay = CalculationEngine.calculateDayRecord(empWOPCustom, {
  attendance_date_iso: '2026-05-17',
  in_time: '08:00',
  out_time: '16:00', // Worked 8 hours (08:00 to 16:00)
  status_code: 'WOP'
}, 31);
console.log('Test 9B (WOP Day Target 6h, Worked 8h):', {
  target: rWOPDay.scheduled_work_formatted,
  expectedTarget: '06:00',
  actualWork: rWOPDay.actual_work_formatted,
  diff: rWOPDay.work_diff_formatted,
  expectedDiff: '+02:00',
  overtime: rWOPDay.overtime_formatted,
  expectedOvertime: '02:00'
});
console.assert(rWOPDay.scheduled_work_formatted === '06:00', 'WOP day target should be 06:00');
console.assert(rWOPDay.work_diff_formatted === '+02:00', 'WOP day diff should be +02:00');
console.assert(rWOPDay.overtime_formatted === '02:00', 'WOP day OT should be 02:00');

// 10. Compulsory WOP (WOP = 1 and WOP = 2) Monthly Rule Verification:
console.log('\n--- 10. Compulsory WOP Monthly Rule Verification ---');

// Helper to build 31-day month records (4 WO days on 07, 14, 21, 28, and 27 P days)
const makeMonthRecords = (wopDates = []) => {
  const records = [];
  for (let d = 1; d <= 31; d++) {
    const dayStr = d.toString().padStart(2, '0');
    const dateIso = `2026-05-${dayStr}`;
    const isWODate = [7, 14, 21, 28].includes(d);
    
    if (wopDates.includes(d)) {
      records.push({
        attendance_date_iso: dateIso,
        status_code: 'WOP',
        in_time: '08:00',
        out_time: '16:00'
      });
    } else if (isWODate) {
      records.push({
        attendance_date_iso: dateIso,
        status_code: 'WO'
      });
    } else {
      records.push({
        attendance_date_iso: dateIso,
        status_code: 'P',
        in_time: '08:00',
        out_time: '20:00'
      });
    }
  }
  return records;
};

// Test 10A: emp.wop = 1, but worked 0 WOP days -> Shortfall = 1 -> 1 WO day treated as Absent, 1 day salary deducted
const empWop1 = { ...emp1, salary: 31000, standard_work_hours: 12.0, wop: 1 };
const sheet10A = CalculationEngine.calculateEmployeeMonthSheet(empWop1, makeMonthRecords([]), '2026-05');
console.log('Test 10A (WOP=1, Worked 0 WOP):', {
  wopRequired: sheet10A.summary.wopRequired,
  wopFulfilled: sheet10A.summary.wopFulfilled,
  wopShortfall: sheet10A.summary.wopShortfall,
  wopPenaltyDays: sheet10A.summary.wopPenaltyDays,
  weeklyOffDays: sheet10A.summary.weeklyOffDays,
  absentDays: sheet10A.summary.absentDays,
  netPayableSalary: sheet10A.summary.netPayableSalary,
  expectedPayable: 29998.80 // 30 days paid out of 31 (1 WO day deducted)
});
console.assert(sheet10A.summary.wopShortfall === 1, 'WOP=1 with 0 worked should have shortfall 1');
console.assert(sheet10A.summary.wopPenaltyDays === 1, 'WOP=1 with 0 worked should penalize 1 WO day');
console.assert(sheet10A.summary.absentDays === 1, 'WOP=1 with 0 worked should have 1 absent day');
console.assert(Math.abs(sheet10A.summary.netPayableSalary - 29998.80) < 0.05, '1 day salary should be deducted');

// Test 10B: emp.wop = 1, and worked 1 WOP day -> Shortfall = 0 -> No WO deducted
const sheet10B = CalculationEngine.calculateEmployeeMonthSheet(empWop1, makeMonthRecords([7]), '2026-05');
console.log('Test 10B (WOP=1, Worked 1 WOP):', {
  wopRequired: sheet10B.summary.wopRequired,
  wopFulfilled: sheet10B.summary.wopFulfilled,
  wopShortfall: sheet10B.summary.wopShortfall,
  wopPenaltyDays: sheet10B.summary.wopPenaltyDays,
  weeklyOffDays: sheet10B.summary.weeklyOffDays,
  absentDays: sheet10B.summary.absentDays
});
console.assert(sheet10B.summary.wopShortfall === 0, 'WOP=1 with 1 worked should have shortfall 0');
console.assert(sheet10B.summary.wopPenaltyDays === 0, 'WOP=1 with 1 worked should penalize 0 WO days');
console.assert(sheet10B.summary.absentDays === 0, 'WOP=1 with 1 worked should have 0 absent days');

// Test 10C: emp.wop = 2, and worked 0 WOP days -> Shortfall = 2 -> 2 WO days treated as Absent, 2 days salary deducted
const empWop2 = { ...emp1, salary: 31000, standard_work_hours: 12.0, wop: 2 };
const sheet10C = CalculationEngine.calculateEmployeeMonthSheet(empWop2, makeMonthRecords([]), '2026-05');
console.log('Test 10C (WOP=2, Worked 0 WOP):', {
  wopRequired: sheet10C.summary.wopRequired,
  wopFulfilled: sheet10C.summary.wopFulfilled,
  wopShortfall: sheet10C.summary.wopShortfall,
  wopPenaltyDays: sheet10C.summary.wopPenaltyDays,
  absentDays: sheet10C.summary.absentDays,
  netPayableSalary: sheet10C.summary.netPayableSalary,
  expectedPayable: 28998.84 // 29 days paid out of 31 (2 WO days deducted)
});
console.assert(sheet10C.summary.wopShortfall === 2, 'WOP=2 with 0 worked should have shortfall 2');
console.assert(sheet10C.summary.wopPenaltyDays === 2, 'WOP=2 with 0 worked should penalize 2 WO days');
console.assert(sheet10C.summary.absentDays === 2, 'WOP=2 with 0 worked should have 2 absent days');
console.assert(Math.abs(sheet10C.summary.netPayableSalary - 28998.84) < 0.05, '2 days salary should be deducted');

// Test 10D: emp.wop = 2, and worked 1 WOP day -> Shortfall = 1 -> 1 WO day treated as Absent, 1 day salary deducted
const sheet10D = CalculationEngine.calculateEmployeeMonthSheet(empWop2, makeMonthRecords([7]), '2026-05');
console.log('Test 10D (WOP=2, Worked 1 WOP):', {
  wopRequired: sheet10D.summary.wopRequired,
  wopFulfilled: sheet10D.summary.wopFulfilled,
  wopShortfall: sheet10D.summary.wopShortfall,
  wopPenaltyDays: sheet10D.summary.wopPenaltyDays,
  absentDays: sheet10D.summary.absentDays
});
console.assert(sheet10D.summary.wopShortfall === 1, 'WOP=2 with 1 worked should have shortfall 1');
console.assert(sheet10D.summary.wopPenaltyDays === 1, 'WOP=2 with 1 worked should penalize 1 WO day');
console.assert(sheet10D.summary.absentDays === 1, 'WOP=2 with 1 worked should have 1 absent day');

// Test 10E: emp.wop = 2, and worked 2 WOP days -> Shortfall = 0 -> No WO deducted
const sheet10E = CalculationEngine.calculateEmployeeMonthSheet(empWop2, makeMonthRecords([7, 14]), '2026-05');
console.log('Test 10E (WOP=2, Worked 2 WOP):', {
  wopRequired: sheet10E.summary.wopRequired,
  wopFulfilled: sheet10E.summary.wopFulfilled,
  wopShortfall: sheet10E.summary.wopShortfall,
  wopPenaltyDays: sheet10E.summary.wopPenaltyDays,
  absentDays: sheet10E.summary.absentDays
});
console.assert(sheet10E.summary.wopShortfall === 0, 'WOP=2 with 2 worked should have shortfall 0');
console.assert(sheet10E.summary.wopPenaltyDays === 0, 'WOP=2 with 2 worked should penalize 0 WO days');
console.assert(sheet10E.summary.absentDays === 0, 'WOP=2 with 2 worked should have 0 absent days');

console.log('\n🎉 ALL CALCULATION RULE TESTS PASSED WITH 100% SUCCESS!\n');

