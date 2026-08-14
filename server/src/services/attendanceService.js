const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const { getDatabase } = require('../config/database');

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
   * Convert time string (e.g. "08:26" or "01:30:00") to total minutes
   */
  static parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.toString().trim().split(':');
    if (parts.length >= 2) {
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      return hours * 60 + minutes;
    }
    return 0;
  }

  /**
   * Convert various date formats (e.g. "01-May-2026", "2026-05-01", "01/05/2026", Excel serial) to ISO "YYYY-MM-DD"
   */
  static parseDateToISO(dateVal) {
    if (!dateVal) return null;

    // If it's an Excel serial date number
    if (typeof dateVal === 'number') {
      const dateObj = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
      return dateObj.toISOString().slice(0, 10);
    }

    const str = dateVal.toString().trim();

    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }

    // Format: DD-MMM-YYYY (e.g. 01-May-2026, 01-MAY-2026)
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

    // Format: DD/MM/YYYY or DD-MM-YYYY
    const numericMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (numericMatch) {
      const day = numericMatch[1].padStart(2, '0');
      const month = numericMatch[2].padStart(2, '0');
      const year = numericMatch[3];
      return `${year}-${month}-${day}`;
    }

    // Fallback Date parser
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
   * Map raw row to standardized Attendance Record
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

    const totalDuration = normalized['totalduration'] || normalized['duration'] || '00:00';
    const lateBy = normalized['lateby'] || '00:00';
    const earlyBy = normalized['earlyby'] || '00:00';
    const overTime = normalized['overtime'] || '00:00';

    return {
      employee_code: employeeCode.toString(),
      attendance_date: attendanceDateRaw,
      attendance_date_iso: attendanceDateIso,
      employee_name: normalized['employeename'] || normalized['name'] || '',
      designation: normalized['designation'] || '',
      department: normalized['department'] || 'Admin',
      begin_time: normalized['begintime'] || '00:00',
      end_time: normalized['endtime'] || '00:00',
      in_time: normalized['intime'] || '',
      out_time: normalized['outtime'] || '',
      late_by: lateBy,
      early_by: earlyBy,
      over_time: overTime,
      punch_records: normalized['punchrecords'] || '',
      shift_name: normalized['shiftname'] || '',
      status_code: (normalized['statuscode'] || normalized['status'] || 'A').toUpperCase(),
      total_duration: totalDuration,
      total_duration_minutes: this.parseTimeToMinutes(totalDuration),
      late_by_minutes: this.parseTimeToMinutes(lateBy),
      early_by_minutes: this.parseTimeToMinutes(earlyBy),
      over_time_minutes: this.parseTimeToMinutes(overTime)
    };
  }

  /**
   * Import attendance records with automatic upsert / overwrite on (employee_code, attendance_date_iso)
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
        late_by, early_by, over_time, punch_records, shift_name, status_code,
        total_duration, total_duration_minutes, late_by_minutes, early_by_minutes, over_time_minutes
      ) VALUES (
        @employee_code, @attendance_date, @attendance_date_iso, @employee_name,
        @designation, @department, @begin_time, @end_time, @in_time, @out_time,
        @late_by, @early_by, @over_time, @punch_records, @shift_name, @status_code,
        @total_duration, @total_duration_minutes, @late_by_minutes, @early_by_minutes, @over_time_minutes
      )
      ON CONFLICT(employee_code, attendance_date_iso) DO UPDATE SET
        employee_name = excluded.employee_name,
        designation = excluded.designation,
        department = excluded.department,
        begin_time = excluded.begin_time,
        end_time = excluded.end_time,
        in_time = excluded.in_time,
        out_time = excluded.out_time,
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
        updated_at = CURRENT_TIMESTAMP
    `);

    // Execute in a single atomic transaction for performance
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

    // Record import log
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
   * Get filtered and paginated attendance records
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
      'in_time': 'in_time',
      'total_duration_minutes': 'total_duration_minutes',
      'late_by_minutes': 'late_by_minutes'
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

    // If no date provided, find latest recorded date
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

    // Overall metrics for the day
    const summary = db.prepare(`
      SELECT
        COUNT(*) as totalShifts,
        SUM(CASE WHEN status_code = 'P' THEN 1 ELSE 0 END) as presentCount,
        SUM(CASE WHEN status_code = 'A' THEN 1 ELSE 0 END) as absentCount,
        SUM(CASE WHEN status_code = 'WO' THEN 1 ELSE 0 END) as weeklyOffCount,
        SUM(CASE WHEN status_code = 'WOP' THEN 1 ELSE 0 END) as weeklyOffPresentCount,
        SUM(CASE WHEN status_code = 'HD' THEN 1 ELSE 0 END) as halfDayCount,
        SUM(CASE WHEN late_by_minutes > 0 THEN 1 ELSE 0 END) as lateCount,
        SUM(CASE WHEN early_by_minutes > 0 THEN 1 ELSE 0 END) as earlyCount,
        SUM(total_duration_minutes) as totalWorkingMinutes,
        SUM(late_by_minutes) as totalLateMinutes,
        SUM(over_time_minutes) as totalOvertimeMinutes
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
        lateCount: summary.lateCount || 0,
        earlyCount: summary.earlyCount || 0,
        totalWorkingHours: ((summary.totalWorkingMinutes || 0) / 60).toFixed(1),
        totalLateHours: ((summary.totalLateMinutes || 0) / 60).toFixed(1),
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

    // Default to latest month in DB if not passed (e.g. "2026-05")
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

    // Group by employee
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
        SUM(CASE WHEN status_code = 'HD' THEN 1 ELSE 0 END) as halfDays,
        SUM(CASE WHEN late_by_minutes > 0 THEN 1 ELSE 0 END) as lateDays,
        SUM(CASE WHEN early_by_minutes > 0 THEN 1 ELSE 0 END) as earlyDays,
        SUM(total_duration_minutes) as totalMinutes,
        SUM(late_by_minutes) as totalLateMinutes,
        SUM(over_time_minutes) as totalOvertimeMinutes
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
        attendancePercentage,
        totalHours: ((emp.totalMinutes || 0) / 60).toFixed(1),
        lateHours: ((emp.totalLateMinutes || 0) / 60).toFixed(1),
        overtimeHours: ((emp.totalOvertimeMinutes || 0) / 60).toFixed(1)
      };
    });

    // Overall month statistics
    const monthTotals = db.prepare(`
      SELECT
        COUNT(*) as totalLogs,
        COUNT(DISTINCT employee_code) as uniqueEmployees,
        SUM(CASE WHEN status_code = 'P' THEN 1 ELSE 0 END) as totalPresent,
        SUM(CASE WHEN status_code = 'A' THEN 1 ELSE 0 END) as totalAbsent,
        SUM(CASE WHEN status_code = 'WO' THEN 1 ELSE 0 END) as totalWeeklyOff,
        SUM(CASE WHEN late_by_minutes > 0 THEN 1 ELSE 0 END) as totalLate,
        SUM(total_duration_minutes) as totalWorkingMinutes
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
        totalWeeklyOff: monthTotals.totalWeeklyOff || 0,
        totalLate: monthTotals.totalLate || 0,
        totalHours: ((monthTotals.totalWorkingMinutes || 0) / 60).toFixed(1)
      },
      employees: formatted
    };
  }

  /**
   * Employee-wise detailed attendance history
   */
  static getEmployeeReport(employeeCode, startDate = '', endDate = '') {
    const db = getDatabase();

    const conditions = ['employee_code = ?'];
    const params = [employeeCode.toString()];

    if (startDate) {
      conditions.push('attendance_date_iso >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('attendance_date_iso <= ?');
      params.push(endDate);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const summary = db.prepare(`
      SELECT
        employee_code,
        employee_name,
        department,
        designation,
        COUNT(*) as totalRecordedDays,
        SUM(CASE WHEN status_code = 'P' THEN 1 ELSE 0 END) as presentDays,
        SUM(CASE WHEN status_code = 'A' THEN 1 ELSE 0 END) as absentDays,
        SUM(CASE WHEN status_code = 'WO' THEN 1 ELSE 0 END) as weeklyOffDays,
        SUM(CASE WHEN status_code = 'WOP' THEN 1 ELSE 0 END) as weeklyOffPresentDays,
        SUM(CASE WHEN late_by_minutes > 0 THEN 1 ELSE 0 END) as lateDays,
        SUM(CASE WHEN early_by_minutes > 0 THEN 1 ELSE 0 END) as earlyDays,
        SUM(total_duration_minutes) as totalMinutes,
        SUM(late_by_minutes) as totalLateMinutes,
        SUM(over_time_minutes) as totalOvertimeMinutes
      FROM attendance
      ${whereClause}
    `).get(...params);

    const records = db.prepare(`
      SELECT * FROM attendance
      ${whereClause}
      ORDER BY attendance_date_iso DESC
    `).all(...params);

    const workingDays = (summary?.totalRecordedDays || 0) - (summary?.weeklyOffDays || 0);
    const attendancePercentage = workingDays > 0
      ? Math.round(((summary.presentDays + (summary.weeklyOffPresentCount || 0)) / workingDays) * 100)
      : 0;

    return {
      summary: {
        ...summary,
        workingDays,
        attendancePercentage,
        totalHours: ((summary?.totalMinutes || 0) / 60).toFixed(1),
        lateHours: ((summary?.totalLateMinutes || 0) / 60).toFixed(1),
        overtimeHours: ((summary?.totalOvertimeMinutes || 0) / 60).toFixed(1)
      },
      records
    };
  }

  /**
   * Date Range Summary Report
   */
  static getDateRangeSummaryReport({ startDate, endDate, department = '', employeeCode = '' }) {
    const db = getDatabase();

    const conditions = [];
    const params = [];

    if (startDate) {
      conditions.push('attendance_date_iso >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('attendance_date_iso <= ?');
      params.push(endDate);
    }
    if (department && department !== 'All') {
      conditions.push('department = ?');
      params.push(department);
    }
    if (employeeCode && employeeCode !== 'All') {
      conditions.push('employee_code = ?');
      params.push(employeeCode);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const summary = db.prepare(`
      SELECT
        COUNT(*) as totalShifts,
        COUNT(DISTINCT employee_code) as activeStaffCount,
        SUM(CASE WHEN status_code = 'P' THEN 1 ELSE 0 END) as presentCount,
        SUM(CASE WHEN status_code = 'A' THEN 1 ELSE 0 END) as absentCount,
        SUM(CASE WHEN status_code = 'WO' THEN 1 ELSE 0 END) as weeklyOffCount,
        SUM(CASE WHEN status_code = 'WOP' THEN 1 ELSE 0 END) as weeklyOffPresentCount,
        SUM(CASE WHEN late_by_minutes > 0 THEN 1 ELSE 0 END) as lateCount,
        SUM(CASE WHEN early_by_minutes > 0 THEN 1 ELSE 0 END) as earlyCount,
        SUM(total_duration_minutes) as totalWorkingMinutes,
        SUM(late_by_minutes) as totalLateMinutes,
        SUM(over_time_minutes) as totalOvertimeMinutes
      FROM attendance
      ${whereClause}
    `).get(...params);

    const departmentBreakdown = db.prepare(`
      SELECT
        department,
        COUNT(*) as totalShifts,
        SUM(CASE WHEN status_code = 'P' THEN 1 ELSE 0 END) as presentCount,
        SUM(CASE WHEN status_code = 'A' THEN 1 ELSE 0 END) as absentCount,
        SUM(CASE WHEN late_by_minutes > 0 THEN 1 ELSE 0 END) as lateCount,
        SUM(total_duration_minutes) as totalWorkingMinutes
      FROM attendance
      ${whereClause}
      GROUP BY department
      ORDER BY totalShifts DESC
    `).all(...params);

    const dateTrend = db.prepare(`
      SELECT
        attendance_date_iso,
        attendance_date,
        COUNT(*) as total,
        SUM(CASE WHEN status_code = 'P' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status_code = 'A' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN late_by_minutes > 0 THEN 1 ELSE 0 END) as late
      FROM attendance
      ${whereClause}
      GROUP BY attendance_date_iso, attendance_date
      ORDER BY attendance_date_iso ASC
    `).all(...params);

    return {
      summary: {
        totalShifts: summary.totalShifts || 0,
        activeStaffCount: summary.activeStaffCount || 0,
        presentCount: summary.presentCount || 0,
        absentCount: summary.absentCount || 0,
        weeklyOffCount: summary.weeklyOffCount || 0,
        weeklyOffPresentCount: summary.weeklyOffPresentCount || 0,
        lateCount: summary.lateCount || 0,
        earlyCount: summary.earlyCount || 0,
        totalWorkingHours: ((summary.totalWorkingMinutes || 0) / 60).toFixed(1),
        totalLateHours: ((summary.totalLateMinutes || 0) / 60).toFixed(1),
        attendanceRate: summary.totalShifts > 0
          ? Math.round(((summary.presentCount + (summary.weeklyOffPresentCount || 0)) / summary.totalShifts) * 100)
          : 0
      },
      departmentBreakdown,
      dateTrend
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
