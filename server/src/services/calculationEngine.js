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
   * Parse Punch Records column to extract:
   * - actualIn: First punch of the day
   * - actualOut: Last punch of the day (whether tagged as (in) or (out))
   * - breakOut: First break departure
   * - breakIn: First break return
   * - totalBreakMins: Sum of intermediate break durations
   */
  static extractBreakPunches(punchRecords, explicitBreakOut = '', explicitBreakIn = '', explicitIn = '', explicitOut = '') {
    let actualIn = this.formatTimeString(explicitIn);
    let actualOut = this.formatTimeString(explicitOut);
    let firstBreakOut = this.formatTimeString(explicitBreakOut);
    let firstBreakIn = this.formatTimeString(explicitBreakIn);
    let totalBreakMins = 0;

    if (firstBreakOut && firstBreakIn) {
      const outMins = this.timeToMinutes(firstBreakOut);
      const inMins = this.timeToMinutes(firstBreakIn);
      totalBreakMins = Math.max(0, inMins - outMins);
    }

    if (!punchRecords || typeof punchRecords !== 'string' || !punchRecords.trim()) {
      return {
        actualIn,
        actualOut,
        breakOut: firstBreakOut,
        breakIn: firstBreakIn,
        totalBreakMins
      };
    }

    // Match all timestamp events like 14:05:54(out) or 15:05:57(in) or 14:05:54
    const regex = /(\d{1,2}:\d{2}(?::\d{2})?)(?:\s*\((in|out)\))?/gi;
    const punches = [];
    let match;
    while ((match = regex.exec(punchRecords)) !== null) {
      punches.push({
        time: this.formatTimeString(match[1]),
        rawTime: match[1],
        tag: match[2] ? match[2].toLowerCase() : '',
        mins: this.timeToMinutes(match[1])
      });
    }

    if (punches.length > 0) {
      // 1) First punch is Actual IN if not explicitly provided
      if (!actualIn) {
        actualIn = punches[0].time;
      }

      // 2) If 2 or more punches, LAST punch is Actual OUT if not explicitly provided or if later than actualOut
      if (punches.length >= 2) {
        const lastPunch = punches[punches.length - 1];
        if (!actualOut || lastPunch.mins > this.timeToMinutes(actualOut)) {
          actualOut = lastPunch.time;
        }
      }
    }

    // 3) Intermediate Break punches (strictly between first punch 0 and last punch n-1)
    // Punches available for breaks are from index 1 to index punches.length - 2
    if (punches.length >= 4) {
      let calculatedBreakMins = 0;
      let detectedBreakOut = punches[1].time;
      let detectedBreakIn = punches[2].time;

      for (let i = 1; i + 1 <= punches.length - 2; i += 2) {
        const bMins = Math.max(0, punches[i + 1].mins - punches[i].mins);
        if (punches[i + 1].mins >= punches[i].mins) {
          calculatedBreakMins += bMins;
        }
      }

      if (!firstBreakOut && detectedBreakOut) firstBreakOut = detectedBreakOut;
      if (!firstBreakIn && detectedBreakIn) firstBreakIn = detectedBreakIn;

      if (totalBreakMins === 0 && calculatedBreakMins > 0) {
        totalBreakMins = calculatedBreakMins;
      } else if (totalBreakMins === 0 && firstBreakOut && firstBreakIn) {
        const outM = this.timeToMinutes(firstBreakOut);
        const inM = this.timeToMinutes(firstBreakIn);
        totalBreakMins = Math.max(0, inM - outM);
      }
    } else if (punches.length === 3) {
      if (!firstBreakOut) firstBreakOut = punches[1].time;
      if (!firstBreakIn) firstBreakIn = punches[2].time;
      if (totalBreakMins === 0 && firstBreakOut && firstBreakIn) {
        const outM = this.timeToMinutes(firstBreakOut);
        const inM = this.timeToMinutes(firstBreakIn);
        totalBreakMins = Math.max(0, inM - outM);
      }
    }

    // Ensure totalBreakMins does not deduct time outside the actual [actualIn, actualOut] window
    if (actualIn && actualOut && totalBreakMins > 0 && firstBreakOut && firstBreakIn) {
      const inM = this.timeToMinutes(actualIn);
      const outM = this.timeToMinutes(actualOut);
      const bOutM = this.timeToMinutes(firstBreakOut);
      const bInM = this.timeToMinutes(firstBreakIn);
      const overlapMins = Math.max(0, Math.min(bInM, outM) - Math.max(bOutM, inM));
      totalBreakMins = Math.min(totalBreakMins, overlapMins);
    }

    return {
      actualIn,
      actualOut,
      breakOut: firstBreakOut,
      breakIn: firstBreakIn,
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
        wef_remarks: '',
        wop: emp.wop !== null && emp.wop !== undefined ? emp.wop : 0,
        weekly_off_days: emp.weekly_off_days || 'Sunday'
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
      wop_work_hours: activeRevision.wop_work_hours !== null && activeRevision.wop_work_hours !== undefined ? activeRevision.wop_work_hours : (emp.wop_work_hours || null),
      payment_mode: activeRevision.payment_mode || emp.payment_mode || 'Bank',
      late_grace_minutes: activeRevision.late_grace_minutes !== null && activeRevision.late_grace_minutes !== undefined ? activeRevision.late_grace_minutes : (emp.late_grace_minutes ?? 11),
      late_deduction_multiplier: activeRevision.late_deduction_multiplier !== null && activeRevision.late_deduction_multiplier !== undefined ? activeRevision.late_deduction_multiplier : (emp.late_deduction_multiplier ?? 1.5),
      overtime_multiplier: activeRevision.overtime_multiplier !== null && activeRevision.overtime_multiplier !== undefined ? activeRevision.overtime_multiplier : (emp.overtime_multiplier ?? 2.0),
      overtime_allowed: activeRevision.overtime_allowed !== null && activeRevision.overtime_allowed !== undefined ? activeRevision.overtime_allowed : (emp.overtime_allowed ?? 1),
      min_overtime_minutes: activeRevision.min_overtime_minutes !== null && activeRevision.min_overtime_minutes !== undefined ? activeRevision.min_overtime_minutes : (emp.min_overtime_minutes || 0),
      min_overtime_deduction_minutes: activeRevision.min_overtime_deduction_minutes !== null && activeRevision.min_overtime_deduction_minutes !== undefined ? activeRevision.min_overtime_deduction_minutes : (emp.min_overtime_deduction_minutes || 0),
      special_rules: activeRevision.special_rules !== null && activeRevision.special_rules !== undefined ? activeRevision.special_rules : emp.special_rules,
      effective_wef_date: activeRevision.effective_date || emp.wef_date || null,
      wef_remarks: activeRevision.remarks || '',
      wop: activeRevision.wop !== null && activeRevision.wop !== undefined ? activeRevision.wop : (emp.wop || 0),
      weekly_off_days: activeRevision.weekly_off_days || emp.weekly_off_days || 'Sunday',
      is_fixed_per_day_salary: activeRevision.is_fixed_per_day_salary !== null && activeRevision.is_fixed_per_day_salary !== undefined 
        ? (activeRevision.is_fixed_per_day_salary ? 1 : 0) 
        : (emp.is_fixed_per_day_salary ? 1 : 0),
      salary_basis: activeRevision.salary_basis || emp.salary_basis || 'Monthly'
    };
  }

  /**
   * Determine if a date falls on an employee's configured Weekly Off / Holiday days
   * Supports: 'Sunday' (default), 'Saturday, Sunday' / 'Saturday & Sunday', etc.
   */
  static isWeeklyOff(emp, dateStrOrObj) {
    if (!dateStrOrObj) return false;
    let dateObj;
    if (typeof dateStrOrObj === 'string') {
      const cleanDate = dateStrOrObj.slice(0, 10);
      dateObj = new Date(cleanDate + 'T00:00:00');
    } else {
      dateObj = dateStrOrObj;
    }
    if (isNaN(dateObj.getTime())) return false;

    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDayName = dayNames[dayOfWeek];

    const rawWeeklyOff = (emp?.weekly_off_days || emp?.weekly_off || 'Sunday').toLowerCase();
    return rawWeeklyOff.includes(currentDayName);
  }

  /**
   * Compute dynamic hourly and daily rates for an employee:
   * 1) Standard: PER DAY SALARY = SALARY PER MONTH / NO OF DAYS IN A MONTH
   *    PER HOUR SALARY = PER DAY SALARY / STANDARD WORKING HOURS FROM MASTER
   * 2) Fixed Per Day Salary with Daily Basis: PER DAY SALARY = SALARY (entered daily rate)
   */
  static getEmployeeRates(emp, daysInMonth = 30) {
    const baseSalary = parseFloat(emp.salary) || 0;
    const isFixedPerDay = Boolean(emp.is_fixed_per_day_salary === 1 || emp.is_fixed_per_day_salary === '1' || emp.is_fixed_per_day_salary === true);
    const salaryBasis = (emp.salary_basis || 'Monthly').toLowerCase();
    
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

    let hourlyRate = 0;
    let dailyRate = 0;

    if (isFixedPerDay && salaryBasis === 'daily' && baseSalary > 0) {
      dailyRate = baseSalary;
      hourlyRate = stdDailyWorkHours > 0 ? (dailyRate / stdDailyWorkHours) : 0;
    } else {
      // 1) PER HOUR SALARY = (Monthly Salary / Days in Month) / Standard Daily Work Hours
      if (baseSalary > 0 && numDays > 0 && stdDailyWorkHours > 0) {
        hourlyRate = (baseSalary / numDays) / stdDailyWorkHours;
      }

      // 2) DAILY RATE = Hourly Rate * Standard Daily Work Hours
      if (hourlyRate > 0) {
        dailyRate = Number(hourlyRate.toFixed(2)) * stdDailyWorkHours;
      }
    }

    return {
      hourlyRate: Number(hourlyRate.toFixed(2)),
      dailyRate: Number(dailyRate.toFixed(2)),
      baseSalary,
      daysInMonth: numDays,
      schedDailyWorkHours: Number(stdDailyWorkHours.toFixed(4)),
      isFixedPerDay
    };
  }

  /**
   * Calculate a single day's attendance record with all 4 duration rules, break rules & salary
   * Dynamically resolves effective employee parameters for this exact date (W.E.F. resolution).
   */
  static calculateDayRecord(emp, record, daysInMonth = 30) {
    const effectiveEmp = this.resolveEffectiveEmployee(emp, record.attendance_date_iso || record.attendance_date);
    const { hourlyRate, dailyRate, baseSalary, schedDailyWorkHours } = this.getEmployeeRates(effectiveEmp, daysInMonth);

    const isManual = record.is_manual === 1 || record.is_manual === '1' || record.is_manual === true;
    let manual = {};
    if (record.manual_data) {
      try {
        manual = typeof record.manual_data === 'string' ? JSON.parse(record.manual_data) : record.manual_data;
      } catch (e) {
        manual = {};
      }
    }

    // Standard Shift parameters from Employee Master or manual shift override
    const stdInTimeStr = manual.scheduled_in_time || record.scheduled_in_time || effectiveEmp.standard_in_time || '08:00';
    const stdOutTimeStr = manual.scheduled_out_time || record.scheduled_out_time || effectiveEmp.standard_out_time || '20:00';
    const stdBreakMins = manual.scheduled_break_formatted !== undefined 
      ? this.timeToMinutes(manual.scheduled_break_formatted) 
      : (record.scheduled_break !== undefined ? parseInt(record.scheduled_break, 10) : (parseInt(effectiveEmp.standard_break_minutes, 10) || 0));
    const stdWorkHours = schedDailyWorkHours;
    const lateGraceMins = parseInt(effectiveEmp.late_grace_minutes, 10) || 11;
    const lateMultiplier = !isNaN(parseFloat(effectiveEmp.late_deduction_multiplier)) ? parseFloat(effectiveEmp.late_deduction_multiplier) : 1.5;
    const overtimeMultiplier = !isNaN(parseFloat(effectiveEmp.overtime_multiplier)) ? parseFloat(effectiveEmp.overtime_multiplier) : 2.0;
    
    // Effective Rates (allow manual hourly_rate / daily_rate override)
    let effHourlyRate = hourlyRate;
    let effDailyRate = dailyRate;
    if (manual.hourly_rate !== undefined && manual.hourly_rate !== '' && !isNaN(parseFloat(manual.hourly_rate))) {
      effHourlyRate = parseFloat(manual.hourly_rate);
    } else if (record.hourly_rate !== undefined && record.hourly_rate !== null && record.hourly_rate !== '' && !isNaN(parseFloat(record.hourly_rate))) {
      effHourlyRate = parseFloat(record.hourly_rate);
    }
    if (manual.daily_rate !== undefined && manual.daily_rate !== '' && !isNaN(parseFloat(manual.daily_rate))) {
      effDailyRate = parseFloat(manual.daily_rate);
    }

    // Overtime & Salary Configuration from Employee Master
    const isDoc = this.isDoctor(effectiveEmp);
    const overtimeAllowed = (effectiveEmp.overtime_allowed !== 0 && effectiveEmp.overtime_allowed !== false && effectiveEmp.overtime_allowed !== '0');
    const isFixedPerDay = Boolean(effectiveEmp.is_fixed_per_day_salary === 1 || effectiveEmp.is_fixed_per_day_salary === '1' || effectiveEmp.is_fixed_per_day_salary === true);
    
    const minOvertimeMins = parseInt(effectiveEmp.min_overtime_minutes, 10) || 0;
    const minOvertimeDeductionMins = parseInt(effectiveEmp.min_overtime_deduction_minutes, 10) || 0;

    const stdInMins = this.timeToMinutes(stdInTimeStr);
    const stdOutMins = this.timeToMinutes(stdOutTimeStr);
    let schedDurMins = stdOutMins > stdInMins ? stdOutMins - stdInMins : 0;

    const rawInTime = manual.in_time !== undefined ? manual.in_time : (manual.actual_in_time !== undefined ? manual.actual_in_time : (record.in_time || ''));
    const rawOutTime = manual.out_time !== undefined ? manual.out_time : (manual.actual_out_time !== undefined ? manual.actual_out_time : (record.out_time || ''));
    const rawBreakOut = manual.break_out !== undefined ? manual.break_out : (record.break_out || '');
    const rawBreakIn = manual.break_in !== undefined ? manual.break_in : (record.break_in || '');
    let statusCode = (manual.status_code || record.status_code || '').toUpperCase().trim();

    const isEmpWeeklyOff = this.isWeeklyOff(effectiveEmp, record.attendance_date_iso || record.attendance_date);

    // If status code is not explicitly set, or raw import marked 'A' on an unworked weekly off day:
    if (!statusCode) {
      if (isEmpWeeklyOff) {
        statusCode = 'WO';
      } else if (rawInTime && rawInTime !== '00:00') {
        statusCode = 'P';
      } else {
        statusCode = 'A';
      }
    } else if (statusCode === 'A' && isEmpWeeklyOff && !rawInTime && !manual.status_code) {
      // Unworked designated weekly off (e.g. Saturday or Sunday)
      statusCode = 'WO';
    }

    // Target Scheduled Work Hours:
    // Regular days (P, HD, etc.) -> stdWorkHours
    // WOP (Weekly Off Present) -> If effectiveEmp.wop_work_hours is configured, use wop_work_hours!
    let targetWorkHours = stdWorkHours;
    if (statusCode === 'WOP' && effectiveEmp.wop_work_hours !== null && effectiveEmp.wop_work_hours !== undefined && effectiveEmp.wop_work_hours !== '') {
      if (typeof effectiveEmp.wop_work_hours === 'string' && effectiveEmp.wop_work_hours.includes(':')) {
        const parts = effectiveEmp.wop_work_hours.split(':').map(Number);
        targetWorkHours = (parts[0] || 0) + (parts[1] || 0) / 60;
      } else {
        const parsed = parseFloat(effectiveEmp.wop_work_hours);
        if (!isNaN(parsed) && parsed > 0) {
          targetWorkHours = parsed;
        }
      }
    } else if (manual.scheduled_work_formatted) {
      const parsedM = this.timeToMinutes(manual.scheduled_work_formatted);
      if (parsedM > 0) targetWorkHours = parsedM / 60;
    }

    let schedWorkMins = Math.round(targetWorkHours * 60);
    if (schedWorkMins === 0 && statusCode !== 'WOP') {
      schedWorkMins = Math.max(0, schedDurMins - stdBreakMins);
    }

    // 3) Punch Records & Break Extraction:
    // First punch is Actual IN, LAST punch is Actual OUT (whether machine marked (in) or (out))
    const { actualIn, actualOut, breakOut, breakIn, totalBreakMins } = this.extractBreakPunches(
      manual.punch_records !== undefined ? manual.punch_records : record.punch_records,
      rawBreakOut,
      rawBreakIn,
      rawInTime,
      rawOutTime
    );

    const actualInTimeStr = actualIn || this.formatTimeString(rawInTime);
    const actualOutTimeStr = actualOut || this.formatTimeString(rawOutTime);

    const actualInMins = this.timeToMinutes(actualInTimeStr);
    const actualOutMins = this.timeToMinutes(actualOutTimeStr);

    const actualBreakMins = totalBreakMins;

    // FORMULA FOR EFF BREAK & BREAK DEDUCTION:
    // Rule:
    // 1) If standard break is 00:00 (stdBreakMins === 0):
    //    - If actual break <= 30 min: allow up to 30 min free break, no deduction from actual working hours (0)
    //    - If actual break > 30 min: deduct whole minutes (full actualBreakMins) from actual working hours
    // 2) If standard break > 0 (e.g. 60 min):
    //    - If actual break <= master break: master break is deducted
    //    - If actual break > master break: actual break is deducted
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

    // 1) Punch Deviations from Master Shift:
    let lateInMins = 0;
    let earlyInMins = 0;
    if (actualInMins > 0 && stdInMins > 0) {
      if (actualInMins > stdInMins) {
        lateInMins = actualInMins - stdInMins;
      } else if (actualInMins < stdInMins) {
        earlyInMins = stdInMins - actualInMins;
      }
    }

    let lateOutMins = 0;
    let earlyOutMins = 0;
    if (actualOutMins > 0 && stdOutMins > 0) {
      if (actualOutMins > stdOutMins) {
        lateOutMins = actualOutMins - stdOutMins;
      } else if (actualOutMins < stdOutMins) {
        earlyOutMins = stdOutMins - actualOutMins;
      }
    }

    // 2) Duration & Mode Calculations:
    let isLateIn = lateInMins > 10;
    let isLateOut = lateOutMins > 10;
    let calcMode = 'Normal';
    let rawDurationMins = 0;

    if (actualInMins > 0 && actualOutMins > 0) {
      if (isLateIn && isLateOut) {
        calcMode = 'Both late';
      } else if (isLateIn) {
        calcMode = 'Late IN only';
      } else if (isLateOut) {
        calcMode = 'Late OUT only';
      } else {
        calcMode = 'Normal';
      }

      // Gross Duration = Actual OUT - Actual IN
      rawDurationMins = actualOutMins >= actualInMins 
        ? (actualOutMins - actualInMins) 
        : (1440 - actualInMins + actualOutMins);
    } else if (actualInMins > 0 && actualOutMins === 0) {
      rawDurationMins = 0;
    }

    // FORMULA FOR ACTUAL WORK:
    // Rule 2: If early check-in is <= 30 mins, do NOT calculate early check-in for actual work hours calculation
    const earlyInWorkExclusion = (earlyInMins > 0 && earlyInMins <= 30) ? earlyInMins : 0;
    let actualWorkMins = 0;
    if (rawDurationMins > 0) {
      actualWorkMins = Math.max(0, rawDurationMins - earlyInWorkExclusion - breakDeductionMins);
    } else if (actualInMins > 0 && actualOutMins > 0) {
      const grossDiff = actualOutMins >= actualInMins ? (actualOutMins - actualInMins) : (1440 - actualInMins + actualOutMins);
      actualWorkMins = Math.max(0, grossDiff - earlyInWorkExclusion - breakDeductionMins);
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

    // Work Hour Difference (+/-)
    let workDiffMins = 0;
    if (actualWorkMins > 0) {
      workDiffMins = actualWorkMins - schedWorkMins;
    } else if (statusCode === 'WO') {
      workDiffMins = 0;
    } else {
      workDiffMins = -schedWorkMins;
    }

    // Rule 1: LATE CHECK-IN DEDUCTION
    // No deduction up to 10 min late check-in. If late check-in > 10 min, deduct 10 mins as normal rate (1.0x) and rest extra minutes as 1.5x
    let lateInDeduction = 0;
    let lateMins = 0;
    if ((statusCode === 'P' || statusCode === 'HD') && lateInMins > 10) {
      lateMins = lateInMins;
      const normalPartMins = 10;
      const extraPartMins = lateInMins - 10;
      lateInDeduction = ((normalPartMins * 1.0 + extraPartMins * lateMultiplier) / 60) * effHourlyRate;
    }

    // Rule 4: EARLY CHECK-OUT DEDUCTION
    // Calculate and deduct early check-out mins by 1 times (normal)
    let earlyOutDeduction = 0;
    let earlyMins = 0;
    if ((statusCode === 'P' || statusCode === 'HD') && earlyOutMins > 0) {
      earlyMins = earlyOutMins;
      earlyOutDeduction = (earlyOutMins / 60) * effHourlyRate * 1.0;
    }

    // Rule 5: Excess Break Deduction (Standard break formula remains same)
    let excessBreakMins = 0;
    if (stdBreakMins === 0) {
      excessBreakMins = actualBreakMins > 30 ? actualBreakMins : 0;
    } else {
      excessBreakMins = Math.max(0, actualBreakMins - stdBreakMins);
    }
    let excessBreakDeduction = 0;
    if ((statusCode === 'P' || statusCode === 'HD') && excessBreakMins > 0) {
      excessBreakDeduction = (excessBreakMins / 60) * effHourlyRate * 1.0;
    }

    // Total Timing Deductions
    let lateSalaryDeduction = lateInDeduction + earlyOutDeduction + excessBreakDeduction;
    if (isFixedPerDay) {
      // For Fixed Per Day Salary employees:
      // Hours calculation is okay (all late/early/break mins are tracked as normal),
      // but salary deduction for late arrival / early departure is NOT deducted from daily salary.
      lateSalaryDeduction = 0;
    }

    // Rule 2: EARLY CHECK-IN PAY
    // If early check-in is > 30 mins then only calculate and pay amount for early mins by 2 times
    let earlyInPay = 0;
    let earlyInPaidMins = 0;
    if (overtimeAllowed && (statusCode === 'P' || statusCode === 'HD') && earlyInMins > 30) {
      earlyInPaidMins = earlyInMins;
      earlyInPay = (earlyInMins / 60) * effHourlyRate * overtimeMultiplier;
    }

    // Rule 3: LATE CHECK-OUT PAY
    // Late out 10 minutes normal rate (1.0x).
    // If above 10 minutes: first 10 minutes normal rate (1.0x) and remaining minutes (lateOutMins - 10) at double rate (2.0x / overtimeMultiplier).
    let lateOutPay = 0;
    let lateOutPaidMins = 0;
    if (overtimeAllowed && (statusCode === 'P' || statusCode === 'HD') && lateOutMins > 0) {
      const minOT = minOvertimeMins > 0 ? minOvertimeMins : 0;
      if (lateOutMins >= minOT) {
        lateOutPaidMins = lateOutMins;
        if (lateOutMins > 10) {
          const normalPartMins = 10;
          const extraPartMins = lateOutMins - 10;
          lateOutPay = ((normalPartMins * 1.0 + extraPartMins * overtimeMultiplier) / 60) * effHourlyRate;
        } else {
          // lateOutMins <= 10
          lateOutPay = (lateOutMins / 60) * effHourlyRate * 1.0;
        }
      }
    }

    // Overtime Calculations for Manual Override & Weekly Off
    let manualOtPay = 0;
    let manualOtMins = 0;
    const otOverrideMins = manual.overtime_override_minutes !== undefined ? parseInt(manual.overtime_override_minutes, 10) : (record.overtime_override_minutes ? parseInt(record.overtime_override_minutes, 10) : 0);
    if (otOverrideMins > 0) {
      manualOtMins = otOverrideMins;
      manualOtPay = (manualOtMins / 60) * effHourlyRate * overtimeMultiplier;
    }

    let woOtPay = 0;
    let woOtMins = 0;
    if (overtimeAllowed && statusCode === 'WO' && actualWorkMins > 0) {
      if (actualWorkMins >= minOvertimeMins) {
        woOtMins = Math.max(0, actualWorkMins - (minOvertimeDeductionMins > 0 ? minOvertimeDeductionMins : 15));
        woOtPay = (woOtMins / 60) * effHourlyRate * overtimeMultiplier;
      }
    }

    let overtimeMins = 0;
    let overtimePay = 0;
    if (manualOtMins > 0) {
      overtimeMins = manualOtMins;
      overtimePay = manualOtPay;
    } else if (statusCode === 'WO') {
      overtimeMins = woOtMins;
      overtimePay = woOtPay;
    } else if (statusCode === 'WOP') {
      overtimeMins = 0;
      overtimePay = 0;
    } else {
      overtimeMins = earlyInPaidMins + lateOutPaidMins;
      overtimePay = earlyInPay + lateOutPay;
    }

    // Financial calculations for the day:
    let dailySalaryEarned = 0;
    if (isFixedPerDay) {
      // Fix Per Day Salary Rule:
      // If present full day salary, if absent then no salary zero
      if (statusCode === 'P' || statusCode === 'WO' || statusCode === 'WOP') {
        dailySalaryEarned = effDailyRate;
      } else if (statusCode === 'HD') {
        dailySalaryEarned = Number((effDailyRate * 0.5).toFixed(2));
      } else if (statusCode === 'A') {
        dailySalaryEarned = 0;
      }
    } else {
      if (statusCode === 'WO' || statusCode === 'WOP') {
        dailySalaryEarned = schedDailyWorkHours * effHourlyRate;
      } else if (statusCode === 'P') {
        dailySalaryEarned = targetWorkHours * effHourlyRate;
      } else if (statusCode === 'HD') {
        dailySalaryEarned = (schedDailyWorkHours * 0.5) * effHourlyRate;
      } else if (statusCode === 'A') {
        dailySalaryEarned = 0;
      }
    }

    const leaveDeduction = manual.leave_deduction !== undefined && manual.leave_deduction !== '' 
      ? parseFloat(manual.leave_deduction) || 0 
      : (parseFloat(record.leave_deduction) || 0);

    const penaltyAmount = manual.penalty_amount !== undefined && manual.penalty_amount !== '' 
      ? parseFloat(manual.penalty_amount) || 0 
      : (parseFloat(record.penalty_amount) || 0);

    let netDailySalary = 0;
    if (statusCode === 'A') {
      netDailySalary = 0;
    } else {
      netDailySalary = Math.max(0, dailySalaryEarned - lateSalaryDeduction + overtimePay - leaveDeduction - penaltyAmount);
    }

    // Compute final column outputs respecting any explicit manual overrides
    const finalCalcMode = (isManual && manual.calc_mode && manual.calc_mode.trim()) ? manual.calc_mode : calcMode;
    const finalSchedDur = (isManual && manual.scheduled_duration_formatted) ? manual.scheduled_duration_formatted : this.minutesToHHMM(schedDurMins);
    const finalSchedBreak = (isManual && manual.scheduled_break_formatted) ? manual.scheduled_break_formatted : this.minutesToHHMM(stdBreakMins);
    const finalSchedWork = (isManual && manual.scheduled_work_formatted) ? manual.scheduled_work_formatted : this.minutesToHHMM(schedWorkMins);
    const finalActDur = (isManual && manual.actual_duration_formatted) ? manual.actual_duration_formatted : this.minutesToHHMM(rawDurationMins);
    const finalEffBreak = (isManual && manual.effective_break_formatted) ? manual.effective_break_formatted : this.minutesToHHMM(effectiveBreakMins);
    const finalActWork = (isManual && manual.actual_work_formatted) ? manual.actual_work_formatted : this.minutesToHHMM(actualWorkMins);
    const finalWorkDiff = (isManual && manual.work_diff_formatted) ? manual.work_diff_formatted : this.minutesToHHMM(workDiffMins, true);
    const finalLateFormatted = (isManual && manual.late_formatted) ? manual.late_formatted : (lateMins > 0 ? this.minutesToHHMM(lateMins) : '00:00');
    const finalOtFormatted = (isManual && manual.overtime_formatted) ? manual.overtime_formatted : this.minutesToHHMM(overtimeMins);

    const finalDailySalaryEarned = (isManual && manual.daily_salary_earned !== undefined && manual.daily_salary_earned !== '') 
      ? parseFloat(manual.daily_salary_earned) 
      : Number(dailySalaryEarned.toFixed(2));

    const finalLateDed = (isManual && manual.late_salary_deduction !== undefined && manual.late_salary_deduction !== '') 
      ? parseFloat(manual.late_salary_deduction) 
      : Number(lateSalaryDeduction.toFixed(2));

    const finalOtPay = (isManual && manual.overtime_pay !== undefined && manual.overtime_pay !== '') 
      ? parseFloat(manual.overtime_pay) 
      : Number(overtimePay.toFixed(2));

    let finalNetSalary = Number(netDailySalary.toFixed(2));
    if (isManual && manual.net_daily_salary !== undefined && manual.net_daily_salary !== '') {
      finalNetSalary = parseFloat(manual.net_daily_salary);
    } else if (isManual && (manual.daily_salary_earned !== undefined || manual.late_salary_deduction !== undefined || manual.overtime_pay !== undefined)) {
      finalNetSalary = Number(Math.max(0, finalDailySalaryEarned - finalLateDed + finalOtPay - leaveDeduction - penaltyAmount).toFixed(2));
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
      scheduled_duration_minutes: this.timeToMinutes(finalSchedDur),
      scheduled_duration_formatted: finalSchedDur,
      scheduled_break_minutes: this.timeToMinutes(finalSchedBreak),
      scheduled_break_formatted: finalSchedBreak,
      scheduled_work_minutes: this.timeToMinutes(finalSchedWork),
      scheduled_work_formatted: finalSchedWork,
      
      // Actual Punches
      actual_in_time: actualInTimeStr,
      actual_out_time: actualOutTimeStr,
      break_out: breakOut,
      break_in: breakIn,
      actual_break_minutes: actualBreakMins,
      actual_break_formatted: this.minutesToHHMM(actualBreakMins),
      effective_break_minutes: this.timeToMinutes(finalEffBreak),
      effective_break_formatted: finalEffBreak,
      
      // 4-Case Calculation Result
      calc_mode: finalCalcMode,
      actual_duration_minutes: this.timeToMinutes(finalActDur),
      actual_duration_formatted: finalActDur,
      actual_work_minutes: this.timeToMinutes(finalActWork),
      actual_work_formatted: finalActWork,
      
      // Deviations
      work_diff_minutes: this.timeToMinutes(finalWorkDiff),
      work_diff_formatted: finalWorkDiff,
      late_minutes: this.timeToMinutes(finalLateFormatted),
      late_formatted: finalLateFormatted,
      is_late: this.timeToMinutes(finalLateFormatted) > 0,
      early_minutes: earlyMins,
      early_formatted: earlyMins > 0 ? this.minutesToHHMM(earlyMins) : '00:00',
      is_early: earlyMins > 0,
      early_in_minutes: earlyInMins,
      early_in_formatted: earlyInMins > 0 ? this.minutesToHHMM(earlyInMins) : '00:00',
      late_out_minutes: lateOutMins,
      late_out_formatted: lateOutMins > 0 ? this.minutesToHHMM(lateOutMins) : '00:00',
      overtime_minutes: this.timeToMinutes(finalOtFormatted),
      overtime_formatted: finalOtFormatted,
      is_doctor: isDoc,
      overtime_allowed: overtimeAllowed,
      is_fixed_per_day_salary: isFixedPerDay ? 1 : 0,

      // Rates and Salary breakdown
      hourly_rate: Number(effHourlyRate.toFixed(2)),
      daily_rate: Number(effDailyRate.toFixed(2)),
      daily_salary_earned: Number(finalDailySalaryEarned.toFixed(2)),
      late_in_deduction: Number(lateInDeduction.toFixed(2)),
      early_out_deduction: Number(earlyOutDeduction.toFixed(2)),
      excess_break_deduction: Number(excessBreakDeduction.toFixed(2)),
      late_salary_deduction: Number(finalLateDed.toFixed(2)),
      early_in_pay: Number(earlyInPay.toFixed(2)),
      late_out_pay: Number(lateOutPay.toFixed(2)),
      overtime_pay: Number(finalOtPay.toFixed(2)),
      leave_deduction: Number(leaveDeduction.toFixed(2)),
      penalty_amount: Number(penaltyAmount.toFixed(2)),
      net_daily_salary: Number(finalNetSalary.toFixed(2)),

      // W.E.F. Effective Date & Config Reference
      wef_date: effectiveEmp.effective_wef_date || null,
      effective_salary: baseSalary,

      punch_records: manual.punch_records !== undefined ? manual.punch_records : (record.punch_records || ''),
      remarks: manual.remarks !== undefined ? manual.remarks : (record.remarks || ''),
      is_manual: isManual ? 1 : 0,

      // Weekly Off and Sandwich Leave Flags
      is_weekly_off: isEmpWeeklyOff ? 1 : 0,
      weekly_off_days: effectiveEmp.weekly_off_days || 'Sunday',
      is_sandwich_absent: false,
      sandwich_note: '',
      is_wop_shortfall: false,
      wop_shortfall_note: ''
    };
  }

  /**
   * Calculate complete month attendance sheet with summary statistics for an employee
   */
  static calculateEmployeeMonthSheet(emp, records, targetMonth) {
    const daysInMonth = this.getDaysInMonth(targetMonth || (records[0]?.attendance_date_iso));
    const { hourlyRate, dailyRate, baseSalary, schedDailyWorkHours } = this.getEmployeeRates(emp, daysInMonth);

    // 1) Calculate each daily record initially
    const dailyCalculations = records.map(r => this.calculateDayRecord(emp, r, daysInMonth));

    // 2) Sandwich Leave Rule:
    // If an employee is absent on both sides of a holiday (or contiguous group of holidays/weekly offs),
    // then all intervening holidays in between are treated as Absent (no salary is paid for those days).
    // E.g.:
    // - Sunday holiday: Saturday Absent and Monday Absent -> Sunday becomes Absent.
    // - Saturday & Sunday holiday: Friday Absent and Monday Absent -> Saturday & Sunday become Absent.
    // - Multi-day continuous leave: Any continuous leave spanning across holidays converts those holidays to Absent.
    let sandwichAbsentDaysCount = 0;
    const nDays = dailyCalculations.length;

    const isUnworkedHoliday = (d) => {
      if (!d) return false;
      const code = (d.status_code || '').toUpperCase().trim();
      return (code === 'WO' || code === 'H' || code === 'HOLIDAY') && (d.actual_work_minutes === 0);
    };

    const isWorkingDayAbsent = (d) => {
      if (!d) return false;
      if (isUnworkedHoliday(d)) return false;
      const code = (d.status_code || '').toUpperCase().trim();
      if (code === 'A' || code === 'L') return true;
      if (code !== 'P' && code !== 'WOP' && code !== 'HD' && d.actual_work_minutes === 0) return true;
      return false;
    };

    let scanIdx = 0;
    while (scanIdx < nDays) {
      if (isUnworkedHoliday(dailyCalculations[scanIdx])) {
        const startIdx = scanIdx;
        while (scanIdx < nDays && isUnworkedHoliday(dailyCalculations[scanIdx])) {
          scanIdx++;
        }
        const endIdx = scanIdx - 1; // Contiguous block of unworked holidays: [startIdx ... endIdx]

        // Find the scheduled working day immediately preceding this holiday block
        let prevWorkingDay = null;
        for (let p = startIdx - 1; p >= 0; p--) {
          if (!isUnworkedHoliday(dailyCalculations[p])) {
            prevWorkingDay = dailyCalculations[p];
            break;
          }
        }

        // Find the scheduled working day immediately following this holiday block
        let nextWorkingDay = null;
        for (let q = endIdx + 1; q < nDays; q++) {
          if (!isUnworkedHoliday(dailyCalculations[q])) {
            nextWorkingDay = dailyCalculations[q];
            break;
          }
        }

        const prevAbsent = prevWorkingDay && isWorkingDayAbsent(prevWorkingDay);
        const nextAbsent = nextWorkingDay && isWorkingDayAbsent(nextWorkingDay);

        if (prevAbsent && nextAbsent) {
          for (let k = startIdx; k <= endIdx; k++) {
            const holDay = dailyCalculations[k];
            holDay.is_sandwich_absent = true;
            holDay.sandwich_note = `Sandwich Leave Rule: Absent on ${prevWorkingDay.attendance_date_iso || prevWorkingDay.attendance_date} and ${nextWorkingDay.attendance_date_iso || nextWorkingDay.attendance_date} - Holiday treated as Absent (No Salary)`;
            holDay.daily_salary_earned = 0;
            holDay.net_daily_salary = Math.max(0, holDay.daily_salary_earned - holDay.late_salary_deduction - holDay.leave_deduction - holDay.penalty_amount + holDay.overtime_pay);
            holDay.remarks = (holDay.remarks ? holDay.remarks + ' | ' : '') + 'Sandwich Absent: No Salary';
            sandwichAbsentDaysCount++;
          }
        }
      } else {
        scanIdx++;
      }
    }

    // 3) Compulsory WOP (Weekly Off Present) Rule:
    // If master has wop > 0 (e.g. 1 or 2), employee MUST be present on that many weekly off days.
    // Otherwise, shortfall weekly off days are treated as Absent (unpaid) and salary is deducted.
    const targetWopDays = Math.max(0, Math.round(parseFloat(emp.wop) || 0));
    const actualWopDays = dailyCalculations.filter(d => d.status_code === 'WOP' || (d.status_code === 'WO' && d.actual_work_minutes > 0)).length;
    const wopShortfall = targetWopDays > 0 ? Math.max(0, targetWopDays - actualWopDays) : 0;

    let wopPenaltyDaysCount = 0;
    if (wopShortfall > 0) {
      // Find unworked Weekly Off (WO) days in the month that are NOT already penalized by sandwich rule
      const unworkedWoDays = dailyCalculations.filter(d => !d.is_manual && d.status_code === 'WO' && d.actual_work_minutes === 0 && !d.is_sandwich_absent);
      
      // Penalize up to wopShortfall unworked WO days (from the end of the month backwards)
      const daysToPenalize = unworkedWoDays.slice(-wopShortfall);
      daysToPenalize.forEach(penalizedDay => {
        penalizedDay.is_wop_shortfall = true;
        penalizedDay.wop_shortfall_note = `Compulsory WOP (${targetWopDays} required, ${actualWopDays} worked) not met - Weekly Off treated as Absent (Salary Deducted)`;
        penalizedDay.daily_salary_earned = 0;
        penalizedDay.net_daily_salary = Math.max(0, penalizedDay.daily_salary_earned - penalizedDay.late_salary_deduction - penalizedDay.leave_deduction - penalizedDay.penalty_amount + penalizedDay.overtime_pay);
        penalizedDay.remarks = (penalizedDay.remarks ? penalizedDay.remarks + ' | ' : '') + 'WOP Shortfall: Absent';
        wopPenaltyDaysCount++;
      });
    }

    // 4) Summary counts
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
      if (day.is_sandwich_absent || day.is_wop_shortfall) {
        absentDays++;
      } else if (code === 'P') {
        presentDays++;
      } else if (code === 'A') {
        absentDays++;
      } else if (code === 'WO') {
        weeklyOffDays++;
      } else if (code === 'WOP') {
        weeklyOffPresentDays++;
      } else if (code === 'HD') {
        halfDays++;
      }

      if (day.is_late) lateDaysCount++;
      if (day.is_early) earlyDaysCount++;

      totalSchedWorkMins += day.scheduled_work_minutes;
      totalActualWorkMins += day.actual_work_minutes;
      totalActualBreakMins += (day.effective_break_minutes !== undefined ? day.effective_break_minutes : (day.actual_break_minutes || 0));
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

      // WOP Compulsory Requirement & Shortfall
      wopRequired: targetWopDays,
      wopFulfilled: actualWopDays,
      wopShortfall,
      wopShortfallDays: wopShortfall,
      wopPenaltyDays: wopPenaltyDaysCount,
      wopPenaltyDeduction: Number((wopPenaltyDaysCount * dailyRate).toFixed(2)),

      // Sandwich Leave Rule Stats
      sandwichAbsentDays: sandwichAbsentDaysCount,
      sandwichDeduction: Number((sandwichAbsentDaysCount * dailyRate).toFixed(2)),

      // W.E.F. Multi-Period Flags
      isMultiWefMonth,
      wefDatesUsed: uniqueWefDates,

      // Master fields included in summary
      wopDays: parseFloat(emp.wop) || 0,
      wopWorkHours: emp.wop_work_hours || null,
      yplDays: parseFloat(emp.ypl) || 0,
      overtimeAllowed: (emp.overtime_allowed !== 0 && emp.overtime_allowed !== false && emp.overtime_allowed !== '0'),
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
        ...emp,
        salary: emp.salary,
        incentive: parseFloat(emp.incentive) || 0,
        wef_date: emp.wef_date || null,
        standard_in_time: emp.standard_in_time || '08:00',
        standard_out_time: emp.standard_out_time || '20:00',
        standard_break_minutes: emp.standard_break_minutes || 0,
        standard_work_hours: emp.standard_work_hours || 12.0,
        wop_work_hours: emp.wop_work_hours !== undefined && emp.wop_work_hours !== null && emp.wop_work_hours !== '' ? emp.wop_work_hours : null,
        hourly_rate: hourlyRate,
        daily_rate: dailyRate,
        wop: parseFloat(emp.wop) || 0,
        ypl: parseFloat(emp.ypl) || 0,
        payment_mode: emp.payment_mode || 'Bank',
        late_grace_minutes: emp.late_grace_minutes || 11,
        late_deduction_multiplier: emp.late_deduction_multiplier ?? 1.5,
        overtime_multiplier: emp.overtime_multiplier ?? 2.0,
        overtime_allowed: (emp.overtime_allowed !== 0 && emp.overtime_allowed !== false && emp.overtime_allowed !== '0'),
        is_doctor: isDoc,
        min_overtime_minutes: emp.min_overtime_minutes || 0,
        min_overtime_deduction_minutes: emp.min_overtime_deduction_minutes || 0,
        special_rules: emp.special_rules || '',
        salary_history: emp.salary_history_json ? (typeof emp.salary_history_json === 'string' ? JSON.parse(emp.salary_history_json) : emp.salary_history_json) : [],
        wef_history: Array.isArray(emp.wef_history) ? emp.wef_history : []
      },
      month: targetMonth,
      summary,
      dailyRecords: dailyCalculations
    };
  }
}

module.exports = CalculationEngine;
