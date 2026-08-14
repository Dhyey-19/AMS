/**
 * AMS Dynamic Attendance & Salary Calculation Engine
 * 
 * Accurately implements all dynamic calculations from MAY - 26.xlsx:
 * - Expected Work Hours & Scheduled Durations
 * - Biometric Punch Evaluations & Grace Caps
 * - Actual Work Time & Break Times
 * - Work Hour Variance / Difference (+/-)
 * - Late Arrival Detection & Late Salary Penalties
 * - Overtime Calculation & Overtime Compensation
 * - Dynamic Rates (Hourly, Daily, Monthly Scales)
 * - Daily & Monthly Salary Computations
 * - Attendance Percentages & Aggregate KPI Summaries
 */

class CalculationEngine {
  /**
   * Convert time string (e.g. "08:30", "18:00", "08:30:15") or Excel numeric fraction to minutes from midnight
   */
  static timeToMinutes(timeVal) {
    if (timeVal === null || timeVal === undefined || timeVal === '') return 0;
    
    if (typeof timeVal === 'number') {
      // Excel day fraction: 0.3333333333333333 * 1440 = 480 mins (8:00 AM)
      return Math.round(timeVal * 1440);
    }

    const str = timeVal.toString().trim();
    if (!str || str.toLowerCase() === 'none' || str.toLowerCase() === 'false' || str.toLowerCase() === 'null') {
      return 0;
    }

    const parts = str.split(':');
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      return h * 60 + m;
    }

    return 0;
  }

  /**
   * Convert minutes to formatted HH:MM (e.g. 510 -> "08:30", -38 -> "-00:38")
   */
  static minutesToHHMM(mins, showSign = false) {
    if (mins === null || mins === undefined || isNaN(mins)) return '00:00';
    const isNegative = mins < 0;
    const abs = Math.abs(Math.round(mins));
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    
    if (isNegative) return `-${formatted}`;
    if (showSign && mins > 0) return `+${formatted}`;
    return formatted;
  }

  /**
   * Normalize time string to "HH:MM" 24-hour format
   */
  static formatTimeString(timeVal) {
    if (!timeVal && timeVal !== 0) return '';
    if (typeof timeVal === 'number') {
      const mins = Math.round(timeVal * 1440);
      const h = Math.floor(mins / 60) % 24;
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    const str = timeVal.toString().trim();
    if (!str || str.toLowerCase() === 'none' || str.toLowerCase() === 'false') return '';
    const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      return `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}`;
    }
    return str;
  }

  /**
   * Calculate effective days in a month given a date string ("YYYY-MM-DD" or "YYYY-MM")
   */
  static getDaysInMonth(dateStr) {
    if (!dateStr) return 30;
    try {
      const parts = dateStr.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      if (year && month) {
        return new Date(year, month, 0).getDate();
      }
    } catch (e) {}
    return 30;
  }

  /**
   * Compute dynamic hourly and daily rates for an employee for a specific month
   */
  static getEmployeeRates(emp, daysInMonth = 30) {
    const baseSalary = parseFloat(emp.salary) || 0;
    const stdWorkHours = parseFloat(emp.standard_work_hours) || 8.0;
    const rateType = (emp.rate_type || 'hourly').toLowerCase();

    let hourlyRate = 0;
    let dailyRate = 0;

    if (emp.hourly_rate && parseFloat(emp.hourly_rate) > 0) {
      hourlyRate = parseFloat(emp.hourly_rate);
      dailyRate = emp.daily_rate ? parseFloat(emp.daily_rate) : hourlyRate * stdWorkHours;
    } else if (emp.daily_rate && parseFloat(emp.daily_rate) > 0) {
      dailyRate = parseFloat(emp.daily_rate);
      hourlyRate = stdWorkHours > 0 ? dailyRate / stdWorkHours : 0;
    } else if (baseSalary > 0) {
      const divisorDays = rateType === 'monthly_31' ? 31 : (rateType === 'monthly_30' ? 30 : daysInMonth);
      dailyRate = baseSalary / divisorDays;
      hourlyRate = stdWorkHours > 0 ? dailyRate / stdWorkHours : 0;
    }

    return {
      hourlyRate: Number(hourlyRate.toFixed(4)),
      dailyRate: Number(dailyRate.toFixed(2)),
      baseSalary
    };
  }

  /**
   * Calculate a single day's attendance record with all dynamic derivations
   */
  static calculateDayRecord(emp, record, daysInMonth = 30) {
    const { hourlyRate, dailyRate, baseSalary } = this.getEmployeeRates(emp, daysInMonth);

    // Standard Shift parameters from Employee Master
    const stdInTimeStr = emp.standard_in_time || '08:00';
    const stdOutTimeStr = emp.standard_out_time || '20:00';
    const stdBreakMins = parseInt(emp.standard_break_minutes, 10) || 0;
    const stdWorkHours = parseFloat(emp.standard_work_hours) || 12.0;
    const lateGraceMins = parseInt(emp.late_grace_minutes, 10) || 11;
    const lateMultiplier = !isNaN(parseFloat(emp.late_deduction_multiplier)) ? parseFloat(emp.late_deduction_multiplier) : 0.5;
    const overtimeMultiplier = !isNaN(parseFloat(emp.overtime_multiplier)) ? parseFloat(emp.overtime_multiplier) : 2.0;
    const overtimeAllowed = emp.overtime_allowed !== 0 && emp.overtime_allowed !== false;
    const minOvertimeMins = parseInt(emp.min_overtime_minutes, 10) || 0;
    const minOvertimeDeductionMins = parseInt(emp.min_overtime_deduction_minutes, 10) || 0;

    const stdInMins = this.timeToMinutes(stdInTimeStr);
    const stdOutMins = this.timeToMinutes(stdOutTimeStr);
    let schedDurMins = stdOutMins > stdInMins ? stdOutMins - stdInMins : 0;
    let schedWorkMins = Math.round(stdWorkHours * 60);
    if (schedWorkMins === 0) {
      schedWorkMins = Math.max(0, schedDurMins - stdBreakMins);
    }

    // Actual Punches from Raw Attendance Record
    const rawInTime = record.in_time || '';
    const rawOutTime = record.out_time || '';
    const rawBreakOut = record.break_out || '';
    const rawBreakIn = record.break_in || '';
    const statusCode = (record.status_code || 'A').toUpperCase().trim();

    const actualInMins = this.timeToMinutes(rawInTime);
    const actualOutMins = this.timeToMinutes(rawOutTime);
    const breakOutMins = this.timeToMinutes(rawBreakOut);
    const breakInMins = this.timeToMinutes(rawBreakIn);

    // Actual Break Duration: Break Out - Break In (difference between break punches)
    let actualBreakMins = 0;
    if (breakOutMins > 0 && breakInMins > 0) {
      actualBreakMins = Math.abs(breakOutMins - breakInMins);
    } else if (breakOutMins > 0 || breakInMins > 0) {
      // If only one break punch is available, default to scheduled break or 0
      actualBreakMins = stdBreakMins;
    }

    // Effective In Time for calculations (Grace period evaluation)
    // If actual In Time is within late_grace_minutes from standard In Time, consider it as standard In Time in all calculations
    let effectiveInMins = actualInMins;
    if (actualInMins > 0 && stdInMins > 0) {
      if (actualInMins >= stdInMins && (actualInMins - stdInMins) <= lateGraceMins) {
        // Within grace period (e.g. standard 09:00, actual 09:07, grace 10m/11m -> considered 09:00)
        effectiveInMins = stdInMins;
      } else if (actualInMins < stdInMins) {
        // Early arrival before shift start -> considered standard In Time
        effectiveInMins = stdInMins;
      } else {
        // Exceeded grace period (e.g. 09:20 when std is 09:00) -> late arrival, starts from actual In Time
        effectiveInMins = actualInMins;
      }
    }

    // Effective Out Time for calculations
    let effectiveOutMins = actualOutMins;

    // Overtime Duration (excluding early arrival time - only post-shift work past standard out time qualifies)
    let rawOvertimeMins = 0;
    if (record.overtime_override_minutes && record.overtime_override_minutes > 0) {
      rawOvertimeMins = record.overtime_override_minutes;
    } else if (actualOutMins > 0 && stdOutMins > 0 && (statusCode === 'P' || statusCode === 'HD')) {
      // Overtime is strictly time worked after standard shift out time
      if (actualOutMins > stdOutMins) {
        rawOvertimeMins = actualOutMins - stdOutMins;
      } else {
        rawOvertimeMins = 0;
      }
    } else if (record.over_time_minutes && record.over_time_minutes > 0) {
      rawOvertimeMins = record.over_time_minutes;
    } else if (record.over_time && typeof record.over_time === 'string' && record.over_time !== '00:00') {
      rawOvertimeMins = this.timeToMinutes(record.over_time);
    }

    if (!overtimeAllowed) {
      rawOvertimeMins = 0;
    }

    // Step 1: Subtract OT deduction (min_overtime_deduction_minutes) from raw overtime
    let overtimeMins = rawOvertimeMins;
    if (overtimeMins > 0 && minOvertimeDeductionMins > 0) {
      overtimeMins = Math.max(0, overtimeMins - minOvertimeDeductionMins);
    }

    // Step 2: If O.T. after subtracting OT deduction is less than or equal to min O.T., consider it as no overtime (0 OT, 0 OT pay)
    if (minOvertimeMins > 0 && overtimeMins <= minOvertimeMins) {
      overtimeMins = 0;
    }

    // Actual Time Duration calculation
    let inShiftDurMins = 0;
    if (actualInMins > 0 && actualOutMins > 0) {
      if (stdOutMins > 0) {
        const shiftEndMins = Math.min(actualOutMins, stdOutMins);
        inShiftDurMins = Math.max(0, shiftEndMins - effectiveInMins);
      } else {
        inShiftDurMins = Math.max(0, actualOutMins - effectiveInMins);
      }
    }

    // Post-shift regular credit:
    // If overtime qualified, post-shift work is paid as OT.
    // If overtime did not qualify, post-shift time up to minOvertimeDeductionMins is credited to regular duration.
    let regularPostShiftMins = 0;
    if (overtimeMins === 0 && rawOvertimeMins > 0 && stdOutMins > 0) {
      regularPostShiftMins = minOvertimeDeductionMins > 0
        ? Math.min(rawOvertimeMins, minOvertimeDeductionMins)
        : rawOvertimeMins;
    }

    let actualDurMins = inShiftDurMins + regularPostShiftMins;

    // Effective Break Time: If actual break <= standard break, subtract standard break; if actual break is more, subtract actual break
    const effectiveBreak = Math.max(actualBreakMins, stdBreakMins);

    // Actual Work Time: Duration minus Effective Break Time
    let actualWorkMins = 0;
    if (statusCode === 'P' || statusCode === 'WOP' || statusCode === 'HD') {
      if (actualDurMins > 0) {
        actualWorkMins = Math.max(0, actualDurMins - effectiveBreak);
      } else if (statusCode === 'WOP' || statusCode === 'P') {
        // Fallback to scheduled work time if punch exists
        actualWorkMins = schedWorkMins;
      }
    } else if (statusCode === 'WO') {
      // Weekly off is paid full expected hours
      actualWorkMins = schedWorkMins;
    } else if (statusCode === 'A') {
      actualWorkMins = 0;
    }

    // Work Hour Difference (+/-)
    const workDiffMins = (statusCode === 'P' || statusCode === 'WOP' || statusCode === 'HD')
      ? (actualWorkMins - schedWorkMins)
      : (statusCode === 'WO' ? 0 : -schedWorkMins);

    // In Time Late Calculation
    let lateMins = 0;
    if ((statusCode === 'P' || statusCode === 'HD') && actualInMins > 0 && stdInMins > 0) {
      const diffIn = actualInMins - stdInMins;
      if (diffIn > lateGraceMins) {
        lateMins = diffIn;
      }
    }

    // Early Departure Calculation
    let earlyMins = 0;
    if ((statusCode === 'P' || statusCode === 'HD') && actualOutMins > 0 && stdOutMins > 0) {
      const diffOut = stdOutMins - actualOutMins;
      if (diffOut > lateGraceMins) {
        earlyMins = diffOut;
      }
    }

    // Financial calculations for the day
    let dailySalaryEarned = 0;
    if (statusCode === 'P' || statusCode === 'WOP') {
      if (actualWorkMins > 0) {
        dailySalaryEarned = (actualWorkMins / 60) * hourlyRate;
      } else {
        dailySalaryEarned = dailyRate;
      }
    } else if (statusCode === 'WO') {
      dailySalaryEarned = dailyRate;
    } else if (statusCode === 'HD') {
      dailySalaryEarned = dailyRate * 0.5;
    } else if (statusCode === 'A') {
      dailySalaryEarned = 0;
    }

    const lateSalaryDeduction = (lateMins / 60) * hourlyRate * lateMultiplier;
    const overtimePay = (overtimeAllowed && overtimeMins > 0)
      ? (overtimeMins / 60) * hourlyRate * overtimeMultiplier
      : 0;

    const leaveDeduction = parseFloat(record.leave_deduction) || 0;
    const penaltyAmount = parseFloat(record.penalty_amount) || 0;

    let netDailySalary = 0;
    if (statusCode === 'A') {
      netDailySalary = 0;
    } else {
      netDailySalary = Math.max(0, dailySalaryEarned - lateSalaryDeduction + overtimePay - leaveDeduction - penaltyAmount);
    }

    return {
      // Raw data fields
      employee_code: emp.employee_code,
      attendance_date: record.attendance_date || record.attendance_date_iso,
      attendance_date_iso: record.attendance_date_iso,
      status_code: statusCode,
      
      // Scheduled / Expected
      scheduled_in_time: stdInTimeStr,
      scheduled_out_time: stdOutTimeStr,
      scheduled_duration_minutes: schedDurMins,
      scheduled_duration_formatted: this.minutesToHHMM(schedDurMins),
      scheduled_break_minutes: stdBreakMins,
      scheduled_break_formatted: this.minutesToHHMM(stdBreakMins),
      scheduled_work_minutes: schedWorkMins,
      scheduled_work_formatted: this.minutesToHHMM(schedWorkMins),
      
      // Actual Punches
      actual_in_time: this.formatTimeString(rawInTime),
      actual_out_time: this.formatTimeString(rawOutTime),
      break_out: this.formatTimeString(rawBreakOut),
      break_in: this.formatTimeString(rawBreakIn),
      actual_break_minutes: actualBreakMins,
      actual_break_formatted: this.minutesToHHMM(actualBreakMins),
      effective_break_minutes: effectiveBreak,
      effective_break_formatted: this.minutesToHHMM(effectiveBreak),
      actual_duration_minutes: actualDurMins,
      actual_duration_formatted: this.minutesToHHMM(actualDurMins),
      actual_work_minutes: actualWorkMins,
      actual_work_formatted: this.minutesToHHMM(actualWorkMins),
      
      // Deviations
      work_diff_minutes: workDiffMins,
      work_diff_formatted: this.minutesToHHMM(workDiffMins, true),
      late_minutes: lateMins,
      late_formatted: lateMins > 0 ? this.minutesToHHMM(lateMins) : '00:00',
      is_late: lateMins > 0,
      early_minutes: earlyMins,
      early_formatted: earlyMins > 0 ? this.minutesToHHMM(earlyMins) : '00:00',
      is_early: earlyMins > 0,
      overtime_minutes: overtimeMins,
      overtime_formatted: this.minutesToHHMM(overtimeMins),

      // Rates and Salary breakdown
      hourly_rate: Number(hourlyRate.toFixed(2)),
      daily_rate: Number(dailyRate.toFixed(2)),
      daily_salary_earned: Number(dailySalaryEarned.toFixed(2)),
      late_salary_deduction: Number(lateSalaryDeduction.toFixed(2)),
      overtime_pay: Number(overtimePay.toFixed(2)),
      leave_deduction: Number(leaveDeduction.toFixed(2)),
      penalty_amount: Number(penaltyAmount.toFixed(2)),
      net_daily_salary: Number(netDailySalary.toFixed(2)),

      punch_records: record.punch_records || '',
      remarks: record.remarks || ''
    };
  }

  /**
   * Calculate complete month attendance sheet with summary statistics for an employee
   */
  static calculateEmployeeMonthSheet(emp, records, targetMonth) {
    const daysInMonth = this.getDaysInMonth(targetMonth || (records[0]?.attendance_date_iso));
    const { hourlyRate, dailyRate, baseSalary } = this.getEmployeeRates(emp, daysInMonth);

    // Calculate each daily record
    const dailyCalculations = records.map(r => this.calculateDayRecord(emp, r, daysInMonth));

    // Summary counts
    let presentDays = 0;
    let absentDays = 0;
    let weeklyOffDays = 0;
    let weeklyOffPresentDays = 0;
    let halfDays = 0;
    let lateDaysCount = 0;
    let earlyDaysCount = 0;

    let totalSchedWorkMins = 0;
    let totalActualWorkMins = 0;
    let totalActualBreakMins = 0;
    let totalWorkDiffMins = 0;
    let totalLateMins = 0;
    let totalEarlyMins = 0;
    let totalOvertimeMins = 0;

    let totalEarnedSalary = 0;
    let totalLateDeductions = 0;
    let totalOvertimePay = 0;
    let totalLeaveDeductions = 0;
    let totalPenalties = 0;
    let totalNetSalary = 0;

    dailyCalculations.forEach(day => {
      const code = day.status_code;
      if (code === 'P') presentDays++;
      else if (code === 'A') absentDays++;
      else if (code === 'WO') weeklyOffDays++;
      else if (code === 'WOP') weeklyOffPresentDays++;
      else if (code === 'HD') halfDays++;

      if (day.is_late) lateDaysCount++;
      if (day.is_early) earlyDaysCount++;

      totalSchedWorkMins += day.scheduled_work_minutes;
      totalActualWorkMins += day.actual_work_minutes;
      totalActualBreakMins += (day.actual_break_minutes || 0);
      totalWorkDiffMins += day.work_diff_minutes;
      totalLateMins += day.late_minutes;
      totalEarlyMins += day.early_minutes;
      totalOvertimeMins += day.overtime_minutes;

      totalEarnedSalary += day.daily_salary_earned;
      totalLateDeductions += day.late_salary_deduction;
      totalOvertimePay += day.overtime_pay;
      totalLeaveDeductions += day.leave_deduction;
      totalPenalties += day.penalty_amount;
      totalNetSalary += day.net_daily_salary;
    });

    const totalDaysRecorded = dailyCalculations.length;
    const workingDaysInMonth = Math.max(1, daysInMonth - weeklyOffDays);
    const effectivePresentDays = presentDays + weeklyOffPresentDays + (halfDays * 0.5);
    const attendancePercentage = workingDaysInMonth > 0
      ? Math.min(100, Math.round((effectivePresentDays / workingDaysInMonth) * 100))
      : 0;

    const summary = {
      calendarDays: daysInMonth,
      totalDaysRecorded,
      presentDays,
      absentDays,
      weeklyOffDays,
      weeklyOffPresentDays,
      halfDays,
      effectivePresentDays,
      workingDaysInMonth,
      attendancePercentage,
      lateDaysCount,
      earlyDaysCount,

      // Time Durations (in Hours & Minutes)
      totalExpectedWorkMinutes: totalSchedWorkMins,
      totalExpectedWorkFormatted: this.minutesToHHMM(totalSchedWorkMins),
      totalExpectedWorkHours: (totalSchedWorkMins / 60).toFixed(2),
      totalActualWorkMinutes: totalActualWorkMins,
      totalActualWorkFormatted: this.minutesToHHMM(totalActualWorkMins),
      totalActualWorkHours: (totalActualWorkMins / 60).toFixed(2),
      totalActualBreakMinutes: totalActualBreakMins,
      totalActualBreakFormatted: this.minutesToHHMM(totalActualBreakMins),
      totalActualBreakHours: (totalActualBreakMins / 60).toFixed(2),
      totalWorkDiffMinutes: totalWorkDiffMins,
      totalWorkDiffFormatted: this.minutesToHHMM(totalWorkDiffMins, true),
      totalWorkDiffHours: (totalWorkDiffMins / 60).toFixed(2),
      totalLateMinutes: totalLateMins,
      totalLateFormatted: this.minutesToHHMM(totalLateMins),
      totalLateHours: (totalLateMins / 60).toFixed(2),
      totalEarlyMinutes: totalEarlyMins,
      totalEarlyFormatted: this.minutesToHHMM(totalEarlyMins),
      totalEarlyHours: (totalEarlyMins / 60).toFixed(2),
      totalOvertimeMinutes: totalOvertimeMins,
      totalOvertimeFormatted: this.minutesToHHMM(totalOvertimeMins),
      totalOvertimeHours: (totalOvertimeMins / 60).toFixed(2),

      // Rates and Financials
      baseSalary: Number(baseSalary.toFixed(2)),
      hourlyRate: Number(hourlyRate.toFixed(2)),
      dailyRate: Number(dailyRate.toFixed(2)),
      grossEarnedSalary: Number(totalEarnedSalary.toFixed(2)),
      totalLateDeductions: Number(totalLateDeductions.toFixed(2)),
      totalOvertimePay: Number(totalOvertimePay.toFixed(2)),
      totalLeaveDeductions: Number(totalLeaveDeductions.toFixed(2)),
      totalPenalties: Number(totalPenalties.toFixed(2)),
      totalDeductions: Number((totalLateDeductions + totalLeaveDeductions + totalPenalties).toFixed(2)),
      netPayableSalary: Number(totalNetSalary.toFixed(2))
    };

    return {
      employee: {
        employee_code: emp.employee_code,
        employee_name: emp.employee_name,
        department: emp.department,
        designation: emp.designation,
        company: emp.company,
        location: emp.location,
        gender: emp.gender,
        doj: emp.doj,
        status: emp.status,
        salary: emp.salary,
        standard_in_time: emp.standard_in_time || '08:00',
        standard_out_time: emp.standard_out_time || '20:00',
        standard_break_minutes: emp.standard_break_minutes || 0,
        standard_work_hours: emp.standard_work_hours || 12.0,
        rate_type: emp.rate_type || 'hourly',
        hourly_rate: hourlyRate,
        daily_rate: dailyRate,
        payment_mode: emp.payment_mode || 'Bank',
        late_grace_minutes: emp.late_grace_minutes || 11,
        late_deduction_multiplier: emp.late_deduction_multiplier ?? 0.5,
        overtime_multiplier: emp.overtime_multiplier ?? 2.0,
        overtime_allowed: emp.overtime_allowed !== 0,
        min_overtime_minutes: emp.min_overtime_minutes || 0,
        min_overtime_deduction_minutes: emp.min_overtime_deduction_minutes || 0,
        special_rules: emp.special_rules || '',
        salary_history: emp.salary_history_json ? JSON.parse(emp.salary_history_json) : []
      },
      month: targetMonth,
      summary,
      dailyRecords: dailyCalculations
    };
  }
}

module.exports = CalculationEngine;
