const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const { getDatabase } = require('../config/database');
const CalculationEngine = require('./calculationEngine');

class AttendanceService {
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
   * Parse either CSV or XLSX file
   */
  static async parseFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.xlsx' || ext === '.xls') {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      return xlsx.utils.sheet_to_json(sheet, { defval: '' });
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
   * Map raw row to standardized Attendance Record storing only raw data
   */
  static mapRowToAttendance(rawRow) {
    const normalized = {};
    for (const [key, value] of Object.entries(rawRow)) {
      normalized[this.normalizeKey(key)] = this.cleanValue(value);
    }

    const employeeCode = normalized['employeecode'] || normalized['code'] || normalized['empid'] || normalized['id'];
    const attendanceDateRaw = normalized['attendancedate'] || normalized['date'];

    if (!employeeCode || !attendanceDateRaw) {
      return null;
    }

    const attendanceDateIso = this.parseDateToISO(attendanceDateRaw);
    if (!attendanceDateIso) {
      return null;
    }

    const inTime = CalculationEngine.formatTimeString(normalized['intime'] || normalized['actualin'] || normalized['in'] || '');
    const outTime = CalculationEngine.formatTimeString(normalized['outtime'] || normalized['actualout'] || normalized['out'] || '');
    const breakOut = CalculationEngine.formatTimeString(normalized['breakout'] || '');
    const breakIn = CalculationEngine.formatTimeString(normalized['breakin'] || '');

    const totalDuration = normalized['totalduration'] || normalized['duration'] || '00:00';
    const lateBy = normalized['lateby'] || '00:00';
    const earlyBy = normalized['earlyby'] || '00:00';
    const overTime = normalized['overtime'] || '00:00';

    return {
      employee_code: employeeCode.toString().trim(),
      attendance_date: attendanceDateRaw,
      attendance_date_iso: attendanceDateIso,
      employee_name: normalized['employeename'] || normalized['name'] || '',
      designation: normalized['designation'] || '',
      department: normalized['department'] || 'Admin',
      begin_time: normalized['begintime'] || '00:00',
      end_time: normalized['endtime'] || '00:00',
      in_time: inTime,
      out_time: outTime,
      break_out: breakOut,
      break_in: breakIn,
      late_by: lateBy,
      early_by: earlyBy,
      over_time: overTime,
      punch_records: normalized['punchrecords'] || '',
      shift_name: normalized['shiftname'] || '',
      status_code: (normalized['statuscode'] || normalized['status'] || 'A').toUpperCase().trim(),
      total_duration: totalDuration,
      total_duration_minutes: CalculationEngine.timeToMinutes(totalDuration),
      late_by_minutes: CalculationEngine.timeToMinutes(lateBy),
      early_by_minutes: CalculationEngine.timeToMinutes(earlyBy),
      over_time_minutes: CalculationEngine.timeToMinutes(overTime),
      leave_deduction: normalized['leavededuction'] ? parseFloat(normalized['leavededuction']) : 0,
      penalty_amount: normalized['penalty'] || normalized['penaltyamount'] ? parseFloat(normalized['penalty'] || normalized['penaltyamount']) : 0,
      overtime_override_minutes: normalized['overtimeoverride'] ? parseInt(normalized['overtimeoverride'], 10) : 0,
      remarks: normalized['remarks'] || ''
    };
  }

  /**
   * Import attendance records with automatic upsert on (employee_code, attendance_date_iso)
   */
  static async importAttendanceData(filePath, originalFilename, importedBy = 'Admin') {
    const rawRows = await this.parseFile(filePath);
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
          const rec = this.mapRowToAttendance(rawRow);
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
   * Import sample month file from `excel files/`
   */
  static async importSampleMonth(monthFileName = 'MD MAY.csv', importedBy = 'Admin') {
    const samplePath = path.resolve(__dirname, `../../../excel files/${monthFileName}`);
    if (!fs.existsSync(samplePath)) {
      throw new Error(`Sample file not found: ${samplePath}`);
    }
    return this.importAttendanceData(samplePath, monthFileName, importedBy);
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
   * Clear attendance records
   */
  static clearAttendance() {
    const db = getDatabase();
    db.prepare('DELETE FROM attendance').run();
    return { success: true, message: 'All attendance records cleared' };
  }
}

module.exports = AttendanceService;
