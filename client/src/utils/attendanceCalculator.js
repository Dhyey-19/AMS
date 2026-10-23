/**
 * Attendance Calculation Utility for Client-Side Dynamic Rule Evaluation
 * Mirrors server-side CalculationEngine rules to provide real-time updates as users edit attendance columns.
 */

export const timeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const cleanStr = timeStr.trim().replace('.', ':');
  const parts = cleanStr.split(':');
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return 0;
  return (h * 60) + m;
};

export const minutesToHHMM = (totalMinutes, withSign = false) => {
  if (isNaN(totalMinutes) || totalMinutes === null || totalMinutes === undefined) {
    return withSign ? '+00:00' : '00:00';
  }
  const isNegative = totalMinutes < 0;
  const absMins = Math.abs(Math.round(totalMinutes));
  const h = Math.floor(absMins / 60);
  const m = absMins % 60;
  const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  if (withSign) {
    return isNegative ? `-${formatted}` : `+${formatted}`;
  }
  return formatted;
};

export const formatTimeToHHMM = (val) => {
  if (!val) return '';
  const s = String(val).trim().replace('.', ':');
  const parts = s.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return s;
};

/**
 * Recalculate all attendance fields based on updated formData and employee master parameters.
 * @param {Object} formData - Current form state (contains all column values)
 * @param {Object} employee - Employee master details
 * @param {number} daysInMonth - Number of days in current month (e.g. 30 or 31)
 * @param {string} changedField - Name of the field that was just edited by user
 * @returns {Object} Updated form state with all rule calculations applied
 */
export const calculateDayRule = (formData, employee = {}, daysInMonth = 30, changedField = null) => {
  const updated = { ...formData };

  // Rates from employee master or manual rate override
  const isFixedPerDay = Boolean(employee.is_fixed_per_day_salary === 1 || employee.is_fixed_per_day_salary === '1' || employee.is_fixed_per_day_salary === true);
  const salaryBasis = (employee.salary_basis || 'Monthly').toLowerCase();
  const baseSalary = parseFloat(employee.salary) || 0;
  const schedDailyWorkHours = parseFloat(employee.standard_work_hours) || 12.0;

  let computedDailyRate = 0;
  let computedHourlyRate = 0;
  if (isFixedPerDay && salaryBasis === 'daily' && baseSalary > 0) {
    computedDailyRate = baseSalary;
    computedHourlyRate = schedDailyWorkHours > 0 ? (computedDailyRate / schedDailyWorkHours) : 0;
  } else {
    computedDailyRate = daysInMonth > 0 ? (baseSalary / daysInMonth) : 0;
    computedHourlyRate = schedDailyWorkHours > 0 ? (computedDailyRate / schedDailyWorkHours) : 0;
  }

  const hourlyRate = (updated.hourly_rate !== undefined && updated.hourly_rate !== '' && !isNaN(parseFloat(updated.hourly_rate)))
    ? parseFloat(updated.hourly_rate)
    : computedHourlyRate;

  const dailyRate = computedDailyRate;

  // Status code
  const statusCode = (updated.status_code || 'P').toUpperCase().trim();
  updated.status_code = statusCode;

  // Scheduled Shift parameters
  const stdInTimeStr = formatTimeToHHMM(updated.scheduled_in_time || employee.standard_in_time || '08:00');
  const stdOutTimeStr = formatTimeToHHMM(updated.scheduled_out_time || employee.standard_out_time || '20:00');
  const stdBreakMins = timeToMinutes(updated.scheduled_break_formatted) || parseInt(employee.standard_break_minutes, 10) || 0;
  const lateMultiplier = !isNaN(parseFloat(employee.late_deduction_multiplier)) ? parseFloat(employee.late_deduction_multiplier) : 1.5;
  const overtimeMultiplier = !isNaN(parseFloat(employee.overtime_multiplier)) ? parseFloat(employee.overtime_multiplier) : 2.0;
  const overtimeAllowed = employee.overtime_allowed !== 0 && employee.overtime_allowed !== false && employee.overtime_allowed !== '0';
  const minOvertimeMins = parseInt(employee.min_overtime_minutes, 10) || 0;
  const minOvertimeDeductionMins = parseInt(employee.min_overtime_deduction_minutes, 10) || 0;

  const stdInMins = timeToMinutes(stdInTimeStr);
  const stdOutMins = timeToMinutes(stdOutTimeStr);
  const schedDurMins = stdOutMins > stdInMins ? (stdOutMins - stdInMins) : 0;

  // Target work hours
  let targetWorkHours = schedDailyWorkHours;
  if (statusCode === 'WOP' && employee.wop_work_hours !== null && employee.wop_work_hours !== undefined && employee.wop_work_hours !== '') {
    if (typeof employee.wop_work_hours === 'string' && employee.wop_work_hours.includes(':')) {
      const parts = employee.wop_work_hours.split(':').map(Number);
      targetWorkHours = (parts[0] || 0) + (parts[1] || 0) / 60;
    } else {
      const parsed = parseFloat(employee.wop_work_hours);
      if (!isNaN(parsed) && parsed > 0) targetWorkHours = parsed;
    }
  } else if (updated.scheduled_work_formatted && changedField === 'scheduled_work_formatted') {
    const parsedMins = timeToMinutes(updated.scheduled_work_formatted);
    if (parsedMins > 0) targetWorkHours = parsedMins / 60;
  }

  let schedWorkMins = Math.round(targetWorkHours * 60);
  if (schedWorkMins === 0 && statusCode !== 'WOP') {
    schedWorkMins = Math.max(0, schedDurMins - stdBreakMins);
  }

  if (changedField !== 'scheduled_duration_formatted') {
    updated.scheduled_duration_formatted = minutesToHHMM(schedDurMins);
  }
  if (changedField !== 'scheduled_work_formatted') {
    updated.scheduled_work_formatted = minutesToHHMM(schedWorkMins);
  }
  if (changedField !== 'scheduled_break_formatted') {
    updated.scheduled_break_formatted = minutesToHHMM(stdBreakMins);
  }

  // Punches
  const inTimeStr = formatTimeToHHMM(updated.in_time || '');
  const outTimeStr = formatTimeToHHMM(updated.out_time || '');
  const breakOutStr = formatTimeToHHMM(updated.break_out || '');
  const breakInStr = formatTimeToHHMM(updated.break_in || '');

  const actualInMins = timeToMinutes(inTimeStr);
  const actualOutMins = timeToMinutes(outTimeStr);
  const breakOutMins = timeToMinutes(breakOutStr);
  const breakInMins = timeToMinutes(breakInStr);

  const actualBreakMins = (breakInMins > breakOutMins) ? (breakInMins - breakOutMins) : 0;

  // Effective break rule:
  // 1) If std break == 0: <= 30 min is free (0 min deduction); > 30 min deduct full actual break
  // 2) If std break > 0: if actual <= std then std is deducted; if actual > std then actual is deducted
  let effectiveBreakMins = 0;
  let breakDeductionMins = 0;
  if (stdBreakMins === 0) {
    if (actualBreakMins > 30) {
      effectiveBreakMins = actualBreakMins;
      breakDeductionMins = actualBreakMins;
    } else {
      effectiveBreakMins = 0;
      breakDeductionMins = 0;
    }
  } else {
    effectiveBreakMins = actualBreakMins >= stdBreakMins ? actualBreakMins : stdBreakMins;
    breakDeductionMins = effectiveBreakMins;
  }

  if (changedField !== 'effective_break_formatted') {
    updated.effective_break_formatted = minutesToHHMM(effectiveBreakMins);
  }

  // Deviations
  let lateInMins = 0;
  let earlyInMins = 0;
  if (actualInMins > 0 && stdInMins > 0) {
    if (actualInMins > stdInMins) lateInMins = actualInMins - stdInMins;
    else if (actualInMins < stdInMins) earlyInMins = stdInMins - actualInMins;
  }

  let lateOutMins = 0;
  let earlyOutMins = 0;
  if (actualOutMins > 0 && stdOutMins > 0) {
    if (actualOutMins > stdOutMins) lateOutMins = actualOutMins - stdOutMins;
    else if (actualOutMins < stdOutMins) earlyOutMins = stdOutMins - actualOutMins;
  }

  // Calc Mode & Duration
  const isLateIn = lateInMins > 10;
  const isLateOut = lateOutMins > 10;
  let calcMode = 'Normal';
  let rawDurationMins = 0;

  if (actualInMins > 0 && actualOutMins > 0) {
    if (isLateIn && isLateOut) calcMode = 'Both late';
    else if (isLateIn) calcMode = 'Late IN only';
    else if (isLateOut) calcMode = 'Late OUT only';
    else calcMode = 'Normal';

    rawDurationMins = actualOutMins >= actualInMins 
      ? (actualOutMins - actualInMins) 
      : (1440 - actualInMins + actualOutMins);
  } else if (actualInMins === 0 && actualOutMins === 0) {
    if (statusCode === 'WO') calcMode = 'Weekly Off';
    else if (statusCode === 'HD') calcMode = 'Half Day';
    else if (statusCode === 'A') calcMode = 'Absent';
    else if (statusCode === 'L') calcMode = 'Leave';
    else calcMode = 'Normal';
  }

  if (changedField !== 'calc_mode') {
    updated.calc_mode = calcMode;
  }

  if (changedField !== 'actual_duration_formatted') {
    updated.actual_duration_formatted = minutesToHHMM(rawDurationMins);
  }

  // Actual Work Rule 2: early in <= 30 mins excluded from actual work
  const earlyInWorkExclusion = (earlyInMins > 0 && earlyInMins <= 30) ? earlyInMins : 0;
  let actualWorkMins = 0;
  if (rawDurationMins > 0) {
    actualWorkMins = Math.max(0, rawDurationMins - earlyInWorkExclusion - breakDeductionMins);
  } else if (actualInMins === 0 && actualOutMins === 0) {
    if (statusCode === 'P' || statusCode === 'WOP') actualWorkMins = schedWorkMins;
    else if (statusCode === 'HD') actualWorkMins = Math.round(schedWorkMins / 2);
    else actualWorkMins = 0;
  }

  if (changedField !== 'actual_work_formatted') {
    updated.actual_work_formatted = minutesToHHMM(actualWorkMins);
  } else {
    actualWorkMins = timeToMinutes(updated.actual_work_formatted);
  }

  // Work Diff (+/-)
  let workDiffMins = 0;
  if (actualWorkMins > 0) {
    workDiffMins = actualWorkMins - schedWorkMins;
  } else if (statusCode === 'WO') {
    workDiffMins = 0;
  } else {
    workDiffMins = -schedWorkMins;
  }

  if (changedField !== 'work_diff_formatted') {
    updated.work_diff_formatted = minutesToHHMM(workDiffMins, true);
  }

  // Late check-in deduction (Rule 1): >10m -> 10m normal + extra * 1.5x
  let lateInDeduction = 0;
  let lateMins = 0;
  if ((statusCode === 'P' || statusCode === 'HD') && lateInMins > 10) {
    lateMins = lateInMins;
    const normalPartMins = 10;
    const extraPartMins = lateInMins - 10;
    lateInDeduction = ((normalPartMins * 1.0 + extraPartMins * lateMultiplier) / 60) * hourlyRate;
  }

  if (changedField !== 'late_formatted') {
    updated.late_formatted = lateMins > 0 ? minutesToHHMM(lateMins) : '00:00';
  }

  // Early check-out deduction (Rule 4): earlyOutMins * 1.0x
  let earlyOutDeduction = 0;
  if ((statusCode === 'P' || statusCode === 'HD') && earlyOutMins > 0) {
    earlyOutDeduction = (earlyOutMins / 60) * hourlyRate * 1.0;
  }

  // Excess break deduction (Rule 5)
  let excessBreakMins = 0;
  if (stdBreakMins === 0) {
    excessBreakMins = actualBreakMins > 30 ? actualBreakMins : 0;
  } else {
    excessBreakMins = Math.max(0, actualBreakMins - stdBreakMins);
  }
  let excessBreakDeduction = 0;
  if ((statusCode === 'P' || statusCode === 'HD') && excessBreakMins > 0) {
    excessBreakDeduction = (excessBreakMins / 60) * hourlyRate * 1.0;
  }

  let computedLateDeduction = lateInDeduction + earlyOutDeduction + excessBreakDeduction;
  if (isFixedPerDay) {
    // For fixed per day salary, no late/timing deductions reduce day salary
    computedLateDeduction = 0;
  }
  if (changedField !== 'late_salary_deduction') {
    updated.late_salary_deduction = Number(computedLateDeduction.toFixed(2));
  }

  // Early check-in pay (Rule 2): early in > 30m @ 2.0x
  let earlyInPay = 0;
  let earlyInPaidMins = 0;
  if (overtimeAllowed && (statusCode === 'P' || statusCode === 'HD') && earlyInMins > 30) {
    earlyInPaidMins = earlyInMins;
    earlyInPay = (earlyInMins / 60) * hourlyRate * overtimeMultiplier;
  }

  // Late check-out pay (Rule 3): <= 10m @ 1.0x, > 10m: 10m @ 1.0x + (lateOutMins - 10) @ 2.0x
  let lateOutPay = 0;
  let lateOutPaidMins = 0;
  if (overtimeAllowed && (statusCode === 'P' || statusCode === 'HD') && lateOutMins > 0) {
    const minOT = minOvertimeMins > 0 ? minOvertimeMins : 0;
    if (lateOutMins >= minOT) {
      lateOutPaidMins = lateOutMins;
      if (lateOutMins > 10) {
        const normalPart = 10;
        const extraPart = lateOutMins - 10;
        lateOutPay = ((normalPart * 1.0 + extraPart * overtimeMultiplier) / 60) * hourlyRate;
      } else {
        // lateOutMins <= 10
        lateOutPay = (lateOutMins / 60) * hourlyRate * 1.0;
      }
    }
  }

  // Manual OT / WO OT
  const manualOtMins = parseInt(updated.overtime_override_minutes, 10) || 0;
  const manualOtPay = manualOtMins > 0 ? (manualOtMins / 60) * hourlyRate * overtimeMultiplier : 0;

  let woOtPay = 0;
  let woOtMins = 0;
  if (overtimeAllowed && statusCode === 'WO' && actualWorkMins > 0) {
    if (actualWorkMins >= minOvertimeMins) {
      woOtMins = Math.max(0, actualWorkMins - (minOvertimeDeductionMins > 0 ? minOvertimeDeductionMins : 15));
      woOtPay = (woOtMins / 60) * hourlyRate * overtimeMultiplier;
    }
  }

  let overtimeMins = 0;
  let computedOvertimePay = 0;
  if (manualOtMins > 0) {
    overtimeMins = manualOtMins;
    computedOvertimePay = manualOtPay;
  } else if (statusCode === 'WO') {
    overtimeMins = woOtMins;
    computedOvertimePay = woOtPay;
  } else if (statusCode === 'WOP') {
    overtimeMins = 0;
    computedOvertimePay = 0;
  } else {
    overtimeMins = earlyInPaidMins + lateOutPaidMins;
    computedOvertimePay = earlyInPay + lateOutPay;
  }

  if (changedField !== 'overtime_formatted') {
    updated.overtime_formatted = minutesToHHMM(overtimeMins);
  }
  if (changedField !== 'overtime_pay') {
    updated.overtime_pay = Number(computedOvertimePay.toFixed(2));
  }

  // Daily Salary Earned
  let computedDailySalary = 0;
  if (isFixedPerDay) {
    // Fixed Per Day Salary rule: full day salary if present (P, WO, WOP), half if HD, zero if absent (A)
    if (statusCode === 'P' || statusCode === 'WO' || statusCode === 'WOP') {
      computedDailySalary = dailyRate;
    } else if (statusCode === 'HD') {
      computedDailySalary = Number((dailyRate * 0.5).toFixed(2));
    } else if (statusCode === 'A') {
      computedDailySalary = 0;
    }
  } else {
    if (statusCode === 'WO' || statusCode === 'WOP') {
      computedDailySalary = schedDailyWorkHours * hourlyRate;
    } else if (statusCode === 'P') {
      computedDailySalary = targetWorkHours * hourlyRate;
    } else if (statusCode === 'HD') {
      computedDailySalary = (schedDailyWorkHours * 0.5) * hourlyRate;
    } else if (statusCode === 'A') {
      computedDailySalary = 0;
    }
  }

  if (changedField !== 'daily_salary_earned') {
    updated.daily_salary_earned = Number(computedDailySalary.toFixed(2));
  }

  if (changedField !== 'hourly_rate') {
    updated.hourly_rate = Number(hourlyRate.toFixed(2));
  }

  // Net Daily Salary = max(0, daily_salary_earned - late_salary_deduction + overtime_pay - leave_deduction - penalty_amount)
  const earnedSal = parseFloat(updated.daily_salary_earned) || 0;
  const lateDed = parseFloat(updated.late_salary_deduction) || 0;
  const otPay = parseFloat(updated.overtime_pay) || 0;
  const leaveDed = parseFloat(updated.leave_deduction) || 0;
  const penAmt = parseFloat(updated.penalty_amount) || 0;

  let computedNetSalary = 0;
  if (statusCode === 'A') {
    computedNetSalary = 0;
  } else {
    computedNetSalary = Math.max(0, earnedSal - lateDed + otPay - leaveDed - penAmt);
  }

  if (changedField !== 'net_daily_salary') {
    updated.net_daily_salary = Number(computedNetSalary.toFixed(2));
  }

  return updated;
};
