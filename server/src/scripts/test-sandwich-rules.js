const assert = require('assert');
const CalculationEngine = require('../services/calculationEngine');

console.log('--- RUNNING TEST SUITE: Sandwich Leave & Holiday Rules ---');

// Helper to construct mock employee
function createMockEmployee(overrides = {}) {
  return {
    employee_code: 'EMP001',
    employee_name: 'Test Employee',
    salary: 31000,
    salary_basis: 'Monthly',
    standard_in_time: '08:00',
    standard_out_time: '20:00',
    standard_work_hours: 12.0,
    standard_break_minutes: 0,
    weekly_off_days: 'Sunday',
    wop: 0,
    late_grace_minutes: 11,
    late_deduction_multiplier: 0.5,
    overtime_multiplier: 2.0,
    overtime_allowed: 1,
    min_overtime_minutes: 0,
    min_overtime_deduction_minutes: 0,
    ...overrides
  };
}

// ----------------------------------------------------
// TEST 1: Weekly Off Detection for Sunday vs Sat & Sun
// ----------------------------------------------------
console.log('\n[Test 1] Weekly Off Detection');
{
  const empSun = createMockEmployee({ weekly_off_days: 'Sunday' });
  const empSatSun = createMockEmployee({ weekly_off_days: 'Saturday, Sunday' });
  const empSatSunAmp = createMockEmployee({ weekly_off_days: 'Saturday & Sunday' });

  // 2026-10-03 is Saturday, 2026-10-04 is Sunday, 2026-10-05 is Monday
  assert.strictEqual(CalculationEngine.isWeeklyOff(empSun, '2026-10-03'), false, 'Sat should not be WO for Sunday emp');
  assert.strictEqual(CalculationEngine.isWeeklyOff(empSun, '2026-10-04'), true, 'Sun should be WO for Sunday emp');
  
  assert.strictEqual(CalculationEngine.isWeeklyOff(empSatSun, '2026-10-03'), true, 'Sat should be WO for Sat-Sun emp');
  assert.strictEqual(CalculationEngine.isWeeklyOff(empSatSun, '2026-10-04'), true, 'Sun should be WO for Sat-Sun emp');
  assert.strictEqual(CalculationEngine.isWeeklyOff(empSatSun, '2026-10-05'), false, 'Mon should not be WO for Sat-Sun emp');

  assert.strictEqual(CalculationEngine.isWeeklyOff(empSatSunAmp, '2026-10-03'), true, 'Sat should be WO for Sat & Sun emp');
  assert.strictEqual(CalculationEngine.isWeeklyOff(empSatSunAmp, '2026-10-04'), true, 'Sun should be WO for Sat & Sun emp');
  console.log('✔ Test 1 Passed: Weekly Off detection matches correctly.');
}

// ----------------------------------------------------
// TEST 2: Sandwich Leave Rule for Single Sunday Holiday
// ----------------------------------------------------
console.log('\n[Test 2] Sandwich Leave Rule for Sunday Holiday');
{
  // October 2026 has 31 days.
  // 2026-10-03 (Sat), 2026-10-04 (Sun - WO), 2026-10-05 (Mon)
  const emp = createMockEmployee({ weekly_off_days: 'Sunday' });

  // Scenario 2A: Absent on Saturday and Monday -> Sunday must be Sandwich Absent (0 salary)
  const rawRecordsA = [];
  for (let d = 1; d <= 31; d++) {
    const dayStr = String(d).padStart(2, '0');
    const dateIso = `2026-10-${dayStr}`;
    const isSun = CalculationEngine.isWeeklyOff(emp, dateIso);
    
    if (d === 3 || d === 5) {
      // Sat Oct 3 and Mon Oct 5 are ABSENT
      rawRecordsA.push({
        attendance_date_iso: dateIso,
        status_code: 'A',
        actual_in_time: null,
        actual_out_time: null
      });
    } else if (isSun) {
      // Unworked Sunday WO
      rawRecordsA.push({
        attendance_date_iso: dateIso,
        status_code: 'WO',
        actual_in_time: null,
        actual_out_time: null
      });
    } else {
      // Normal present
      rawRecordsA.push({
        attendance_date_iso: dateIso,
        status_code: 'P',
        actual_in_time: '08:00',
        actual_out_time: '20:00'
      });
    }
  }

  const resultA = CalculationEngine.calculateEmployeeMonthSheet(emp, rawRecordsA, '2026-10');
  const sunRecord = resultA.dailyRecords.find(d => d.attendance_date_iso === '2026-10-04');
  
  assert.strictEqual(sunRecord.is_sandwich_absent, true, 'Sunday between absent Sat and Mon must be sandwich absent');
  assert.strictEqual(sunRecord.daily_salary_earned, 0, 'Sandwich Sunday must have 0 daily salary earned');
  assert.strictEqual(sunRecord.net_daily_salary, 0, 'Sandwich Sunday must have 0 net daily salary');
  assert.strictEqual(resultA.summary.sandwichAbsentDays, 1, 'Summary must record 1 sandwich absent day');
  console.log('✔ Test 2A Passed: Sunday correctly penalized as Sandwich Absent (0 salary).');

  // Scenario 2B: Present on Saturday, Absent on Monday -> Sunday is NOT Sandwich (Paid WO)
  const rawRecordsB = JSON.parse(JSON.stringify(rawRecordsA));
  const satRecordB = rawRecordsB.find(d => d.attendance_date_iso === '2026-10-03');
  satRecordB.status_code = 'P';
  satRecordB.actual_in_time = '08:00';
  satRecordB.actual_out_time = '20:00';

  const resultB = CalculationEngine.calculateEmployeeMonthSheet(emp, rawRecordsB, '2026-10');
  const sunRecordB = resultB.dailyRecords.find(d => d.attendance_date_iso === '2026-10-04');
  assert.strictEqual(sunRecordB.is_sandwich_absent, false, 'Sunday with Sat present should NOT be sandwich absent');
  assert.ok(sunRecordB.daily_salary_earned >= 999, 'Sunday should be paid full daily rate (~1000)');
  console.log('✔ Test 2B Passed: Sunday is paid when one side is present.');
}

// ----------------------------------------------------
// TEST 3: Sandwich Leave Rule for Saturday & Sunday Holidays
// ----------------------------------------------------
console.log('\n[Test 3] Sandwich Leave Rule for Saturday & Sunday Holidays');
{
  // 2026-10-02 (Fri), 2026-10-03 (Sat - WO), 2026-10-04 (Sun - WO), 2026-10-05 (Mon)
  const emp2 = createMockEmployee({ weekly_off_days: 'Saturday, Sunday' });

  // Scenario 3A: Absent on Friday and Monday -> BOTH Sat & Sun must be treated as absent (0 salary)
  const rawRecords = [];
  for (let d = 1; d <= 31; d++) {
    const dayStr = String(d).padStart(2, '0');
    const dateIso = `2026-10-${dayStr}`;
    const isWO = CalculationEngine.isWeeklyOff(emp2, dateIso);

    if (d === 2 || d === 5) {
      // Fri Oct 2 and Mon Oct 5 absent
      rawRecords.push({
        attendance_date_iso: dateIso,
        status_code: 'A',
        actual_in_time: null,
        actual_out_time: null
      });
    } else if (isWO) {
      rawRecords.push({
        attendance_date_iso: dateIso,
        status_code: 'WO',
        actual_in_time: null,
        actual_out_time: null
      });
    } else {
      rawRecords.push({
        attendance_date_iso: dateIso,
        status_code: 'P',
        actual_in_time: '08:00',
        actual_out_time: '20:00'
      });
    }
  }

  const result = CalculationEngine.calculateEmployeeMonthSheet(emp2, rawRecords, '2026-10');
  const satRec = result.dailyRecords.find(d => d.attendance_date_iso === '2026-10-03');
  const sunRec = result.dailyRecords.find(d => d.attendance_date_iso === '2026-10-04');

  assert.strictEqual(satRec.is_sandwich_absent, true, 'Saturday must be sandwich absent');
  assert.strictEqual(satRec.daily_salary_earned, 0, 'Saturday salary must be 0');
  assert.strictEqual(sunRec.is_sandwich_absent, true, 'Sunday must be sandwich absent');
  assert.strictEqual(sunRec.daily_salary_earned, 0, 'Sunday salary must be 0');
  assert.strictEqual(result.summary.sandwichAbsentDays, 2, 'Summary should have 2 sandwich absent days');
  console.log('✔ Test 3A Passed: Both Saturday & Sunday are treated as absent (no salary).');
}

// ----------------------------------------------------
// TEST 4: Multi-Day Continuous Leave Spanning Holidays
// ----------------------------------------------------
console.log('\n[Test 4] Multi-Day Continuous Leave Spanning Holidays');
{
  // Absent Wed(Oct 7), Thu(Oct 8), Fri(Oct 9), Sat(Oct 10-WO), Sun(Oct 11-WO), Mon(Oct 12), Tue(Oct 13)
  const emp = createMockEmployee({ weekly_off_days: 'Saturday, Sunday' });
  const rawRecords = [];

  for (let d = 1; d <= 31; d++) {
    const dayStr = String(d).padStart(2, '0');
    const dateIso = `2026-10-${dayStr}`;
    const isWO = CalculationEngine.isWeeklyOff(emp, dateIso);

    // Multi-day leave from Oct 7 to Oct 13
    if (d >= 7 && d <= 13) {
      if (isWO) {
        rawRecords.push({ attendance_date_iso: dateIso, status_code: 'WO' });
      } else {
        rawRecords.push({ attendance_date_iso: dateIso, status_code: 'A' });
      }
    } else if (isWO) {
      rawRecords.push({ attendance_date_iso: dateIso, status_code: 'WO' });
    } else {
      rawRecords.push({ attendance_date_iso: dateIso, status_code: 'P', actual_in_time: '08:00', actual_out_time: '20:00' });
    }
  }

  const result = CalculationEngine.calculateEmployeeMonthSheet(emp, rawRecords, '2026-10');
  const satRec = result.dailyRecords.find(d => d.attendance_date_iso === '2026-10-10');
  const sunRec = result.dailyRecords.find(d => d.attendance_date_iso === '2026-10-11');

  assert.strictEqual(satRec.is_sandwich_absent, true, 'Intervening Saturday must be sandwich absent');
  assert.strictEqual(satRec.daily_salary_earned, 0, 'Intervening Saturday must have 0 salary');
  assert.strictEqual(sunRec.is_sandwich_absent, true, 'Intervening Sunday must be sandwich absent');
  assert.strictEqual(sunRec.daily_salary_earned, 0, 'Intervening Sunday must have 0 salary');
  console.log('✔ Test 4 Passed: Multi-day continuous leave across holidays penalizes all intervening holidays.');
}

// ----------------------------------------------------
// TEST 5: Compulsory Holiday Presence (WOP = 1 & WOP = 2)
// ----------------------------------------------------
console.log('\n[Test 5] Compulsory Holiday Presence Shortfall Penalties');
{
  // Oct 2026 has 4 Sundays (Oct 4, 11, 18, 25).
  // Employee 5A: wop = 1, worked 0 holidays
  const emp1 = createMockEmployee({ weekly_off_days: 'Sunday', wop: 1 });
  const records1 = [];
  for (let d = 1; d <= 31; d++) {
    const dayStr = String(d).padStart(2, '0');
    const dateIso = `2026-10-${dayStr}`;
    const isWO = CalculationEngine.isWeeklyOff(emp1, dateIso);
    if (isWO) {
      records1.push({ attendance_date_iso: dateIso, status_code: 'WO' });
    } else {
      // Present all other days (no sandwich)
      records1.push({ attendance_date_iso: dateIso, status_code: 'P', actual_in_time: '08:00', actual_out_time: '20:00' });
    }
  }

  const res1 = CalculationEngine.calculateEmployeeMonthSheet(emp1, records1, '2026-10');
  assert.strictEqual(res1.summary.wopShortfallDays, 1, 'Shortfall should be 1 day when required 1 and worked 0');
  const shortfallDays1 = res1.dailyRecords.filter(d => d.is_wop_shortfall);
  assert.strictEqual(shortfallDays1.length, 1, 'Exactly 1 holiday must be marked as shortfall absent');
  assert.strictEqual(shortfallDays1[0].daily_salary_earned, 0, 'Shortfall holiday must have 0 daily salary');
  console.log('✔ Test 5A Passed: WOP = 1 with 0 worked holidays converts 1 holiday to absent (salary deducted).');

  // Employee 5B: wop = 2, worked 0 holidays -> 2 holidays penalized
  const emp2 = createMockEmployee({ weekly_off_days: 'Sunday', wop: 2 });
  const res2 = CalculationEngine.calculateEmployeeMonthSheet(emp2, records1, '2026-10');
  assert.strictEqual(res2.summary.wopShortfallDays, 2, 'Shortfall should be 2 days when required 2 and worked 0');
  const shortfallDays2 = res2.dailyRecords.filter(d => d.is_wop_shortfall);
  assert.strictEqual(shortfallDays2.length, 2, 'Exactly 2 holidays must be marked as shortfall absent');
  assert.strictEqual(shortfallDays2[0].daily_salary_earned, 0, 'Shortfall holiday 1 must have 0 daily salary');
  assert.strictEqual(shortfallDays2[1].daily_salary_earned, 0, 'Shortfall holiday 2 must have 0 daily salary');
  console.log('✔ Test 5B Passed: WOP = 2 with 0 worked holidays converts 2 holidays to absent (salary deducted).');

  // Employee 5C: wop = 2, worked 1 holiday (WOP on Oct 4) -> 1 holiday penalized
  const records3 = JSON.parse(JSON.stringify(records1));
  const oct4 = records3.find(d => d.attendance_date_iso === '2026-10-04');
  oct4.status_code = 'WOP';
  oct4.actual_in_time = '08:00';
  oct4.actual_out_time = '20:00';

  const res3 = CalculationEngine.calculateEmployeeMonthSheet(emp2, records3, '2026-10');
  assert.strictEqual(res3.summary.wopShortfallDays, 1, 'Shortfall should be 1 day when required 2 and worked 1');
  const shortfallDays3 = res3.dailyRecords.filter(d => d.is_wop_shortfall);
  assert.strictEqual(shortfallDays3.length, 1, 'Exactly 1 holiday must be marked as shortfall absent');
  console.log('✔ Test 5C Passed: WOP = 2 with 1 worked holiday converts 1 remaining holiday to absent.');

  // Employee 5D: wop = 2, worked 2 holidays (Oct 4 and Oct 11) -> 0 penalties
  const oct11 = records3.find(d => d.attendance_date_iso === '2026-10-11');
  oct11.status_code = 'WOP';
  oct11.actual_in_time = '08:00';
  oct11.actual_out_time = '20:00';

  const res4 = CalculationEngine.calculateEmployeeMonthSheet(emp2, records3, '2026-10');
  assert.strictEqual(res4.summary.wopShortfallDays, 0, 'Shortfall should be 0 days when required 2 and worked 2');
  assert.strictEqual(res4.dailyRecords.filter(d => d.is_wop_shortfall).length, 0, 'No holidays should be penalized');
  console.log('✔ Test 5D Passed: WOP = 2 with 2 worked holidays has zero penalties.');
}

// ----------------------------------------------------
// TEST 6: Sandwich Leave and WOP Harmonization (No Double Deductions)
// ----------------------------------------------------
console.log('\n[Test 6] Sandwich Leave and WOP Harmonization');
{
  // Employee has wop = 1, and also has 1 sandwiched holiday.
  // Oct 4 is sandwiched (Sat Oct 3 & Mon Oct 5 absent).
  // Total 4 Sundays: Oct 4 (Sandwiched), Oct 11 (WO), Oct 18 (WO), Oct 25 (WO).
  // WOP requirement = 1. Worked 0 holidays. Shortfall = 1.
  // The engine should penalize Oct 4 for Sandwich, and one of the OTHER unworked WOs (e.g. Oct 25) for WOP shortfall.
  // It must NEVER double-penalize Oct 4.
  const emp = createMockEmployee({ weekly_off_days: 'Sunday', wop: 1 });
  const rawRecords = [];
  for (let d = 1; d <= 31; d++) {
    const dayStr = String(d).padStart(2, '0');
    const dateIso = `2026-10-${dayStr}`;
    const isWO = CalculationEngine.isWeeklyOff(emp, dateIso);
    if (d === 3 || d === 5) {
      // Oct 3 Sat & Oct 5 Mon absent
      rawRecords.push({ attendance_date_iso: dateIso, status_code: 'A' });
    } else if (isWO) {
      rawRecords.push({ attendance_date_iso: dateIso, status_code: 'WO' });
    } else {
      rawRecords.push({ attendance_date_iso: dateIso, status_code: 'P', actual_in_time: '08:00', actual_out_time: '20:00' });
    }
  }

  const result = CalculationEngine.calculateEmployeeMonthSheet(emp, rawRecords, '2026-10');
  const oct4 = result.dailyRecords.find(d => d.attendance_date_iso === '2026-10-04');
  assert.strictEqual(oct4.is_sandwich_absent, true, 'Oct 4 must be sandwich absent');
  assert.strictEqual(oct4.is_wop_shortfall, false, 'Oct 4 must not be double-penalized as wop shortfall');

  const wopShortfalls = result.dailyRecords.filter(d => d.is_wop_shortfall);
  assert.strictEqual(wopShortfalls.length, 1, 'There should be exactly 1 WOP shortfall penalty');
  assert.notStrictEqual(wopShortfalls[0].attendance_date_iso, '2026-10-04', 'WOP shortfall penalty must be on another unpenalized holiday');
  
  assert.strictEqual(result.summary.sandwichAbsentDays, 1);
  assert.strictEqual(result.summary.wopShortfallDays, 1);
  console.log('✔ Test 6 Passed: Sandwich leave and WOP shortfall seamlessly harmonize without double deductions.');
}

console.log('\n========================================');
console.log('ALL 6 TEST SUITES PASSED FLAWLESSLY! 🚀');
console.log('========================================');
