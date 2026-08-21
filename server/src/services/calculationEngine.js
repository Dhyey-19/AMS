/**
 * AMS Dynamic Attendance & Salary Calculation Engine
 * 
 * Implements refined business rules:
 * 1) 4 Different Duration Calculations based on 11-minute threshold:
 *    - Normal: A.OUT - Scheduled IN
 *    - Both late: Scheduled OUT + 10 min - A.IN
 *    - Late IN only: A.OUT - A.IN
 *    - Late OUT only: Scheduled OUT + 10 min - Scheduled IN
 * 
 * 2) Salary Formulations:
 *    - PER DAY SALARY = SALARY PER MONTH / NO OF DAYS IN A MONTH
 *    - PER HOUR SALARY = PER DAY SALARY / ((OUT TIME - IN TIME) - BREAK HOURS)
 * 
 * 3) Break Hours:
 *    - Extracted from punch record column (Break Out, Break In)
 *    - IF (BREAKOUT - BREAKIN) <= MASTER.BREAKHOURS THEN MASTER.BREAKHOURS ELSE (BREAKOUT - BREAKIN)
 * 
 * 4) Special Rules:
 *    - Count Weekly Off (WO) Day Salary
 *    - FOR DOCTORS -> NO OVERTIME CALCULATIONS
 *    - Master Columns: WOP (Weekly Off Present), YPL (Yearly Paid Leave), Overtime Eligible
 */

class CalculationEngine {
  /**
   * Convert time string (e.g. "08:30", "18:00", "08:30:15") or Excel numeric fraction to minutes from midnight
   */
  static timeToMinutes(timeVal) {
    if (timeVal === null || timeVal === undefined || timeVal === '') return 0;
    
    if (typeof timeVal === 'number') {
      if (timeVal < 1) {
        // Excel day fraction: 0.3958333 * 1440 = 570 mins (9:30 AM)
        return Math.round(timeVal * 1440);
      }
      const strVal = timeVal.toFixed(2);
      const [hStr, mStr] = strVal.split('.');
      return (parseInt(hStr, 10) || 0) * 60 + (parseInt(mStr, 10) || 0);
    }

    const str = timeVal.toString().trim();
    if (!str || str.toLowerCase() === 'none' || str.toLowerCase() === 'false' || str.toLowerCase() === 'null') {
      return 0;
    }

    // Match HH:MM or HH.MM or HH:MM:SS with optional AM/PM
    const match = str.match(/^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(am|pm)?/i);
    if (match) {
      let h = parseInt(match[1], 10) || 0;
      const m = parseInt(match[2], 10) || 0;
      const meridiem = match[4] ? match[4].toLowerCase() : null;
      if (meridiem === 'pm' && h < 12) h += 12;
      if (meridiem === 'am' && h === 12) h = 0;
      return h * 60 + m;
    }

    const parts = str.split(/[:.]/);
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
      if (timeVal < 1) {
        const mins = Math.round(timeVal * 1440);
        const h = Math.floor(mins / 60) % 24;
        const m = mins % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
      const strVal = timeVal.toFixed(2);
      const [hStr, mStr] = strVal.split('.');
      return `${hStr.padStart(2, '0')}:${mStr.padStart(2, '0')}`;
    }
    const str = timeVal.toString().trim();
    if (!str || str.toLowerCase() === 'none' || str.toLowerCase() === 'false' || str.toLowerCase() === 'null') return '';
    const match = str.match(/^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(am|pm)?/i);
    if (match) {
      let h = parseInt(match[1], 10) || 0;
      const m = parseInt(match[2], 10) || 0;
      const meridiem = match[4] ? match[4].toLowerCase() : null;
      if (meridiem === 'pm' && h < 12) h += 12;
      if (meridiem === 'am' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
   * Parse Punch Records column to extract Break Out and Break In times
   * Format example: "08:04:17(in);14:05:54(out);15:05:57(in);19:58:43(out);"
   */
  static extractBreakPunches(punchRecords, explicitBreakOut = '', explicitBreakIn = '') {
    if (explicitBreakOut && explicitBreakIn) {
      const outMins = this.timeToMinutes(explicitBreakOut);
      const inMins = this.timeToMinutes(explicitBreakIn);
      const diff = Math.abs(inMins - outMins);
      return {
        breakOut: this.formatTimeString(explicitBreakOut),
        breakIn: this.formatTimeString(explicitBreakIn),
        totalBreakMins: diff
      };
    }

    if (!punchRecords || typeof punchRecords !== 'string') {
      return {
        breakOut: this.formatTimeString(explicitBreakOut),
        breakIn: this.formatTimeString(explicitBreakIn),
        totalBreakMins: 0
      };
    }

    // Match all timestamp events like 14:05:54(out) or 15:05:57(in)
    const regex = /(\d{1,2}:\d{2}(?::\d{2})?)\s*\((in|out)\)/gi;
    const punches = [];
    let match;
    while ((match = regex.exec(punchRecords)) !== null) {
      punches.push({
        time: match[1],
        type: match[2].toLowerCase(),
        mins: this.timeToMinutes(match[1])
      });
    }

    if (punches.length < 3) {
      // Not enough punches for an intermediate break
      return {
        breakOut: this.formatTimeString(explicitBreakOut),
        breakIn: this.formatTimeString(explicitBreakIn),
        totalBreakMins: 0
      };
    }

    // Punches: First is shift IN, last is shift OUT
    // Any (out) before last OUT is Break Out, followed by (in) which is Break In
    let firstBreakOut = '';
    let firstBreakIn = '';
    let totalBreakMins = 0;

    for (let i = 1; i < punches.length - 1; i++) {
      if (punches[i].type === 'out' && punches[i + 1] && punches[i + 1].type === 'in') {
        if (!firstBreakOut) {
          firstBreakOut = punches[i].time;
          firstBreakIn = punches[i + 1].time;
        }
        const bMins = Math.max(0, punches[i + 1].mins - punches[i].mins);
        totalBreakMins += bMins;
      }
    }

    return {
      breakOut: this.formatTimeString(firstBreakOut || explicitBreakOut),
      breakIn: this.formatTimeString(firstBreakIn || explicitBreakIn),
      totalBreakMins
    };
  }

  /**
   * Check if employee is a doctor (no overtime calculations for doctors)
   */
  static isDoctor(emp) {
    if (!emp) return false;
    const dept = (emp.department || '').toLowerCase();
    const desig = (emp.designation || '').toLowerCase();
    const name = (emp.employee_name || '').toLowerCase();
    return dept.includes('doctor') || desig.includes('doctor') || name.startsWith('dr.') || name.startsWith('dr ') || name.includes('dr.');
  }

  /**
   * Resolve effective employee parameters for a given date (With Effect From - W.E.F. Logic)
   * If the employee has multiple W.E.F. revisions in wef_history,
   * this finds the latest revision where effective_date <= dateIso.
   */
  static resolveEffectiveEmployee(emp, dateIso) {
    if (!emp) return emp;
    const history = Array.isArray(emp.wef_history) ? emp.wef_history : [];
    if (history.length === 0 || !dateIso) {
      return {
        ...emp,
        effective_wef_date: emp.wef_date || emp.doj || null,
        wef_remarks: ''
      };
    }

    // Sort by effective_date ascending
    const sorted = [...history].sort((a, b) => (a.effective_date || '').localeCompare(b.effective_date || ''));

    // Normalize dateIso to YYYY-MM-DD
    const targetDate = String(dateIso).slice(0, 10);

    // Find the latest revision whose effective_date <= targetDate
    let activeRevision = null;
    for (const rev of sorted) {
      if (rev.effective_date && rev.effective_date <= targetDate) {
        activeRevision = rev;
      }
    }

    // If no revision is <= targetDate (targetDate is before earliest revision), use the earliest revision
    if (!activeRevision && sorted.length > 0) {
      activeRevision = sorted[0];
    }

    if (!activeRevision) {
      return {
        ...emp,
        effective_wef_date: emp.wef_date || emp.doj || null,
        wef_remarks: ''
      };
    }

    return {
      ...emp,
      salary: activeRevision.salary !== null && activeRevision.salary !== undefined ? activeRevision.salary : emp.salary,
      incentive: activeRevision.incentive !== null && activeRevision.incentive !== undefined ? activeRevision.incentive : (emp.incentive || 0),
      standard_in_time: activeRevision.standard_in_time || emp.standard_in_time || '08:00',
      standard_out_time: activeRevision.standard_out_time || emp.standard_out_time || '20:00',
      standard_break_minutes: activeRevision.standard_break_minutes !== null && activeRevision.standard_break_minutes !== undefined ? activeRevision.standard_break_minutes : (emp.standard_break_minutes || 0),
      standard_work_hours: activeRevision.standard_work_hours !== null && activeRevision.standard_work_hours !== undefined ? activeRevision.standard_work_hours : (emp.standard_work_hours || 12.0),
      payment_mode: activeRevision.payment_mode || emp.payment_mode || 'Bank',
      late_grace_minutes: activeRevision.late_grace_minutes !== null && activeRevision.late_grace_minutes !== undefined ? activeRevision.late_grace_minutes : (emp.late_grace_minutes ?? 11),
      late_deduction_multiplier: activeRevision.late_deduction_multiplier !== null && activeRevision.late_deduction_multiplier !== undefined ? activeRevision.late_deduction_multiplier : (emp.late_deduction_multiplier ?? 0.5),
      overtime_multiplier: activeRevision.overtime_multiplier !== null && activeRevision.overtime_multiplier !== undefined ? activeRevision.overtime_multiplier : (emp.overtime_multiplier ?? 2.0),
      overtime_allowed: activeRevision.overtime_allowed !== null && activeRevision.overtime_allowed !== undefined ? activeRevision.overtime_allowed : (emp.overtime_allowed ?? 1),
      min_overtime_minutes: activeRevision.min_overtime_minutes !== null && activeRevision.min_overtime_minutes !== undefined ? activeRevision.min_overtime_minutes : (emp.min_overtime_minutes || 0),
      min_overtime_deduction_minutes: activeRevision.min_overtime_deduction_minutes !== null && activeRevision.min_overtime_deduction_minutes !== undefined ? activeRevision.min_overtime_deduction_minutes : (emp.min_overtime_deduction_minutes || 0),
      special_rules: activeRevision.special_rules !== null && activeRevision.special_rules !== undefined ? activeRevision.special_rules : emp.special_rules,
      effective_wef_date: activeRevision.effective_date || emp.wef_date || null,
      wef_remarks: activeRevision.remarks || ''
    };
  }

  /**
   * Compute dynamic hourly and daily rates for an employee:
   * 1) PER DAY SALARY = SALARY PER MONTH / NO OF DAYS IN A MONTH
   * 2) PER HOUR SALARY = PER DAY SALARY / STANDARD WORKING HOURS FROM MASTER
   */
  static getEmployeeRates(emp, daysInMonth = 30) {
    const baseSalary = parseFloat(emp.salary) || 0;
    
    // Standard daily working hours from Master
    let stdDailyWorkHours = 0;
    if (emp.standard_work_hours !== undefined && emp.standard_work_hours !== null && emp.standard_work_hours !== '') {
      if (typeof emp.standard_work_hours === 'string' && emp.standard_work_hours.includes(':')) {
        const parts = emp.standard_work_hours.split(':').map(Number);
        stdDailyWorkHours = (parts[0] || 0) + (parts[1] || 0) / 60;
      } else {
        stdDailyWorkHours = parseFloat(emp.standard_work_hours) || 0;
      }
    }
    
    // Fallback: If not specified in master, calculate from (Out - In - Break)
    if (stdDailyWorkHours <= 0) {
      const stdInMins = this.timeToMinutes(emp.standard_in_time || '08:00');
      const stdOutMins = this.timeToMinutes(emp.standard_out_time || '20:00');
      const stdBreakMins = parseInt(emp.standard_break_minutes, 10) || 0;
      let schedDurationMins = stdOutMins >= stdInMins ? (stdOutMins - stdInMins) : (1440 - stdInMins + stdOutMins);
      let schedWorkMins = Math.max(0, schedDurationMins - stdBreakMins);
      stdDailyWorkHours = schedWorkMins > 0 ? (schedWorkMins / 60) : 12.0;
    }
    if (stdDailyWorkHours <= 0) stdDailyWorkHours = 12.0;

    const numDays = daysInMonth > 0 ? daysInMonth : 30;

    // 1) PER HOUR SALARY = (Monthly Salary / Days in Month) / Standard Daily Work Hours
    let hourlyRate = 0;
    if (baseSalary > 0 && numDays > 0 && stdDailyWorkHours > 0) {
      hourlyRate = (baseSalary / numDays) / stdDailyWorkHours;
    }

    // 2) DAILY RATE = Hourly Rate * Standard Daily Work Hours
    let dailyRate = 0;
    if (hourlyRate > 0) {
      dailyRate = Number(hourlyRate.toFixed(2)) * stdDailyWorkHours;
    }

    return {
      hourlyRate: Number(hourlyRate.toFixed(2)),
      dailyRate: Number(dailyRate.toFixed(2)),
      baseSalary,
      daysInMonth: numDays,
      schedDailyWorkHours: Number(stdDailyWorkHours.toFixed(4))
    };
  }

  /**
   * Calculate a single day's attendance record with all 4 duration rules, break rules & salary
   * Dynamically resolves effective employee parameters for this exact date (W.E.F. resolution).
   */
  static calculateDayRecord(emp, record, daysInMonth = 30) {
    const effectiveEmp = this.resolveEffectiveEmployee(emp, record.attendance_date_iso || record.attendance_date);
    const { hourlyRate, dailyRate, baseSalary, schedDailyWorkHours } = this.getEmployeeRates(effectiveEmp, daysInMonth);

    // Standard Shift parameters from Employee Master (Effective on this date)
    const stdInTimeStr = effectiveEmp.standard_in_time || '08:00';
    const stdOutTimeStr = effectiveEmp.standard_out_time || '20:00';
    const stdBreakMins = parseInt(effectiveEmp.standard_break_minutes, 10) || 0;
    const stdWorkHours = schedDailyWorkHours;
    const lateGraceMins = parseInt(effectiveEmp.late_grace_minutes, 10) || 11;
    const lateMultiplier = !isNaN(parseFloat(effectiveEmp.late_deduction_multiplier)) ? parseFloat(effectiveEmp.late_deduction_multiplier) : 0.5;
    const overtimeMultiplier = !isNaN(parseFloat(effectiveEmp.overtime_multiplier)) ? parseFloat(effectiveEmp.overtime_multiplier) : 2.0;
    
    // Doctor rule: FOR DOCTORS -> NO OVERTIME CALCULATIONS
    const isDoc = this.isDoctor(effectiveEmp);
    const overtimeAllowed = !isDoc && (effectiveEmp.overtime_allowed !== 0 && effectiveEmp.overtime_allowed !== false && effectiveEmp.overtime_allowed !== '0');
    
    const minOvertimeMins = parseInt(effectiveEmp.min_overtime_minutes, 10) || 0;
    const minOvertimeDeductionMins = parseInt(effectiveEmp.min_overtime_deduction_minutes, 10) || 0;

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
    const statusCode = (record.status_code || 'A').toUpperCase().trim();

    const actualInMins = this.timeToMinutes(rawInTime);
    const actualOutMins = this.timeToMinutes(rawOutTime);

    // 3) Break Punches: TAKE BREAK IN - BREAK OUT FROM PUNCH RECORD COLUMN
    const { breakOut, breakIn, totalBreakMins } = this.extractBreakPunches(
      record.punch_records,
      record.break_out,
      record.break_in
    );

    const actualBreakMins = totalBreakMins;

    // FORMULA FOR EFF BREAK:
    // EFF BREAK = BREAK IN - BREAK OUT (Punched Break Duration)
    const effectiveBreakMins = actualBreakMins;

    // 1) 4 Different Duration Calculations using 11-Minute Threshold and 10-Minute Late OUT Capping:
    // EXCEL FORMULA: =IF((H3*1440)>=((C3*1440)+11),IF((I3*1440)>=((D3*1440)+11),((D3+TIME(0,10,0))-H3),I3-H3),IF((I3*1440)>=((D3*1440)+11),((D3+TIME(0,10,0))-C3),I3-C3))
    // - Late IN condition: Actual IN (H3) >= Scheduled IN (C3) + 11 min
    // - Late OUT condition: Actual OUT (I3) >= Scheduled OUT (D3) + 11 min
    let isLateIn = false;
    let isLateOut = false;
    let calcMode = 'Normal';
    let rawDurationMins = 0;

    if (actualInMins > 0 && stdInMins > 0) {
      isLateIn = (actualInMins - stdInMins) >= 11;
    }
    if (actualOutMins > 0 && stdOutMins > 0) {
      isLateOut = (actualOutMins - stdOutMins) >= 11;
    }

    if (actualInMins > 0 && actualOutMins > 0) {
      if (isLateIn) {
        if (isLateOut) {
          // Branch 1: Both late -> (Scheduled OUT + 10m) - Actual IN
          calcMode = 'Both late';
          rawDurationMins = Math.max(0, (stdOutMins + 10) - actualInMins);
        } else {
          // Branch 2: Late IN only -> Actual OUT - Actual IN
          calcMode = 'Late IN only';
          rawDurationMins = Math.max(0, actualOutMins - actualInMins);
        }
      } else {
        if (isLateOut) {
          // Branch 3: Late OUT only -> (Scheduled OUT + 10m) - Scheduled IN
          calcMode = 'Late OUT only';
          rawDurationMins = Math.max(0, (stdOutMins + 10) - stdInMins);
        } else {
          // Branch 4: Normal -> Actual OUT - Scheduled IN
          calcMode = 'Normal';
          rawDurationMins = Math.max(0, actualOutMins - stdInMins);
        }
      }
    } else if (actualInMins > 0 && actualOutMins === 0) {
      rawDurationMins = 0;
    }

    // FORMULA FOR ACTUAL WORK:
    // IF (STD BREAK <= EFF. BREAK) THEN DURATION - EFF. BREAK ELSE DURATION - STD BREAK
    const breakDeductionMins = (stdBreakMins <= effectiveBreakMins) ? effectiveBreakMins : stdBreakMins;

    let actualWorkMins = 0;
    if (rawDurationMins > 0) {
      actualWorkMins = Math.max(0, rawDurationMins - breakDeductionMins);
    } else if (actualInMins > 0 && actualOutMins > 0) {
      actualWorkMins = Math.max(0, (actualOutMins - actualInMins) - breakDeductionMins);
    } else {
      if (statusCode === 'P' || statusCode === 'WOP') {
        actualWorkMins = schedWorkMins;
      } else if (statusCode === 'HD') {
        actualWorkMins = Math.round(schedWorkMins / 2);
      } else {
        actualWorkMins = 0;
      }
    }

    if (actualInMins === 0 && actualOutMins === 0) {
      if (statusCode === 'WO') calcMode = 'Weekly Off';
      else if (statusCode === 'HD') calcMode = 'Half Day';
      else if (statusCode === 'A') calcMode = 'Absent';
      else if (statusCode === 'L') calcMode = 'Leave';
    }

    // Overtime Calculation (Strictly disabled for Doctors)
    // Rule: If actual work >= target + min OT from master, then Overtime = actual work - target, else 0
    let overtimeMins = 0;

    if (overtimeAllowed && (statusCode === 'P' || statusCode === 'HD' || statusCode === 'WOP' || statusCode === 'WO')) {
      if (record.overtime_override_minutes && record.overtime_override_minutes > 0) {
        // Manual override from admin
        overtimeMins = record.overtime_override_minutes;
      } else if (statusCode === 'WO') {
        // If employee worked on Weekly Off: target is 0, qualify if actualWorkMins >= minOvertimeMins
        if (actualWorkMins > 0) {
          if (actualWorkMins >= minOvertimeMins) {
            overtimeMins = Math.max(0, actualWorkMins - (minOvertimeDeductionMins > 0 ? minOvertimeDeductionMins : 15));
          } else {
            overtimeMins = 0;
          }
        }
      } else {
        // Standard Duty Days (P, WOP, HD):
        // If actual work >= target + min OT from master then only calculate overtime (actual work - target), else 0
        const requiredThreshold = schedWorkMins + minOvertimeMins;
        if (actualWorkMins >= requiredThreshold && actualWorkMins > schedWorkMins) {
          overtimeMins = actualWorkMins - schedWorkMins;
        } else {
          overtimeMins = 0;
        }
      }
    }

    // Work Hour Difference (+/-)
    let workDiffMins = 0;
    if (actualWorkMins > 0) {
      workDiffMins = actualWorkMins - schedWorkMins;
    } else if (statusCode === 'WO') {
      workDiffMins = 0;
    } else {
      workDiffMins = -schedWorkMins;
    }

    // Late Arrival Minutes
    let lateMins = 0;
    if ((statusCode === 'P' || statusCode === 'HD') && actualInMins > 0 && stdInMins > 0) {
      const diffIn = actualInMins - stdInMins;
      if (diffIn >= 11) {
        lateMins = diffIn;
      }
    }

    // Early Departure Minutes
    let earlyMins = 0;
    if ((statusCode === 'P' || statusCode === 'HD') && actualOutMins > 0 && stdOutMins > 0) {
      const diffOut = stdOutMins - actualOutMins;
      if (diffOut >= 11) {
        earlyMins = diffOut;
      }
    }

    // Financial calculations for the day (all based strictly on hourly rate * hours)
    let dailySalaryEarned = 0;
    if (statusCode === 'WO') {
      // NOTE 1: COUNT WEEKLY OFF DAY SALARY -> If worked, calculate based on actual hours, otherwise standard scheduled hours
      if (actualWorkMins > 0) {
        dailySalaryEarned = (actualWorkMins / 60) * hourlyRate;
      } else {
        dailySalaryEarned = schedDailyWorkHours * hourlyRate;
      }
    } else if (statusCode === 'P' || statusCode === 'WOP') {
      if (actualWorkMins > 0) {
        dailySalaryEarned = (actualWorkMins / 60) * hourlyRate;
      } else {
        dailySalaryEarned = schedDailyWorkHours * hourlyRate;
      }
    } else if (statusCode === 'HD') {
      dailySalaryEarned = (schedDailyWorkHours * 0.5) * hourlyRate;
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
      break_out: breakOut,
      break_in: breakIn,
      actual_break_minutes: actualBreakMins,
      actual_break_formatted: this.minutesToHHMM(actualBreakMins),
      effective_break_minutes: effectiveBreakMins,
      effective_break_formatted: this.minutesToHHMM(effectiveBreakMins),
      
      // 4-Case Calculation Result
      calc_mode: calcMode,
      actual_duration_minutes: rawDurationMins,
      actual_duration_formatted: this.minutesToHHMM(rawDurationMins),
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
      is_doctor: isDoc,
      overtime_allowed: overtimeAllowed,

      // Rates and Salary breakdown
      hourly_rate: Number(hourlyRate.toFixed(2)),
      daily_rate: Number(dailyRate.toFixed(2)),
      daily_salary_earned: Number(dailySalaryEarned.toFixed(2)),
      late_salary_deduction: Number(lateSalaryDeduction.toFixed(2)),
      overtime_pay: Number(overtimePay.toFixed(2)),
      leave_deduction: Number(leaveDeduction.toFixed(2)),
      penalty_amount: Number(penaltyAmount.toFixed(2)),
      net_daily_salary: Number(netDailySalary.toFixed(2)),

      // W.E.F. Effective Date & Config Reference
      wef_date: effectiveEmp.effective_wef_date || null,
      effective_salary: baseSalary,

      punch_records: record.punch_records || '',
      remarks: record.remarks || ''
    };
  }

  /**
   * Calculate complete month attendance sheet with summary statistics for an employee
   */
  static calculateEmployeeMonthSheet(emp, records, targetMonth) {
    const daysInMonth = this.getDaysInMonth(targetMonth || (records[0]?.attendance_date_iso));
    const { hourlyRate, dailyRate, baseSalary, schedDailyWorkHours } = this.getEmployeeRates(emp, daysInMonth);

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

    const isDoc = this.isDoctor(emp);

    // Multi-W.E.F. Detection (Mid-month rate/timing changes)
    const uniqueWefDates = Array.from(new Set(dailyCalculations.map(d => d.wef_date).filter(Boolean)));
    const isMultiWefMonth = uniqueWefDates.length > 1;

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

      // W.E.F. Multi-Period Flags
      isMultiWefMonth,
      wefDatesUsed: uniqueWefDates,

      // Master fields included in summary
      wopDays: parseFloat(emp.wop) || weeklyOffPresentDays,
      yplDays: parseFloat(emp.ypl) || 0,
      overtimeAllowed: !isDoc && (emp.overtime_allowed !== 0 && emp.overtime_allowed !== false && emp.overtime_allowed !== '0'),
      isDoctor: isDoc,

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
      schedDailyWorkHours,
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
        incentive: parseFloat(emp.incentive) || 0,
        wef_date: emp.wef_date || null,
        standard_in_time: emp.standard_in_time || '08:00',
        standard_out_time: emp.standard_out_time || '20:00',
        standard_break_minutes: emp.standard_break_minutes || 0,
        standard_work_hours: emp.standard_work_hours || 12.0,
        hourly_rate: hourlyRate,
        daily_rate: dailyRate,
        wop: parseFloat(emp.wop) || 0,
        ypl: parseFloat(emp.ypl) || 0,
        payment_mode: emp.payment_mode || 'Bank',
        late_grace_minutes: emp.late_grace_minutes || 11,
        late_deduction_multiplier: emp.late_deduction_multiplier ?? 0.5,
        overtime_multiplier: emp.overtime_multiplier ?? 2.0,
        overtime_allowed: !isDoc && (emp.overtime_allowed !== 0 && emp.overtime_allowed !== false && emp.overtime_allowed !== '0'),
        is_doctor: isDoc,
        min_overtime_minutes: emp.min_overtime_minutes || 0,
        min_overtime_deduction_minutes: emp.min_overtime_deduction_minutes || 0,
        special_rules: emp.special_rules || '',
        salary_history: emp.salary_history_json ? JSON.parse(emp.salary_history_json) : [],
        wef_history: Array.isArray(emp.wef_history) ? emp.wef_history : []
      },
      month: targetMonth,
      summary,
      dailyRecords: dailyCalculations
    };
  }
}

module.exports = CalculationEngine;
