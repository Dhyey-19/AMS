const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const { getDatabase } = require('../config/database');
const CalculationEngine = require('./calculationEngine');

const ATTENDANCE_FIELD_DEFINITIONS = [
  {
    key: 'employee_code',
    label: 'Employee Code / ID',
    required: true,
    category: 'required',
    description: 'Unique Employee ID (e.g. EMP001, 101)',
    aliases: ['employeecode', 'empcode', 'employeeid', 'empid', 'bioid', 'biometricid', 'biocode', 'deviceid', 'deviceuserid', 'punchid', 'staffid', 'staffcode', 'staffno', 'cardno', 'badgeno', 'acno', 'usercode', 'userid', 'enrollno', 'enrollid', 'code', 'id', 'no']
  },
  {
    key: 'attendance_date',
    label: 'Attendance Date',
    required: true,
    category: 'required',
    description: 'Date of attendance (YYYY-MM-DD, DD/MM/YYYY, etc.)',
    aliases: ['attendancedate', 'date', 'attdate', 'punchdate', 'logdate', 'workdate', 'entrydate', 'day', 'shiftdate']
  },
  {
    key: 'employee_name',
    label: 'Employee Name',
    required: false,
    category: 'employee',
    description: 'Staff / Employee full name',
    aliases: ['employeename', 'empname', 'name', 'staffname', 'staff', 'fullname', 'username', 'personname', 'workername']
  },
  {
    key: 'in_time',
    label: 'In Time (First Punch)',
    required: false,
    category: 'timings',
    description: 'First check-in punch timestamp (HH:MM)',
    aliases: ['intime', 'timein', 'actualin', 'checkin', 'firstin', 'firstpunch', 'signin', 'punchin', 'in1', 'clockin', 'arrival', 'in']
  },
  {
    key: 'out_time',
    label: 'Out Time (Last Punch)',
    required: false,
    category: 'timings',
    description: 'Last check-out punch timestamp (HH:MM)',
    aliases: ['outtime', 'timeout', 'actualout', 'checkout', 'lastout', 'lastpunch', 'signout', 'punchout', 'out1', 'clockout', 'departure', 'out']
  },
  {
    key: 'total_duration',
    label: 'Total Duration / Work Hours',
    required: false,
    category: 'timings',
    description: 'Worked duration (HH:MM)',
    aliases: ['totalduration', 'duration', 'workduration', 'workhours', 'totalhours', 'totalhrs', 'worktime', 'workinghours', 'totalwork', 'netduration']
  },
  {
    key: 'status_code',
    label: 'Status Code',
    required: false,
    category: 'employee',
    description: 'Attendance status (P, A, WO, H, HD, etc.)',
    aliases: ['statuscode', 'status', 'attendancestatus', 'attstatus', 'presentstatus', 'daystatus', 'present']
  },
  {
    key: 'shift_name',
    label: 'Shift Name',
    required: false,
    category: 'employee',
    description: 'Assigned shift name or code',
    aliases: ['shiftname', 'shifttype', 'shift', 'shiftcode', 'shiftschedule', 'assignedshift', 'timetable', 'workshift']
  },
  {
    key: 'punch_records',
    label: 'Punch Records (Log)',
    required: false,
    category: 'timings',
    description: 'All punch times log (e.g. 08:30, 13:00, 14:00, 17:30)',
    aliases: ['punchrecords', 'punchrecord', 'punchlog', 'punches', 'allpunches', 'rawpunches', 'rawlog', 'punchlist', 'logs', 'punchdetails', 'timelog']
  },
  {
    key: 'department',
    label: 'Department',
    required: false,
    category: 'employee',
    description: 'Department name',
    aliases: ['department', 'dept', 'deptname', 'division', 'unit', 'section']
  },
  {
    key: 'designation',
    label: 'Designation / Role',
    required: false,
    category: 'employee',
    description: 'Employee job title / designation',
    aliases: ['designation', 'desig', 'role', 'jobtitle', 'position', 'title', 'post']
  },
  {
    key: 'break_out',
    label: 'Break Out Time',
    required: false,
    category: 'timings',
    description: 'Lunch / break start time (HH:MM)',
    aliases: ['breakout', 'lunchout', 'out2', 'break1out', 'mealout']
  },
  {
    key: 'break_in',
    label: 'Break In Time',
    required: false,
    category: 'timings',
    description: 'Lunch / break end time (HH:MM)',
    aliases: ['breakin', 'lunchin', 'in2', 'break1in', 'mealin']
  },
  {
    key: 'begin_time',
    label: 'Shift Begin Time',
    required: false,
    category: 'timings',
    description: 'Scheduled shift start time (HH:MM)',
    aliases: ['begintime', 'shiftin', 'shiftstart', 'schedulein', 'starttime', 'planin']
  },
  {
    key: 'end_time',
    label: 'Shift End Time',
    required: false,
    category: 'timings',
    description: 'Scheduled shift end time (HH:MM)',
    aliases: ['endtime', 'shiftout', 'shiftend', 'scheduleout', 'planout']
  },
  {
    key: 'late_by',
    label: 'Late By Duration',
    required: false,
    category: 'adjustments',
    description: 'Late arrival time (HH:MM)',
    aliases: ['lateby', 'latemins', 'lateminutes', 'late', 'latetime', 'delay']
  },
  {
    key: 'early_by',
    label: 'Early By Duration',
    required: false,
    category: 'adjustments',
    description: 'Early departure time (HH:MM)',
    aliases: ['earlyby', 'earlymins', 'earlyminutes', 'early', 'earlyleaving', 'earlygoing']
  },
  {
    key: 'over_time',
    label: 'Overtime (OT)',
    required: false,
    category: 'adjustments',
    description: 'Overtime duration (HH:MM)',
    aliases: ['overtime', 'overtimeminutes', 'ot', 'othours', 'otminutes', 'extratime']
  },
  {
    key: 'leave_deduction',
    label: 'Leave Deduction',
    required: false,
    category: 'adjustments',
    description: 'Leave deduction days (0, 0.5, 1.0)',
    aliases: ['leavededuction', 'leave', 'deduction', 'leavedays']
  },
  {
    key: 'penalty_amount',
    label: 'Penalty Amount',
    required: false,
    category: 'adjustments',
    description: 'Fine or penalty amount',
    aliases: ['penalty', 'penaltyamount', 'fine', 'deductionamount']
  },
  {
    key: 'remarks',
    label: 'Remarks / Notes',
    required: false,
    category: 'adjustments',
    description: 'Comments or notes',
    aliases: ['remarks', 'remark', 'comments', 'comment', 'note', 'notes', 'reason']
  }
];

class AttendanceService {
  static getFieldDefinitions() {
    return ATTENDANCE_FIELD_DEFINITIONS;
  }

  /**
   * Helper to normalize raw row keys
   */
  static normalizeKey(key) {
    if (!key) return '';
    return key.toString().trim().toLowerCase().replace(/[\s_\-]+/g, '');
  }

  /**
   * Helper to clean string values
   */
  static cleanValue(val) {
    if (val === null || val === undefined) return '';
    const str = val.toString().trim();
    if (str.toLowerCase() === 'none' || str.toLowerCase() === 'null') {
      return '';
    }
    return str;
  }

  /**
   * Convert various date formats to ISO "YYYY-MM-DD"
   */
  static parseDateToISO(dateVal) {
    if (!dateVal) return null;

    if (typeof dateVal === 'number') {
      const dateObj = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
      return dateObj.toISOString().slice(0, 10);
    }

    const str = dateVal.toString().trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }

    const monthNames = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };

    const ddmmyyyyMatch = str.match(/^(\d{1,2})[-/ ]([a-zA-Z]{3,9})[-/ ](\d{4})$/);
    if (ddmmyyyyMatch) {
      const day = ddmmyyyyMatch[1].padStart(2, '0');
      const monStr = ddmmyyyyMatch[2].slice(0, 3).toLowerCase();
      const month = monthNames[monStr] || '01';
      const year = ddmmyyyyMatch[3];
      return `${year}-${month}-${day}`;
    }

    const numericMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (numericMatch) {
      const day = numericMatch[1].padStart(2, '0');
      const month = numericMatch[2].padStart(2, '0');
      const year = numericMatch[3];
      return `${year}-${month}-${day}`;
    }

    try {
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
      }
    } catch (e) {}

    return str;
  }

  /**
   * Automatically suggest column mapping based on file headers
   */
  static suggestColumnMapping(headers = []) {
    const mapping = {};
    const usedHeaders = new Set();

    const normalizedHeaders = headers.map(h => ({
      original: h,
      normalized: this.normalizeKey(h)
    }));

    // Step 1: Exact matches against alias list (prioritizing required primary fields first)
    for (const def of ATTENDANCE_FIELD_DEFINITIONS) {
      for (const h of normalizedHeaders) {
        if (usedHeaders.has(h.original)) continue;
        if (def.aliases.includes(h.normalized)) {
          mapping[def.key] = h.original;
          usedHeaders.add(h.original);
          break;
        }
      }
    }

    // Step 2: Substring / fuzzy containment matches for remaining unmapped fields
    for (const def of ATTENDANCE_FIELD_DEFINITIONS) {
      if (mapping[def.key]) continue;
      for (const h of normalizedHeaders) {
        if (usedHeaders.has(h.original)) continue;
        const isSubMatch = def.aliases.some(alias => {
          if (['id', 'no', 'code', 'emp', 'in', 'out', 'day'].includes(alias)) return false;
          return (alias.length >= 3 && h.normalized.includes(alias)) || 
                 (h.normalized.length >= 4 && alias.includes(h.normalized));
        });
        if (isSubMatch) {
          mapping[def.key] = h.original;
          usedHeaders.add(h.original);
          break;
        }
      }
    }

    return mapping;
  }

  /**
   * Parse either CSV or XLSX file
   */
  static async parseFile(filePath, sheetName = null) {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.xlsx' || ext === '.xls') {
      const workbook = xlsx.readFile(filePath, { cellDates: false });
      const sheetNames = workbook.SheetNames || [];
      const targetSheet = sheetName && sheetNames.includes(sheetName) ? sheetName : (sheetNames[0] || '');
      const sheet = workbook.Sheets[targetSheet];
      if (!sheet) return [];
      return xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });
    }

    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (err) => reject(err));
    });
  }

  /**
   * Extract headers, sheet names, preview rows, and suggested mappings from file
   */
  static async parseFileHeaders(filePath, sheetName = null) {
    const ext = path.extname(filePath).toLowerCase();
    let sheetNames = ['Sheet1'];
    let activeSheet = 'Sheet1';
    let headers = [];
    let previewRows = [];
    let totalRows = 0;

    if (ext === '.xlsx' || ext === '.xls') {
      const workbook = xlsx.readFile(filePath, { cellDates: false });
      sheetNames = workbook.SheetNames || [];
      activeSheet = sheetName && sheetNames.includes(sheetName) ? sheetName : (sheetNames[0] || '');
      const sheet = workbook.Sheets[activeSheet];

      if (sheet) {
        const jsonAll = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });
        totalRows = jsonAll.length;

        // Try extracting headers from matrix row 0
        const headerMatrix = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        if (headerMatrix.length > 0 && Array.isArray(headerMatrix[0])) {
          headers = headerMatrix[0]
            .map(h => (h !== undefined && h !== null ? String(h).trim() : ''))
            .filter(Boolean);
        }

        // Fallback: union of keys from json objects
        if (headers.length === 0 && jsonAll.length > 0) {
          const keySet = new Set();
          jsonAll.forEach(r => Object.keys(r).forEach(k => {
            if (k && k.trim()) keySet.add(k.trim());
          }));
          headers = Array.from(keySet);
        }

        previewRows = jsonAll.slice(0, 10);
      }
    } else {
      // CSV file
      const jsonAll = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', (err) => reject(err));
      });

      totalRows = jsonAll.length;
      const keySet = new Set();
      if (jsonAll.length > 0) {
        Object.keys(jsonAll[0]).forEach(k => {
          if (k && k.trim()) keySet.add(k.trim());
        });
        jsonAll.forEach(r => Object.keys(r).forEach(k => {
          if (k && k.trim()) keySet.add(k.trim());
        }));
      }
      headers = Array.from(keySet);
      previewRows = jsonAll.slice(0, 10);
    }

    const suggestedMapping = this.suggestColumnMapping(headers);

    return {
      sheetNames,
      activeSheet,
      headers,
      previewRows,
      totalRows,
      suggestedMapping,
      fieldDefinitions: ATTENDANCE_FIELD_DEFINITIONS
    };
  }

  /**
   * Map raw row to standardized Attendance Record storing only raw data
   */
  static mapRowToAttendance(rawRow, columnMapping = null) {
    const getMappedValue = (fieldKey) => {
      if (columnMapping && columnMapping[fieldKey]) {
        const headerName = columnMapping[fieldKey];
        if (rawRow[headerName] !== undefined && rawRow[headerName] !== '') {
          return this.cleanValue(rawRow[headerName]);
        }
        // Case-insensitive / trimmed search fallback
        const foundKey = Object.keys(rawRow).find(
          k => k.trim().toLowerCase() === headerName.trim().toLowerCase()
        );
        if (foundKey && rawRow[foundKey] !== undefined && rawRow[foundKey] !== '') {
          return this.cleanValue(rawRow[foundKey]);
        }
      }
      return null;
    };

    // Normalized row for auto-detection fallback
    const normalized = {};
    for (const [key, value] of Object.entries(rawRow)) {
      normalized[this.normalizeKey(key)] = this.cleanValue(value);
    }

    // 1. Employee Code
    let employeeCode = getMappedValue('employee_code');
    if (employeeCode === null) {
      employeeCode = normalized['employeecode'] || normalized['code'] || normalized['empid'] || normalized['id'] || '';
    }

    // 2. Attendance Date
    let attendanceDateRaw = getMappedValue('attendance_date');
    if (attendanceDateRaw === null) {
      attendanceDateRaw = normalized['attendancedate'] || normalized['date'] || '';
    }

    if (!employeeCode || !attendanceDateRaw) {
      return null;
    }

    const attendanceDateIso = this.parseDateToISO(attendanceDateRaw);
    if (!attendanceDateIso) {
      return null;
    }

    // 3. Employee Name
    let employeeName = getMappedValue('employee_name');
    if (employeeName === null) {
      employeeName = normalized['employeename'] || normalized['name'] || '';
    }

    // 4. Designation & Department
    let designation = getMappedValue('designation');
    if (designation === null) designation = normalized['designation'] || '';

    let department = getMappedValue('department');
    if (department === null) department = normalized['department'] || 'Admin';

    // 5. Shift & Begin/End Times
    let shiftName = getMappedValue('shift_name');
    if (shiftName === null) shiftName = normalized['shiftname'] || normalized['shift'] || '';

    let beginTime = getMappedValue('begin_time');
    if (beginTime === null) beginTime = normalized['begintime'] || '00:00';

    let endTime = getMappedValue('end_time');
    if (endTime === null) endTime = normalized['endtime'] || '00:00';

    // 6. Punches & Timings
    let inTimeRaw = getMappedValue('in_time');
    if (inTimeRaw === null) inTimeRaw = normalized['intime'] || normalized['actualin'] || normalized['in'] || '';
    const inTime = CalculationEngine.formatTimeString(inTimeRaw);

    let outTimeRaw = getMappedValue('out_time');
    if (outTimeRaw === null) outTimeRaw = normalized['outtime'] || normalized['actualout'] || normalized['out'] || '';
    const outTime = CalculationEngine.formatTimeString(outTimeRaw);

    let punchRecords = getMappedValue('punch_records');
    if (punchRecords === null) punchRecords = normalized['punchrecords'] || '';

    if (!punchRecords && (inTime || outTime)) {
      const list = [inTime, outTime].filter(Boolean);
      punchRecords = list.join(', ');
    }

    let breakOutRaw = getMappedValue('break_out');
    let breakInRaw = getMappedValue('break_in');
    const extractedBreaks = CalculationEngine.extractBreakPunches(
      punchRecords,
      breakOutRaw !== null ? breakOutRaw : normalized['breakout'],
      breakInRaw !== null ? breakInRaw : normalized['breakin']
    );
    const breakOut = extractedBreaks.breakOut;
    const breakIn = extractedBreaks.breakIn;

    // 7. Durations
    let totalDurationRaw = getMappedValue('total_duration');
    if (totalDurationRaw === null) totalDurationRaw = normalized['totalduration'] || normalized['duration'] || '';
    let totalDuration = CalculationEngine.formatTimeString(totalDurationRaw) || '00:00';

    if (totalDuration === '00:00' && inTime && outTime && inTime !== '00:00' && outTime !== '00:00') {
      const inMins = CalculationEngine.timeToMinutes(inTime);
      const outMins = CalculationEngine.timeToMinutes(outTime);
      if (outMins >= inMins) {
        const diff = outMins - inMins;
        const h = Math.floor(diff / 60).toString().padStart(2, '0');
        const m = (diff % 60).toString().padStart(2, '0');
        totalDuration = `${h}:${m}`;
      }
    }

    let lateByRaw = getMappedValue('late_by');
    if (lateByRaw === null) lateByRaw = normalized['lateby'] || '00:00';
    const lateBy = CalculationEngine.formatTimeString(lateByRaw) || '00:00';

    let earlyByRaw = getMappedValue('early_by');
    if (earlyByRaw === null) earlyByRaw = normalized['earlyby'] || '00:00';
    const earlyBy = CalculationEngine.formatTimeString(earlyByRaw) || '00:00';

    let overTimeRaw = getMappedValue('over_time');
    if (overTimeRaw === null) overTimeRaw = normalized['overtime'] || '00:00';
    const overTime = CalculationEngine.formatTimeString(overTimeRaw) || '00:00';

    // 8. Status Code
    let statusCodeRaw = getMappedValue('status_code');
    if (statusCodeRaw === null) statusCodeRaw = normalized['statuscode'] || normalized['status'] || '';
    let statusCode = (statusCodeRaw || '').toString().toUpperCase().trim();
    if (!statusCode) {
      if (inTime && inTime !== '00:00') {
        statusCode = 'P';
      } else {
        statusCode = 'A';
      }
    }

    // 9. Leave, Penalty, Remarks
    let leaveDeductionRaw = getMappedValue('leave_deduction');
    if (leaveDeductionRaw === null) leaveDeductionRaw = normalized['leavededuction'];
    const leaveDeduction = leaveDeductionRaw ? parseFloat(leaveDeductionRaw) || 0 : 0;

    let penaltyRaw = getMappedValue('penalty_amount');
    if (penaltyRaw === null) penaltyRaw = normalized['penalty'] || normalized['penaltyamount'];
    const penaltyAmount = penaltyRaw ? parseFloat(penaltyRaw) || 0 : 0;

    let remarks = getMappedValue('remarks');
    if (remarks === null) remarks = normalized['remarks'] || '';

    return {
      employee_code: employeeCode.toString().trim(),
      attendance_date: attendanceDateRaw,
      attendance_date_iso: attendanceDateIso,
      employee_name: employeeName,
      designation: designation,
      department: department,
      begin_time: beginTime,
      end_time: endTime,
      in_time: inTime,
      out_time: outTime,
      break_out: breakOut,
      break_in: breakIn,
      late_by: lateBy,
      early_by: earlyBy,
      over_time: overTime,
      punch_records: punchRecords,
      shift_name: shiftName,
      status_code: statusCode,
      total_duration: totalDuration,
      total_duration_minutes: CalculationEngine.timeToMinutes(totalDuration),
      late_by_minutes: CalculationEngine.timeToMinutes(lateBy),
      early_by_minutes: CalculationEngine.timeToMinutes(earlyBy),
      over_time_minutes: CalculationEngine.timeToMinutes(overTime),
      leave_deduction: leaveDeduction,
      penalty_amount: penaltyAmount,
      overtime_override_minutes: 0,
      remarks: remarks
    };
  }

  /**
   * Import attendance records with automatic upsert on (employee_code, attendance_date_iso)
   */
  static async importAttendanceData(filePath, originalFilename, importedBy = 'Admin', columnMapping = null, sheetName = null) {
    const rawRows = await this.parseFile(filePath, sheetName);
    const db = getDatabase();

    let inserted = 0;
    let updated = 0;
    let errors = [];

    const checkStmt = db.prepare('SELECT id FROM attendance WHERE employee_code = ? AND attendance_date_iso = ?');

    const upsertStmt = db.prepare(`
      INSERT INTO attendance (
        employee_code, attendance_date, attendance_date_iso, employee_name,
        designation, department, begin_time, end_time, in_time, out_time,
        break_out, break_in, late_by, early_by, over_time, punch_records, shift_name, status_code,
        total_duration, total_duration_minutes, late_by_minutes, early_by_minutes, over_time_minutes,
        leave_deduction, penalty_amount, overtime_override_minutes, remarks
      ) VALUES (
        @employee_code, @attendance_date, @attendance_date_iso, @employee_name,
        @designation, @department, @begin_time, @end_time, @in_time, @out_time,
        @break_out, @break_in, @late_by, @early_by, @over_time, @punch_records, @shift_name, @status_code,
        @total_duration, @total_duration_minutes, @late_by_minutes, @early_by_minutes, @over_time_minutes,
        @leave_deduction, @penalty_amount, @overtime_override_minutes, @remarks
      )
      ON CONFLICT(employee_code, attendance_date_iso) DO UPDATE SET
        employee_name = CASE WHEN excluded.employee_name != '' THEN excluded.employee_name ELSE attendance.employee_name END,
        designation = CASE WHEN excluded.designation != '' THEN excluded.designation ELSE attendance.designation END,
        department = CASE WHEN excluded.department != '' THEN excluded.department ELSE attendance.department END,
        begin_time = excluded.begin_time,
        end_time = excluded.end_time,
        in_time = excluded.in_time,
        out_time = excluded.out_time,
        break_out = excluded.break_out,
        break_in = excluded.break_in,
        late_by = excluded.late_by,
        early_by = excluded.early_by,
        over_time = excluded.over_time,
        punch_records = excluded.punch_records,
        shift_name = excluded.shift_name,
        status_code = excluded.status_code,
        total_duration = excluded.total_duration,
        total_duration_minutes = excluded.total_duration_minutes,
        late_by_minutes = excluded.late_by_minutes,
        early_by_minutes = excluded.early_by_minutes,
        over_time_minutes = excluded.over_time_minutes,
        leave_deduction = excluded.leave_deduction,
        penalty_amount = excluded.penalty_amount,
        overtime_override_minutes = excluded.overtime_override_minutes,
        remarks = excluded.remarks,
        updated_at = CURRENT_TIMESTAMP
    `);

    const transaction = db.transaction((rows) => {
      rows.forEach((rawRow, idx) => {
        try {
          const rec = this.mapRowToAttendance(rawRow, columnMapping);
          if (!rec) {
            errors.push({ row: idx + 2, error: 'Missing Employee Code or Attendance Date' });
            return;
          }

          const existing = checkStmt.get(rec.employee_code, rec.attendance_date_iso);
          if (existing) {
            updated++;
          } else {
            inserted++;
          }

          upsertStmt.run(rec);
        } catch (err) {
          errors.push({ row: idx + 2, error: err.message });
        }
      });
    });

    transaction(rawRows);

    const logStmt = db.prepare(`
      INSERT INTO import_logs (
        filename, file_type, total_rows, inserted_count,
        updated_count, skipped_count, error_count, details, imported_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    logStmt.run(
      originalFilename,
      path.extname(originalFilename).toUpperCase() || 'ATTENDANCE',
      rawRows.length,
      inserted,
      updated,
      0,
      errors.length,
      JSON.stringify(errors.slice(0, 10)),
      importedBy
    );

    return {
      filename: originalFilename,
      totalRows: rawRows.length,
      inserted,
      updated,
      errorCount: errors.length,
      errors: errors.slice(0, 20)
    };
  }


  /**
   * Get Employee-Wise Detailed Attendance Sheet with Dynamic Calculations
   */
  static getEmployeeAttendanceSheet(employeeCode, { month = '', startDate = '', endDate = '' }) {
    const db = getDatabase();

    // 1. Fetch Employee Master Profile
    const emp = db.prepare('SELECT * FROM employees WHERE employee_code = ?').get(employeeCode.toString());
    if (!emp) {
      throw new Error(`Employee with code ${employeeCode} not found in Employee Master`);
    }

    // 2. Determine date filters
    let targetMonth = month;
    if (!targetMonth && !startDate && !endDate) {
      // Find latest month with attendance for this employee or overall
      const latestEmpDate = db.prepare('SELECT SUBSTR(MAX(attendance_date_iso), 1, 7) as maxMonth FROM attendance WHERE employee_code = ?').get(employeeCode.toString());
      if (latestEmpDate?.maxMonth) {
        targetMonth = latestEmpDate.maxMonth;
      } else {
        const latestOverall = db.prepare('SELECT SUBSTR(MAX(attendance_date_iso), 1, 7) as maxMonth FROM attendance').get();
        targetMonth = latestOverall?.maxMonth || new Date().toISOString().slice(0, 7);
      }
    }

    const conditions = ['employee_code = ?'];
    const params = [employeeCode.toString()];

    if (targetMonth) {
      conditions.push('attendance_date_iso LIKE ?');
      params.push(`${targetMonth}%`);
    }
    if (startDate) {
      conditions.push('attendance_date_iso >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('attendance_date_iso <= ?');
      params.push(endDate);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // 3. Fetch Raw Attendance Rows
    const rawRecords = db.prepare(`
      SELECT * FROM attendance
      ${whereClause}
      ORDER BY attendance_date_iso ASC
    `).all(...params);

    // 4. If no raw records found for this month, generate placeholder date rows for the month so the admin can see the empty sheet structure
    let recordsToProcess = rawRecords;
    if (rawRecords.length === 0 && targetMonth) {
      const daysInMonth = CalculationEngine.getDaysInMonth(targetMonth);
      const placeholders = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = String(d).padStart(2, '0');
        const isoDate = `${targetMonth}-${dayStr}`;
        const dateObj = new Date(isoDate);
        const isSunday = dateObj.getDay() === 0;

        placeholders.push({
          employee_code: emp.employee_code,
          attendance_date: `${d}-${new Date(isoDate).toLocaleString('default', { month: 'short' })}-${targetMonth.slice(0, 4)}`,
          attendance_date_iso: isoDate,
          in_time: '',
          out_time: '',
          break_out: '',
          break_in: '',
          status_code: isSunday ? 'WO' : 'A',
          leave_deduction: 0,
          penalty_amount: 0,
          overtime_override_minutes: 0,
          remarks: ''
        });
      }
      recordsToProcess = placeholders;
    }

    // 5. Run Pure Dynamic Calculations
    const calculatedSheet = CalculationEngine.calculateEmployeeMonthSheet(emp, recordsToProcess, targetMonth);

    return calculatedSheet;
  }

  /**
   * Export Employee Attendance Sheet to XLSX or CSV Buffer
   */
  static exportEmployeeAttendance(employeeCode, { month = '', startDate = '', endDate = '', format = 'xlsx' }) {
    const sheetData = this.getEmployeeAttendanceSheet(employeeCode, { month, startDate, endDate });
    const emp = sheetData.employee;
    const summary = sheetData.summary;
    const records = sheetData.dailyRecords;

    if (format === 'csv') {
      const headers = [
        'DATE', 'P/A', 'IN TIME', 'OUT TIME', 'TIME DURATION', 'BREAK TIME', 'WORK TIME',
        'A.IN TIME', 'A.OUT TIME', 'A.TIME DURATION', 'BREAK OUT', 'BREAK IN', 'A.BREAK TIME',
        'A.WORK TIME', 'WORK HOUR DIFF', 'IN TIME LATE', 'OVER TIME', 'RATE', 'SALARY',
        'LATE SALARY', 'OVER TIME PAY', 'TOTAL SALARY', 'LEAVE', 'PENALTY'
      ];

      const rows = [
        [`${emp.employee_code} - ${emp.employee_name} (${emp.salary ? emp.salary + '/- ' : ''}${emp.standard_in_time} TO ${emp.standard_out_time} - ${emp.standard_work_hours} HRS)`],
        [`D.O.J: ${emp.doj || 'N/A'} | Payment Mode: ${emp.payment_mode || 'Bank'} | Rules: ${emp.special_rules || 'None'}`],
        headers
      ];

      records.forEach(r => {
        rows.push([
          r.attendance_date || r.attendance_date_iso,
          r.status_code,
          r.scheduled_in_time,
          r.scheduled_out_time,
          r.scheduled_duration_formatted,
          r.scheduled_break_formatted,
          r.scheduled_work_formatted,
          r.actual_in_time,
          r.actual_out_time,
          r.actual_duration_formatted,
          r.break_out,
          r.break_in,
          r.actual_break_formatted,
          r.actual_work_formatted,
          r.work_diff_formatted,
          r.late_formatted,
          r.overtime_formatted,
          r.hourly_rate,
          r.daily_salary_earned,
          r.late_salary_deduction,
          r.overtime_pay,
          r.net_daily_salary,
          r.leave_deduction,
          r.penalty_amount
        ]);
      });

      // Summary Total Row
      rows.push([
        'TOTAL', '', '', '', '', '', summary.totalExpectedWorkFormatted || summary.totalExpectedWorkHours,
        '', '', '', '', '', '', summary.totalActualWorkFormatted || summary.totalActualWorkHours,
        summary.totalWorkDiffFormatted, summary.totalLateFormatted, summary.totalOvertimeFormatted,
        '', summary.grossEarnedSalary, summary.totalLateDeductions, summary.totalOvertimePay,
        summary.netPayableSalary, summary.totalLeaveDeductions, summary.totalPenalties
      ]);

      const csvContent = rows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      return {
        buffer: Buffer.from(csvContent, 'utf-8'),
        filename: `${emp.employee_code}_${emp.employee_name.replace(/\s+/g, '_')}_Attendance.csv`,
        mimeType: 'text/csv'
      };
    }

    // XLSX generation matching MAY - 26.xlsx format
    const wb = xlsx.utils.book_new();
    const wsData = [];

    // Row 1: Header title with metadata
    wsData.push([
      `${emp.employee_code} - ${emp.employee_name}     (${emp.salary ? emp.salary + '/- ' : ''}${emp.standard_in_time} TO ${emp.standard_out_time} - ${emp.standard_work_hours} HRS)`,
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      `D.O.J.  ${emp.doj || ''}`,
      '', '',
      `TIME  ${emp.standard_in_time} TO ${emp.standard_out_time}  (${emp.standard_work_hours} HRS)`
    ]);

    // Row 2: Column Headers
    wsData.push([
      'DATE', 'P/A', 'IN TIME', 'OUT TIME', 'TIME DURATION', 'BREAK TIME', 'WORK TIME',
      'A.IN TIME', 'A.OUT TIME', 'A.TIME DURTION', 'BREAK OUT', 'BREAK IN', 'A.BREAK TIME',
      'A.WORK TIME', 'WORK HOUR DIFF.(-)&(+)', 'IN TIME LATE', 'OVER TIME', 'RATE',
      'SALARY', 'LATE SALARY', 'OVER TIME', 'TOTAL SALARY', 'LEAVE', 'PENALTY',
      'MONTH', 'PER DAY', 'PER HRS', 'SALARY', 'A.SALARY'
    ]);

    // Daily records
    records.forEach((r, idx) => {
      const hist = emp.salary_history && emp.salary_history[idx] ? emp.salary_history[idx] : null;
      wsData.push([
        r.attendance_date || r.attendance_date_iso,
        r.status_code,
        r.scheduled_in_time,
        r.scheduled_out_time,
        r.scheduled_duration_formatted,
        r.scheduled_break_formatted,
        r.scheduled_work_formatted,
        r.actual_in_time,
        r.actual_out_time,
        r.actual_duration_formatted,
        r.break_out,
        r.break_in,
        r.actual_break_formatted,
        r.actual_work_formatted,
        r.work_diff_formatted,
        r.late_formatted,
        r.overtime_formatted,
        r.hourly_rate,
        r.daily_salary_earned,
        r.late_salary_deduction,
        r.overtime_pay,
        r.net_daily_salary,
        r.leave_deduction,
        r.penalty_amount,
        hist?.month || '',
        hist?.perDay || '',
        hist?.perHour || '',
        hist?.baseSalary || '',
        hist?.actualSalary || ''
      ]);
    });

    // Summary Row
    wsData.push([
      'TOTAL', '', '', '', '', '', summary.totalExpectedWorkFormatted || summary.totalExpectedWorkHours,
      '', '', '', '', '', '', summary.totalActualWorkFormatted || summary.totalActualWorkHours,
      summary.totalWorkDiffFormatted, summary.totalLateFormatted, summary.totalOvertimeFormatted,
      '', summary.grossEarnedSalary, summary.totalLateDeductions, summary.totalOvertimePay,
      summary.netPayableSalary, summary.totalLeaveDeductions, summary.totalPenalties
    ]);

    const ws = xlsx.utils.aoa_to_sheet(wsData);
    xlsx.utils.book_append_sheet(wb, ws, emp.employee_name.slice(0, 30) || 'Attendance');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return {
      buffer,
      filename: `${emp.employee_code}_${emp.employee_name.replace(/\s+/g, '_')}_Attendance.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  }

  /**
   * Query & Filter Attendance Records
   */
  static getAttendanceRecords({
    search = '',
    employeeCode = '',
    department = '',
    statusCode = '',
    startDate = '',
    endDate = '',
    page = 1,
    limit = 20,
    sortBy = 'attendance_date_iso',
    sortOrder = 'desc'
  }) {
    const db = getDatabase();

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    if (search && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      conditions.push(`(
        employee_code LIKE ? OR 
        employee_name LIKE ? OR 
        department LIKE ? OR 
        designation LIKE ? OR
        shift_name LIKE ?
      )`);
      params.push(term, term, term, term, term);
    }

    if (employeeCode && employeeCode.trim() !== '' && employeeCode !== 'All') {
      conditions.push('employee_code = ?');
      params.push(employeeCode.trim());
    }

    if (department && department.trim() !== '' && department !== 'All') {
      conditions.push('department = ?');
      params.push(department.trim());
    }

    if (statusCode && statusCode.trim() !== '' && statusCode !== 'All') {
      conditions.push('status_code = ?');
      params.push(statusCode.trim().toUpperCase());
    }

    if (startDate && startDate.trim() !== '') {
      conditions.push('attendance_date_iso >= ?');
      params.push(startDate.trim());
    }

    if (endDate && endDate.trim() !== '') {
      conditions.push('attendance_date_iso <= ?');
      params.push(endDate.trim());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const allowedSort = {
      'attendance_date_iso': 'attendance_date_iso',
      'employee_code': 'CAST(employee_code AS INTEGER)',
      'employee_name': 'employee_name',
      'department': 'department',
      'status_code': 'status_code',
      'in_time': 'in_time'
    };

    const sortColumn = allowedSort[sortBy] || 'attendance_date_iso';
    const sortDir = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const countSql = `SELECT COUNT(*) as total FROM attendance ${whereClause}`;
    const total = db.prepare(countSql).get(...params).total;

    const dataSql = `
      SELECT * FROM attendance
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDir}, CAST(employee_code AS INTEGER) ASC
      LIMIT ? OFFSET ?
    `;

    const data = db.prepare(dataSql).all(...params, limitNum, offset);

    return {
      data,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    };
  }

  /**
   * Daily Attendance Report
   */
  static getDailyReport(dateIso, department = '') {
    const db = getDatabase();

    let targetDate = dateIso;
    if (!targetDate) {
      const latest = db.prepare('SELECT MAX(attendance_date_iso) as maxDate FROM attendance').get();
      targetDate = latest?.maxDate || new Date().toISOString().slice(0, 10);
    }

    const conditions = ['attendance_date_iso = ?'];
    const params = [targetDate];

    if (department && department !== 'All') {
      conditions.push('department = ?');
      params.push(department.trim());
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const summary = db.prepare(`
      SELECT
        COUNT(*) as totalShifts,
        SUM(CASE WHEN status_code = 'P' THEN 1 ELSE 0 END) as presentCount,
        SUM(CASE WHEN status_code = 'A' THEN 1 ELSE 0 END) as absentCount,
        SUM(CASE WHEN status_code = 'WO' THEN 1 ELSE 0 END) as weeklyOffCount,
        SUM(CASE WHEN status_code = 'WOP' THEN 1 ELSE 0 END) as weeklyOffPresentCount,
        SUM(CASE WHEN status_code = 'HD' THEN 1 ELSE 0 END) as halfDayCount,
        SUM(CASE WHEN in_time IS NOT NULL AND in_time != '' THEN 1 ELSE 0 END) as punchedCount
      FROM attendance
      ${whereClause}
    `).get(...params);

    const records = db.prepare(`
      SELECT * FROM attendance
      ${whereClause}
      ORDER BY CAST(employee_code AS INTEGER) ASC
    `).all(...params);

    return {
      date: targetDate,
      summary: {
        totalShifts: summary.totalShifts || 0,
        presentCount: summary.presentCount || 0,
        absentCount: summary.absentCount || 0,
        weeklyOffCount: summary.weeklyOffCount || 0,
        weeklyOffPresentCount: summary.weeklyOffPresentCount || 0,
        halfDayCount: summary.halfDayCount || 0,
        punchedCount: summary.punchedCount || 0,
        attendanceRate: summary.totalShifts > 0
          ? Math.round(((summary.presentCount + (summary.weeklyOffPresentCount || 0)) / summary.totalShifts) * 100)
          : 0
      },
      records
    };
  }

  /**
   * Monthly Attendance Summary Report (Matrix per employee)
   */
  static getMonthlySummaryReport(yearMonth, department = '') {
    const db = getDatabase();

    let targetMonth = yearMonth;
    if (!targetMonth) {
      const latest = db.prepare('SELECT SUBSTR(MAX(attendance_date_iso), 1, 7) as maxMonth FROM attendance').get();
      targetMonth = latest?.maxMonth || new Date().toISOString().slice(0, 7);
    }

    const conditions = ["attendance_date_iso LIKE ?"];
    const params = [`${targetMonth}%`];

    if (department && department !== 'All') {
      conditions.push('department = ?');
      params.push(department.trim());
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const employeeSummaries = db.prepare(`
      SELECT
        employee_code,
        employee_name,
        department,
        designation,
        COUNT(*) as totalDays,
        SUM(CASE WHEN status_code = 'P' THEN 1 ELSE 0 END) as presentDays,
        SUM(CASE WHEN status_code = 'A' THEN 1 ELSE 0 END) as absentDays,
        SUM(CASE WHEN status_code = 'WO' THEN 1 ELSE 0 END) as weeklyOffDays,
        SUM(CASE WHEN status_code = 'WOP' THEN 1 ELSE 0 END) as weeklyOffPresentDays,
        SUM(CASE WHEN status_code = 'HD' THEN 1 ELSE 0 END) as halfDays
      FROM attendance
      ${whereClause}
      GROUP BY employee_code, employee_name, department, designation
      ORDER BY CAST(employee_code AS INTEGER) ASC
    `).all(...params);

    const formatted = employeeSummaries.map((emp) => {
      const effectivePresent = emp.presentDays + emp.weeklyOffPresentDays + (emp.halfDays * 0.5);
      const workingDays = emp.totalDays - emp.weeklyOffDays;
      const attendancePercentage = workingDays > 0
        ? Math.min(100, Math.round((effectivePresent / workingDays) * 100))
        : 0;

      return {
        ...emp,
        effectivePresent,
        workingDays,
        attendancePercentage
      };
    });

    const monthTotals = db.prepare(`
      SELECT
        COUNT(*) as totalLogs,
        COUNT(DISTINCT employee_code) as uniqueEmployees,
        SUM(CASE WHEN status_code = 'P' THEN 1 ELSE 0 END) as totalPresent,
        SUM(CASE WHEN status_code = 'A' THEN 1 ELSE 0 END) as totalAbsent,
        SUM(CASE WHEN status_code = 'WO' THEN 1 ELSE 0 END) as totalWeeklyOff
      FROM attendance
      ${whereClause}
    `).get(...params);

    return {
      month: targetMonth,
      overview: {
        totalLogs: monthTotals.totalLogs || 0,
        uniqueEmployees: monthTotals.uniqueEmployees || 0,
        totalPresent: monthTotals.totalPresent || 0,
        totalAbsent: monthTotals.totalAbsent || 0,
        totalWeeklyOff: monthTotals.totalWeeklyOff || 0
      },
      employees: formatted
    };
  }

  /**
   * Get distinct available months recorded in attendance table
   */
  static getAvailableMonths() {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT DISTINCT SUBSTR(attendance_date_iso, 1, 7) as month
      FROM attendance
      WHERE attendance_date_iso IS NOT NULL
      ORDER BY month DESC
    `).all();
    return rows.map(r => r.month);
  }

  /**
   * Directly update any field of an individual attendance record in the database
   */
  static updateAttendanceRecord(employeeCode, dateIso, updateData) {
    const db = getDatabase();
    
    // Normalize times if provided
    const inTime = updateData.in_time !== undefined ? CalculationEngine.formatTimeString(updateData.in_time) : undefined;
    const outTime = updateData.out_time !== undefined ? CalculationEngine.formatTimeString(updateData.out_time) : undefined;
    const breakOut = updateData.break_out !== undefined ? CalculationEngine.formatTimeString(updateData.break_out) : undefined;
    const breakIn = updateData.break_in !== undefined ? CalculationEngine.formatTimeString(updateData.break_in) : undefined;

    const existing = db.prepare('SELECT * FROM attendance WHERE employee_code = ? AND attendance_date_iso = ?').get(String(employeeCode).trim(), dateIso);

    // Get employee master details for fallback metadata
    const emp = db.prepare('SELECT * FROM employees WHERE employee_code = ?').get(String(employeeCode).trim());
    const empName = emp?.employee_name || updateData.employee_name || existing?.employee_name || '';
    const dept = emp?.department || updateData.department || existing?.department || 'General';
    const desig = emp?.designation || updateData.designation || existing?.designation || '';

    const stmt = db.prepare(`
      INSERT INTO attendance (
        employee_code, attendance_date, attendance_date_iso, employee_name,
        designation, department, in_time, out_time, break_out, break_in,
        status_code, leave_deduction, penalty_amount, overtime_override_minutes,
        punch_records, remarks
      ) VALUES (
        @employee_code, @attendance_date, @attendance_date_iso, @employee_name,
        @designation, @department, @in_time, @out_time, @break_out, @break_in,
        @status_code, @leave_deduction, @penalty_amount, @overtime_override_minutes,
        @punch_records, @remarks
      )
      ON CONFLICT(employee_code, attendance_date_iso) DO UPDATE SET
        in_time = @in_time,
        out_time = @out_time,
        break_out = @break_out,
        break_in = @break_in,
        status_code = @status_code,
        leave_deduction = @leave_deduction,
        penalty_amount = @penalty_amount,
        overtime_override_minutes = @overtime_override_minutes,
        punch_records = CASE WHEN @punch_records != '' THEN @punch_records ELSE attendance.punch_records END,
        remarks = @remarks,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run({
      employee_code: String(employeeCode).trim(),
      attendance_date: updateData.attendance_date || existing?.attendance_date || dateIso,
      attendance_date_iso: dateIso,
      employee_name: empName,
      designation: desig,
      department: dept,
      in_time: inTime !== undefined ? inTime : (existing?.in_time || ''),
      out_time: outTime !== undefined ? outTime : (existing?.out_time || ''),
      break_out: breakOut !== undefined ? breakOut : (existing?.break_out || ''),
      break_in: breakIn !== undefined ? breakIn : (existing?.break_in || ''),
      status_code: (updateData.status_code !== undefined ? updateData.status_code : (existing?.status_code || 'P')).toUpperCase().trim(),
      leave_deduction: updateData.leave_deduction !== undefined ? parseFloat(updateData.leave_deduction) || 0 : (existing?.leave_deduction || 0),
      penalty_amount: updateData.penalty_amount !== undefined ? parseFloat(updateData.penalty_amount) || 0 : (existing?.penalty_amount || 0),
      overtime_override_minutes: updateData.overtime_override_minutes !== undefined ? parseInt(updateData.overtime_override_minutes, 10) || 0 : (existing?.overtime_override_minutes || 0),
      punch_records: updateData.punch_records !== undefined ? updateData.punch_records : (existing?.punch_records || ''),
      remarks: updateData.remarks !== undefined ? updateData.remarks : (existing?.remarks || '')
    });

    return db.prepare('SELECT * FROM attendance WHERE employee_code = ? AND attendance_date_iso = ?').get(String(employeeCode).trim(), dateIso);
  }

  /**
   * Batch delete attendance records by array of IDs or matching filters
   */
  static deleteBatchAttendance(options) {
    const db = getDatabase();

    let ids = [];
    let selectAllMatching = false;
    let filters = {};

    if (Array.isArray(options)) {
      ids = options;
    } else if (options && typeof options === 'object') {
      ids = options.ids || [];
      selectAllMatching = !!options.selectAllMatching;
      filters = options.filters || {};
    }

    if (selectAllMatching) {
      const { search = '', employeeCode = '', department = '', statusCode = '', startDate = '', endDate = '' } = filters;
      const conditions = [];
      const params = [];

      if (search && search.trim() !== '') {
        const term = `%${search.trim()}%`;
        conditions.push(`(
          employee_code LIKE ? OR 
          employee_name LIKE ? OR 
          department LIKE ? OR 
          designation LIKE ? OR
          shift_name LIKE ?
        )`);
        params.push(term, term, term, term, term);
      }

      if (employeeCode && employeeCode.trim() !== '' && employeeCode !== 'All') {
        conditions.push('employee_code = ?');
        params.push(employeeCode.trim());
      }

      if (department && department.trim() !== '' && department !== 'All') {
        conditions.push('department = ?');
        params.push(department.trim());
      }

      if (statusCode && statusCode.trim() !== '' && statusCode !== 'All') {
        conditions.push('status_code = ?');
        params.push(statusCode.trim().toUpperCase());
      }

      if (startDate && startDate.trim() !== '') {
        conditions.push('attendance_date_iso >= ?');
        params.push(startDate.trim());
      }

      if (endDate && endDate.trim() !== '') {
        conditions.push('attendance_date_iso <= ?');
        params.push(endDate.trim());
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const deleteSql = `DELETE FROM attendance ${whereClause}`;
      const info = db.prepare(deleteSql).run(...params);
      return { success: true, deletedCount: info.changes };
    }

    const cleanIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    if (cleanIds.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    const deleteTx = db.transaction((idList) => {
      let totalDeleted = 0;
      const chunkSize = 500;
      for (let i = 0; i < idList.length; i += chunkSize) {
        const chunk = idList.slice(i, i + chunkSize);
        const placeholders = chunk.map(() => '?').join(',');
        const info = db.prepare(`DELETE FROM attendance WHERE id IN (${placeholders})`).run(...chunk);
        totalDeleted += info.changes;
      }
      return totalDeleted;
    });

    const deletedCount = deleteTx(cleanIds);
    return { success: true, deletedCount };
  }

  /**
   * Clear attendance records
   */
  static clearAttendance() {
    const db = getDatabase();
    db.prepare('DELETE FROM attendance').run();
    return { success: true, message: 'All attendance records cleared' };
  }
}

module.exports = AttendanceService;
