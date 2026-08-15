const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const { getDatabase } = require('../config/database');
const CalculationEngine = require('./calculationEngine');

class EmployeeService {
  /**
   * Helper to normalize raw row keys to database column names
   */
  static normalizeKey(key) {
    if (!key) return '';
    return key.toString().trim().toLowerCase().replace(/[\s_\-]+/g, '');
  }

  /**
   * Helper to clean string values
   */
  static cleanValue(val) {
    if (val === null || val === undefined) return null;
    const str = val.toString().trim();
    if (str === '' || str.toLowerCase() === 'none' || str.toLowerCase() === 'null') {
      return null;
    }
    return str;
  }

  /**
   * Helper to parse Excel dates to ISO "YYYY-MM-DD"
   */
  static parseExcelDateToISO(val) {
    if (!val) return null;
    if (typeof val === 'number') {
      const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
      return dateObj.toISOString().slice(0, 10);
    }
    const str = val.toString().trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    
    // Format: 1-May-2026 or 01-May-2026
    const match = str.match(/^(\d{1,2})[-/ ]([a-zA-Z]{3,9})[-/ ](\d{4})$/i);
    if (match) {
      const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
      const d = match[1].padStart(2, '0');
      const m = months[match[2].slice(0, 3).toLowerCase()] || '01';
      const y = match[3];
      return `${y}-${m}-${d}`;
    }

    // Format: DD/MM/YYYY or DD-MM-YYYY
    const numMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (numMatch) {
      return `${numMatch[3]}-${numMatch[2].padStart(2, '0')}-${numMatch[1].padStart(2, '0')}`;
    }

    return null;
  }

  /**
   * Parse either a CSV or XLSX file into an array of objects
   */
  static async parseFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.xlsx' || ext === '.xls') {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      return xlsx.utils.sheet_to_json(sheet, { defval: '' });
    }

    // CSV Parsing
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
   * Map raw row to standardized Employee Record with all manual & rule fields
   */
  static mapRowToEmployee(rawRow) {
    const normalized = {};
    for (const [key, value] of Object.entries(rawRow)) {
      normalized[this.normalizeKey(key)] = this.cleanValue(value);
    }

    const employeeCode = normalized['employeecode'] || normalized['code'] || normalized['empid'] || normalized['id'];
    const employeeName = normalized['employeename'] || normalized['name'] || normalized['empname'];

    if (!employeeCode || !employeeName) {
      return null;
    }

    const salary = normalized['salary'] ? parseFloat(normalized['salary']) : null;
    const stdIn = CalculationEngine.formatTimeString(normalized['standardintime'] || normalized['intime'] || normalized['standardin'] || '08:00') || '08:00';
    const stdOut = CalculationEngine.formatTimeString(normalized['standardouttime'] || normalized['outtime'] || normalized['standardout'] || '20:00') || '20:00';
    const stdBreak = normalized['standardbreakminutes'] ? parseInt(normalized['standardbreakminutes'], 10) : 0;
    const stdHours = normalized['standardworkhours'] ? parseFloat(normalized['standardworkhours']) : 12.0;

    return {
      employee_code: employeeCode.toString().trim(),
      employee_name: employeeName.trim(),
      device_code: normalized['devicecode'] || employeeCode.toString().trim(),
      company: normalized['company'] || 'Global Ivf Hospital',
      department: normalized['department'] || 'General',
      location: normalized['location'] || 'Default',
      designation: normalized['designation'] || null,
      grade: normalized['grade'] || null,
      team: normalized['team'] || null,
      category: normalized['category'] || 'DefaultCategory',
      employment_type: normalized['employmenttype'] || null,
      gender: normalized['gender'] || 'Not Specified',
      doj: normalized['doj'] || null,
      doc: normalized['doc'] || null,
      dob: normalized['dob'] || null,
      rfid: normalized['rfid'] || null,
      uid_no: normalized['uidno'] || normalized['uid'] || null,
      pan_no: normalized['panno'] || normalized['pan'] || null,
      voter_id_no: normalized['voteridno'] || normalized['voterid'] || null,
      status: normalized['status'] || 'Working',
      dor: normalized['dor'] || null,
      holiday_group: normalized['holidaygroup'] || null,
      shift_group_code: normalized['shiftgroupcode'] || null,
      salary: salary,
      standard_in_time: stdIn,
      standard_out_time: stdOut,
      standard_break_minutes: stdBreak,
      standard_work_hours: stdHours,
      rate_type: normalized['ratetype'] || 'hourly',
      hourly_rate: normalized['hourlyrate'] ? parseFloat(normalized['hourlyrate']) : null,
      daily_rate: normalized['dailyrate'] ? parseFloat(normalized['dailyrate']) : null,
      payment_mode: normalized['paymentmode'] || 'Bank',
      late_grace_minutes: normalized['lategraceminutes'] ? parseInt(normalized['lategraceminutes'], 10) : 11,
      late_deduction_multiplier: normalized['latedeductionmultiplier'] ? parseFloat(normalized['latedeductionmultiplier']) : 0.5,
      overtime_multiplier: normalized['overtimemultiplier'] ? parseFloat(normalized['overtimemultiplier']) : 2.0,
      overtime_allowed: normalized['overtimeallowed'] !== undefined ? (normalized['overtimeallowed'] === '0' || normalized['overtimeallowed'] === 'false' ? 0 : 1) : 1,
      min_overtime_minutes: normalized['minovertimeminutes'] ? parseInt(normalized['minovertimeminutes'], 10) : 0,
      min_overtime_deduction_minutes: (normalized['minovertimedeductionminutes'] || normalized['minovertimededuction'] || normalized['overtimedeductionminutes'] || normalized['overtimededuction']) ? parseInt(normalized['minovertimedeductionminutes'] || normalized['minovertimededuction'] || normalized['overtimedeductionminutes'] || normalized['overtimededuction'], 10) : 0,
      special_rules: normalized['specialrules'] || normalized['rules'] || normalized['remarks'] || null,
      salary_history_json: normalized['salaryhistoryjson'] || null,
      wop: normalized['wop'] ? parseFloat(normalized['wop']) : 0,
      ypl: normalized['ypl'] ? parseFloat(normalized['ypl']) : 0
    };
  }

  /**
   * Import master data from uploaded file with deduplication
   */
  static async importMasterData(filePath, originalFilename, mode = 'upsert', importedBy = 'Admin') {
    const rawRows = await this.parseFile(filePath);
    const db = getDatabase();

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = [];

    const checkStmt = db.prepare('SELECT employee_code FROM employees WHERE employee_code = ?');
    
    const insertStmt = db.prepare(`
      INSERT INTO employees (
        employee_code, employee_name, device_code, company, department,
        location, designation, grade, team, category,
        employment_type, gender, doj, doc, dob,
        rfid, uid_no, pan_no, voter_id_no, status,
        dor, holiday_group, shift_group_code,
        salary, standard_in_time, standard_out_time, standard_break_minutes, standard_work_hours,
        rate_type, hourly_rate, daily_rate, payment_mode,
        late_grace_minutes, late_deduction_multiplier, overtime_multiplier, overtime_allowed,
        min_overtime_minutes, min_overtime_deduction_minutes, special_rules, salary_history_json,
        wop, ypl
      ) VALUES (
        @employee_code, @employee_name, @device_code, @company, @department,
        @location, @designation, @grade, @team, @category,
        @employment_type, @gender, @doj, @doc, @dob,
        @rfid, @uid_no, @pan_no, @voter_id_no, @status,
        @dor, @holiday_group, @shift_group_code,
        @salary, @standard_in_time, @standard_out_time, @standard_break_minutes, @standard_work_hours,
        @rate_type, @hourly_rate, @daily_rate, @payment_mode,
        @late_grace_minutes, @late_deduction_multiplier, @overtime_multiplier, @overtime_allowed,
        @min_overtime_minutes, @min_overtime_deduction_minutes, @special_rules, @salary_history_json,
        @wop, @ypl
      )
    `);

    const updateStmt = db.prepare(`
      UPDATE employees SET
        employee_name = @employee_name,
        device_code = @device_code,
        company = @company,
        department = @department,
        location = @location,
        designation = @designation,
        grade = @grade,
        team = @team,
        category = @category,
        employment_type = @employment_type,
        gender = @gender,
        doj = @doj,
        doc = @doc,
        dob = @dob,
        rfid = @rfid,
        uid_no = @uid_no,
        pan_no = @pan_no,
        voter_id_no = @voter_id_no,
        status = @status,
        dor = @dor,
        holiday_group = @holiday_group,
        shift_group_code = @shift_group_code,
        salary = COALESCE(@salary, salary),
        standard_in_time = COALESCE(@standard_in_time, standard_in_time),
        standard_out_time = COALESCE(@standard_out_time, standard_out_time),
        standard_break_minutes = COALESCE(@standard_break_minutes, standard_break_minutes),
        standard_work_hours = COALESCE(@standard_work_hours, standard_work_hours),
        rate_type = COALESCE(@rate_type, rate_type),
        hourly_rate = COALESCE(@hourly_rate, hourly_rate),
        daily_rate = COALESCE(@daily_rate, daily_rate),
        payment_mode = COALESCE(@payment_mode, payment_mode),
        late_grace_minutes = COALESCE(@late_grace_minutes, late_grace_minutes),
        late_deduction_multiplier = COALESCE(@late_deduction_multiplier, late_deduction_multiplier),
        overtime_multiplier = COALESCE(@overtime_multiplier, overtime_multiplier),
        overtime_allowed = COALESCE(@overtime_allowed, overtime_allowed),
        min_overtime_minutes = COALESCE(@min_overtime_minutes, min_overtime_minutes),
        min_overtime_deduction_minutes = COALESCE(@min_overtime_deduction_minutes, min_overtime_deduction_minutes),
        special_rules = COALESCE(@special_rules, special_rules),
        salary_history_json = COALESCE(@salary_history_json, salary_history_json),
        wop = COALESCE(@wop, wop),
        ypl = COALESCE(@ypl, ypl),
        updated_at = CURRENT_TIMESTAMP
      WHERE employee_code = @employee_code
    `);

    const transaction = db.transaction((rows) => {
      rows.forEach((rawRow, idx) => {
        try {
          const emp = this.mapRowToEmployee(rawRow);
          if (!emp) {
            errors.push({ row: idx + 2, error: 'Missing Employee Code or Employee Name' });
            return;
          }

          const existing = checkStmt.get(emp.employee_code);

          if (existing) {
            if (mode === 'skip') {
              skipped++;
            } else {
              updateStmt.run(emp);
              updated++;
            }
          } else {
            insertStmt.run(emp);
            inserted++;
          }
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
      path.extname(originalFilename).toUpperCase(),
      rawRows.length,
      inserted,
      updated,
      skipped,
      errors.length,
      JSON.stringify(errors.slice(0, 10)),
      importedBy
    );

    return {
      filename: originalFilename,
      totalRows: rawRows.length,
      inserted,
      updated,
      skipped,
      errorCount: errors.length,
      errors: errors.slice(0, 20)
    };
  }

  /**
   * Import complete multi-sheet workbook (e.g. MAY - 26.xlsx)
   * Extracts both Employee Master Rules and Raw Daily Attendance logs
   */
  static async importWorkbook(filePath, originalFilename = 'MAY - 26.xlsx', importedBy = 'Admin') {
    const workbook = xlsx.readFile(filePath, { cellFormula: true });
    const db = getDatabase();

    const nonEmpSheets = [
      'GIFT', 'HOLISTIC', 'DONER', 'LAB-D SHEET', 'ASHISH - INCENTIVE',
      'BONAS', 'APPRECIATION', 'PENLATY', 'LEAVE SHEET', 'OT SHEET',
      'ACCOUNT', 'CHQ.SALARY', 'CASH SALARY', 'WORK SHEET', 'MO WORK SHEET',
      'S.NAGAR TO APR.-26', 'SURENDRANAGAR', 'Sheet49', 'Sheet50'
    ];

    const empSheets = workbook.SheetNames.filter(name => !nonEmpSheets.includes(name.trim()));

    let employeesUpserted = 0;
    let attendanceInserted = 0;
    let attendanceUpdated = 0;
    const errors = [];

    const upsertEmpStmt = db.prepare(`
      INSERT INTO employees (
        employee_code, employee_name, device_code, company, department,
        location, designation, grade, team, category,
        employment_type, gender, doj, status,
        salary, standard_in_time, standard_out_time, standard_break_minutes, standard_work_hours,
        rate_type, hourly_rate, daily_rate, payment_mode,
        late_grace_minutes, late_deduction_multiplier, overtime_multiplier, overtime_allowed,
        min_overtime_minutes, min_overtime_deduction_minutes, special_rules, salary_history_json,
        wop, ypl
      ) VALUES (
        @employee_code, @employee_name, @device_code, @company, @department,
        @location, @designation, @grade, @team, @category,
        @employment_type, @gender, @doj, @status,
        @salary, @standard_in_time, @standard_out_time, @standard_break_minutes, @standard_work_hours,
        @rate_type, @hourly_rate, @daily_rate, @payment_mode,
        @late_grace_minutes, @late_deduction_multiplier, @overtime_multiplier, @overtime_allowed,
        @min_overtime_minutes, @min_overtime_deduction_minutes, @special_rules, @salary_history_json,
        @wop, @ypl
      )
      ON CONFLICT(employee_code) DO UPDATE SET
        employee_name = excluded.employee_name,
        department = CASE WHEN excluded.department != 'General' THEN excluded.department ELSE employees.department END,
        designation = CASE WHEN excluded.designation IS NOT NULL THEN excluded.designation ELSE employees.designation END,
        doj = COALESCE(excluded.doj, employees.doj),
        salary = COALESCE(excluded.salary, employees.salary),
        standard_in_time = COALESCE(excluded.standard_in_time, employees.standard_in_time),
        standard_out_time = COALESCE(excluded.standard_out_time, employees.standard_out_time),
        standard_break_minutes = COALESCE(excluded.standard_break_minutes, employees.standard_break_minutes),
        standard_work_hours = COALESCE(excluded.standard_work_hours, employees.standard_work_hours),
        rate_type = COALESCE(excluded.rate_type, employees.rate_type),
        hourly_rate = COALESCE(excluded.hourly_rate, employees.hourly_rate),
        daily_rate = COALESCE(excluded.daily_rate, employees.daily_rate),
        payment_mode = COALESCE(excluded.payment_mode, employees.payment_mode),
        special_rules = COALESCE(excluded.special_rules, employees.special_rules),
        salary_history_json = COALESCE(excluded.salary_history_json, employees.salary_history_json),
        updated_at = CURRENT_TIMESTAMP
    `);

    const checkAttStmt = db.prepare('SELECT id FROM attendance WHERE employee_code = ? AND attendance_date_iso = ?');

    const upsertAttStmt = db.prepare(`
      INSERT INTO attendance (
        employee_code, attendance_date, attendance_date_iso, employee_name,
        designation, department, in_time, out_time, break_out, break_in,
        status_code, leave_deduction, penalty_amount, overtime_override_minutes, remarks
      ) VALUES (
        @employee_code, @attendance_date, @attendance_date_iso, @employee_name,
        @designation, @department, @in_time, @out_time, @break_out, @break_in,
        @status_code, @leave_deduction, @penalty_amount, @overtime_override_minutes, @remarks
      )
      ON CONFLICT(employee_code, attendance_date_iso) DO UPDATE SET
        employee_name = excluded.employee_name,
        in_time = excluded.in_time,
        out_time = excluded.out_time,
        break_out = excluded.break_out,
        break_in = excluded.break_in,
        status_code = excluded.status_code,
        leave_deduction = excluded.leave_deduction,
        penalty_amount = excluded.penalty_amount,
        overtime_override_minutes = excluded.overtime_override_minutes,
        remarks = excluded.remarks,
        updated_at = CURRENT_TIMESTAMP
    `);

    // Existing employees map for department/designation preservation
    const existingEmployees = db.prepare('SELECT employee_code, employee_name, department, designation FROM employees').all();
    const existingMap = new Map();
    existingEmployees.forEach(e => existingMap.set(String(e.employee_code).trim(), e));

    const transaction = db.transaction(() => {
      for (const sheetName of empSheets) {
        try {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) continue;

          let textA1 = sheet['A1'] ? String(sheet['A1'].v || '').trim() : '';
          let textA2 = sheet['A2'] ? String(sheet['A2'].v || '').trim() : '';
          let textZ1 = sheet['Z1'] ? String(sheet['Z1'].v || '').trim() : (sheet['Z2'] ? String(sheet['Z2'].v || '').trim() : '');
          let textAC1 = sheet['AC1'] ? String(sheet['AC1'].v || '').trim() : '';

          let empCode = '';
          let empName = '';
          let salary = null;
          let stdIn = '08:00';
          let stdOut = '20:00';
          let stdHours = 12.0;
          let stdBreak = 0;
          let specialRules = '';
          let doj = null;
          let paymentMode = 'Bank';

          let nameHeader = textA1;
          if (/^DATE$/i.test(textA2) === false && (textA2.includes('-') || textA2.includes('('))) {
            nameHeader = textA2;
            specialRules = textA1;
          } else if (/^DATE$/i.test(textA2)) {
            nameHeader = textA1;
          }

          // Extract code and name
          const codeNameMatch = nameHeader.match(/^(\d+)\s*[-–]\s*([^(]+)/);
          if (codeNameMatch) {
            empCode = codeNameMatch[1].trim();
            empName = codeNameMatch[2].trim();
          } else {
            const nameOnlyMatch = nameHeader.match(/^([^(]+)/);
            if (nameOnlyMatch) {
              empName = nameOnlyMatch[1].replace(/[-–]/g, '').trim();
            }
          }

          if (!empName) empName = sheetName.replace(/-C$/i, '').trim();
          if (!empCode) empCode = sheetName.replace(/\s+/g, '_');

          // Salary
          const salMatch = nameHeader.match(/\((\d+(?:\.\d+)?)\s*\/-/);
          if (salMatch) {
            salary = parseFloat(salMatch[1]);
          }

          // Payment mode
          if (nameHeader.includes('CHQ') || nameHeader.includes('CHEQUE')) paymentMode = 'Cheque';
          if (nameHeader.includes('CASH')) paymentMode = 'Cash';
          if (nameHeader.includes('TDS')) paymentMode = 'TDS / Cheque';

          // DOJ
          const dojMatch = textZ1.match(/D\.?O\.?J\.?\s*([0-9.]+)/i);
          if (dojMatch) {
            const parts = dojMatch[1].split('.');
            if (parts.length === 3) {
              doj = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }

          // Shift timings: prefer nameHeader first, fallback to textAC1
          let scheduleText = (nameHeader.includes('TO') || nameHeader.includes('to')) ? nameHeader : (textAC1 || nameHeader);
          const timeMatch = scheduleText.match(/(\d{1,2}[:.]\d{2})\s*(?:AM)?\s*TO\s*(\d{1,2}[:.]\d{2})\s*(?:PM|AM)?/i);
          if (timeMatch) {
            let t1 = timeMatch[1].replace('.', ':');
            let t2 = timeMatch[2].replace('.', ':');
            stdIn = t1.padStart(5, '0');
            let [h2, m2] = t2.split(':').map(Number);
            if (h2 < 12 && (scheduleText.toUpperCase().includes('PM') || h2 < 8)) {
              h2 += 12;
            }
            stdOut = `${String(h2).padStart(2, '0')}:${String(m2).padStart(2, '0')}`;
          }

          // Working hours & break
          // First check break: e.g. "2HRS BREAK" or "BREAK - 2 HRS" or "BREAK - 0:00"
          const breakMatch = nameHeader.match(/(\d+(?:\.\d+)?)\s*(?:HRS?|MINS?)\s*BREAK/i) || 
                             nameHeader.match(/BREAK\s*[-–:]?\s*(\d+(?:\.\d+)?(?::\d+)?)/i);
          if (breakMatch) {
            const bVal = breakMatch[1].trim();
            if (bVal.includes(':')) {
              const [bh, bm] = bVal.split(':').map(Number);
              stdBreak = (bh || 0) * 60 + (bm || 0);
            } else {
              const numVal = parseFloat(bVal);
              stdBreak = nameHeader.toLowerCase().includes('min') ? numVal : numVal * 60;
            }
          }

          // Working hours: find all "X HRS" matches and pick the one that is not a break
          const allHrsMatches = [...nameHeader.matchAll(/(\d+(?:\.\d+)?(?::\d+)?)\s*HRS/gi)];
          let matchedWorkHrs = null;
          for (const m of allHrsMatches) {
            const fullMatch = m[0];
            const index = m.index;
            const followingText = nameHeader.slice(index + fullMatch.length, index + fullMatch.length + 10);
            if (!followingText.toUpperCase().includes('BREAK')) {
              matchedWorkHrs = m[1].trim();
            }
          }

          if (!matchedWorkHrs && textAC1) {
            const acHrs = textAC1.match(/(\d+(?:\.\d+)?(?::\d+)?)\s*HRS/i);
            if (acHrs) matchedWorkHrs = acHrs[1].trim();
          }

          if (matchedWorkHrs) {
            if (matchedWorkHrs.includes(':')) {
              const [h, m] = matchedWorkHrs.split(':').map(Number);
              stdHours = Number(((h || 0) + (m || 0) / 60).toFixed(2));
            } else {
              stdHours = parseFloat(matchedWorkHrs);
            }
          } else {
            const inM = CalculationEngine.timeToMinutes(stdIn);
            const outM = CalculationEngine.timeToMinutes(stdOut);
            if (outM > inM) {
              stdHours = Number((Math.max(0, outM - inM - stdBreak) / 60).toFixed(2));
            }
          }

          // Salary scale history from columns Z, AA, AB, AC, AD
          const salaryHistory = [];
          for (let r = 3; r <= 35; r++) {
            const monthCell = sheet[`Z${r}`];
            const perDayCell = sheet[`AA${r}`];
            const perHrCell = sheet[`AB${r}`];
            const salCell = sheet[`AC${r}`];
            const actSalCell = sheet[`AD${r}`];

            if (monthCell && monthCell.v && String(monthCell.v).trim() !== '') {
              salaryHistory.push({
                month: String(monthCell.v).trim(),
                perDay: perDayCell ? Number(parseFloat(perDayCell.v || 0).toFixed(2)) : 0,
                perHour: perHrCell ? Number(parseFloat(perHrCell.v || 0).toFixed(2)) : 0,
                baseSalary: salCell ? Number(parseFloat(salCell.v || 0).toFixed(2)) : 0,
                actualSalary: actSalCell ? Number(parseFloat(actSalCell.v || 0).toFixed(2)) : 0
              });
            }
          }

          const existingDb = existingMap.get(empCode);

          // Rates
          const rates = CalculationEngine.getEmployeeRates({
            salary,
            standard_work_hours: stdHours,
            rate_type: 'hourly'
          }, 31);

          // Upsert Employee Master
          upsertEmpStmt.run({
            employee_code: empCode,
            employee_name: empName || existingDb?.employee_name || sheetName,
            device_code: empCode,
            company: 'Global Ivf Hospital',
            department: existingDb?.department || (nameHeader.includes('DR.') ? 'Medical Officer' : 'General'),
            location: 'Default',
            designation: existingDb?.designation || (nameHeader.includes('DR.') ? 'Doctor' : 'Staff'),
            grade: null,
            team: null,
            category: 'HospitalStaff',
            employment_type: 'Full Time',
            gender: existingDb?.gender || 'Not Specified',
            doj: doj || existingDb?.doj || null,
            status: 'Working',
            salary: salary,
            standard_in_time: stdIn,
            standard_out_time: stdOut,
            standard_break_minutes: stdBreak,
            standard_work_hours: stdHours,
            rate_type: 'hourly',
            hourly_rate: rates.hourlyRate,
            daily_rate: rates.dailyRate,
            payment_mode: paymentMode,
            late_grace_minutes: 11,
            late_deduction_multiplier: 0.5,
            overtime_multiplier: (nameHeader.includes('OVER TIME નથી') || specialRules.includes('OVER TIME નથી')) ? 0 : 2.0,
            overtime_allowed: (nameHeader.includes('OVER TIME નથી') || specialRules.includes('OVER TIME નથી')) ? 0 : 1,
            min_overtime_minutes: 0,
            min_overtime_deduction_minutes: 0,
            special_rules: specialRules || null,
            salary_history_json: salaryHistory.length > 0 ? JSON.stringify(salaryHistory) : null,
            wop: existingDb?.wop || 0,
            ypl: existingDb?.ypl || 0
          });
          employeesUpserted++;

          // Parse attendance rows
          let attStartRow = 3;
          for (let r = 2; r <= 5; r++) {
            const cellB = sheet[`B${r}`];
            if (cellB && ['P', 'P ', 'A', 'WO', 'WOP', 'HD', 'L'].includes(String(cellB.v || '').trim())) {
              attStartRow = r;
              break;
            }
          }

          for (let r = attStartRow; r < attStartRow + 32; r++) {
            const dateVal = sheet[`A${r}`]?.v;
            const isoDate = this.parseExcelDateToISO(dateVal);
            if (!isoDate) continue;

            const paVal = String(sheet[`B${r}`]?.v || 'A').trim().toUpperCase();
            const inTimeVal = CalculationEngine.formatTimeString(sheet[`H${r}`]?.v);
            const outTimeVal = CalculationEngine.formatTimeString(sheet[`I${r}`]?.v);
            const breakOutVal = CalculationEngine.formatTimeString(sheet[`K${r}`]?.v);
            const breakInVal = CalculationEngine.formatTimeString(sheet[`L${r}`]?.v);

            const leaveVal = sheet[`W${r}`]?.v ? parseFloat(sheet[`W${r}`].v) : 0;
            const penaltyVal = sheet[`X${r}`]?.v ? parseFloat(sheet[`X${r}`].v) : 0;

            const otVal = sheet[`Q${r}`]?.v;
            let otMins = 0;
            if (typeof otVal === 'number') {
              otMins = Math.round(otVal * 1440);
            } else if (otVal) {
              otMins = CalculationEngine.timeToMinutes(otVal);
            }

            const existingAtt = checkAttStmt.get(empCode, isoDate);
            if (existingAtt) {
              attendanceUpdated++;
            } else {
              attendanceInserted++;
            }

            upsertAttStmt.run({
              employee_code: empCode,
              attendance_date: sheet[`A${r}`]?.w || isoDate,
              attendance_date_iso: isoDate,
              employee_name: existingDb?.employee_name || empName,
              designation: existingDb?.designation || '',
              department: existingDb?.department || 'General',
              in_time: inTimeVal,
              out_time: outTimeVal,
              break_out: breakOutVal,
              break_in: breakInVal,
              status_code: paVal,
              leave_deduction: leaveVal,
              penalty_amount: penaltyVal,
              overtime_override_minutes: otMins,
              remarks: null
            });
          }
        } catch (sheetErr) {
          errors.push({ sheet: sheetName, error: sheetErr.message });
        }
      }
    });

    transaction();

    // Log import
    const logStmt = db.prepare(`
      INSERT INTO import_logs (
        filename, file_type, total_rows, inserted_count,
        updated_count, skipped_count, error_count, details, imported_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    logStmt.run(
      originalFilename,
      'EXCEL WORKBOOK',
      empSheets.length,
      employeesUpserted,
      attendanceInserted + attendanceUpdated,
      0,
      errors.length,
      JSON.stringify({ employeesUpserted, attendanceInserted, attendanceUpdated, errors: errors.slice(0, 10) }),
      importedBy
    );

    return {
      filename: originalFilename,
      totalSheets: empSheets.length,
      employeesUpserted,
      attendanceInserted,
      attendanceUpdated,
      errorCount: errors.length,
      errors
    };
  }


  /**
   * Update Employee Master Manual Fields
   */
  static updateEmployee(employeeCode, updateData) {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM employees WHERE employee_code = ?').get(employeeCode.toString());
    if (!existing) {
      throw new Error(`Employee with code ${employeeCode} not found`);
    }

    const stdHours = updateData.standard_work_hours !== undefined
      ? parseFloat(updateData.standard_work_hours)
      : existing.standard_work_hours;
    const salary = updateData.salary !== undefined
      ? parseFloat(updateData.salary)
      : existing.salary;

    // Recalculate default rates if not explicitly passed
    let hourlyRate = updateData.hourly_rate !== undefined
      ? parseFloat(updateData.hourly_rate)
      : existing.hourly_rate;
    let dailyRate = updateData.daily_rate !== undefined
      ? parseFloat(updateData.daily_rate)
      : existing.daily_rate;

    if ((!hourlyRate || hourlyRate <= 0) && salary > 0 && stdHours > 0) {
      const computed = CalculationEngine.getEmployeeRates({
        salary,
        standard_work_hours: stdHours,
        rate_type: updateData.rate_type || existing.rate_type || 'hourly'
      }, 30);
      hourlyRate = computed.hourlyRate;
      dailyRate = computed.dailyRate;
    }

    const stmt = db.prepare(`
      UPDATE employees SET
        employee_name = COALESCE(@employee_name, employee_name),
        device_code = COALESCE(@device_code, device_code),
        company = COALESCE(@company, company),
        department = COALESCE(@department, department),
        location = COALESCE(@location, location),
        designation = COALESCE(@designation, designation),
        grade = COALESCE(@grade, grade),
        team = COALESCE(@team, team),
        category = COALESCE(@category, category),
        employment_type = COALESCE(@employment_type, employment_type),
        gender = COALESCE(@gender, gender),
        doj = COALESCE(@doj, doj),
        doc = COALESCE(@doc, doc),
        dob = COALESCE(@dob, dob),
        rfid = COALESCE(@rfid, rfid),
        uid_no = COALESCE(@uid_no, uid_no),
        pan_no = COALESCE(@pan_no, pan_no),
        voter_id_no = COALESCE(@voter_id_no, voter_id_no),
        status = COALESCE(@status, status),
        dor = COALESCE(@dor, dor),
        holiday_group = COALESCE(@holiday_group, holiday_group),
        shift_group_code = COALESCE(@shift_group_code, shift_group_code),
        salary = @salary,
        standard_in_time = COALESCE(@standard_in_time, standard_in_time),
        standard_out_time = COALESCE(@standard_out_time, standard_out_time),
        standard_break_minutes = COALESCE(@standard_break_minutes, standard_break_minutes),
        standard_work_hours = @standard_work_hours,
        rate_type = COALESCE(@rate_type, rate_type),
        hourly_rate = @hourly_rate,
        daily_rate = @daily_rate,
        payment_mode = COALESCE(@payment_mode, payment_mode),
        late_grace_minutes = COALESCE(@late_grace_minutes, late_grace_minutes),
        late_deduction_multiplier = COALESCE(@late_deduction_multiplier, late_deduction_multiplier),
        overtime_multiplier = COALESCE(@overtime_multiplier, overtime_multiplier),
        overtime_allowed = COALESCE(@overtime_allowed, overtime_allowed),
        min_overtime_minutes = COALESCE(@min_overtime_minutes, min_overtime_minutes),
        min_overtime_deduction_minutes = COALESCE(@min_overtime_deduction_minutes, min_overtime_deduction_minutes),
        special_rules = COALESCE(@special_rules, special_rules),
        salary_history_json = COALESCE(@salary_history_json, salary_history_json),
        wop = COALESCE(@wop, wop),
        ypl = COALESCE(@ypl, ypl),
        updated_at = CURRENT_TIMESTAMP
      WHERE employee_code = @employee_code
    `);

    stmt.run({
      employee_code: employeeCode.toString(),
      employee_name: updateData.employee_name ?? existing.employee_name,
      device_code: updateData.device_code ?? existing.device_code,
      company: updateData.company ?? existing.company,
      department: updateData.department ?? existing.department,
      location: updateData.location ?? existing.location,
      designation: updateData.designation ?? existing.designation,
      grade: updateData.grade ?? existing.grade,
      team: updateData.team ?? existing.team,
      category: updateData.category ?? existing.category,
      employment_type: updateData.employment_type ?? existing.employment_type,
      gender: updateData.gender ?? existing.gender,
      doj: updateData.doj ?? existing.doj,
      doc: updateData.doc ?? existing.doc,
      dob: updateData.dob ?? existing.dob,
      rfid: updateData.rfid ?? existing.rfid,
      uid_no: updateData.uid_no ?? existing.uid_no,
      pan_no: updateData.pan_no ?? existing.pan_no,
      voter_id_no: updateData.voter_id_no ?? existing.voter_id_no,
      status: updateData.status ?? existing.status,
      dor: updateData.dor ?? existing.dor,
      holiday_group: updateData.holiday_group ?? existing.holiday_group,
      shift_group_code: updateData.shift_group_code ?? existing.shift_group_code,
      salary: salary,
      standard_in_time: updateData.standard_in_time ?? existing.standard_in_time,
      standard_out_time: updateData.standard_out_time ?? existing.standard_out_time,
      standard_break_minutes: updateData.standard_break_minutes ?? existing.standard_break_minutes,
      standard_work_hours: stdHours,
      rate_type: updateData.rate_type ?? existing.rate_type,
      hourly_rate: hourlyRate,
      daily_rate: dailyRate,
      payment_mode: updateData.payment_mode ?? existing.payment_mode,
      late_grace_minutes: updateData.late_grace_minutes ?? existing.late_grace_minutes,
      late_deduction_multiplier: updateData.late_deduction_multiplier ?? existing.late_deduction_multiplier,
      overtime_multiplier: updateData.overtime_multiplier ?? existing.overtime_multiplier,
      overtime_allowed: updateData.overtime_allowed !== undefined ? (updateData.overtime_allowed ? 1 : 0) : existing.overtime_allowed,
      min_overtime_minutes: updateData.min_overtime_minutes !== undefined ? (parseInt(updateData.min_overtime_minutes, 10) || 0) : existing.min_overtime_minutes,
      min_overtime_deduction_minutes: updateData.min_overtime_deduction_minutes !== undefined ? (parseInt(updateData.min_overtime_deduction_minutes, 10) || 0) : existing.min_overtime_deduction_minutes,
      special_rules: updateData.special_rules ?? existing.special_rules,
      salary_history_json: updateData.salary_history_json !== undefined ? (typeof updateData.salary_history_json === 'object' ? JSON.stringify(updateData.salary_history_json) : updateData.salary_history_json) : existing.salary_history_json,
      wop: updateData.wop !== undefined ? parseFloat(updateData.wop) : existing.wop,
      ypl: updateData.ypl !== undefined ? parseFloat(updateData.ypl) : existing.ypl
    });

    return this.getEmployeeByCode(employeeCode);
  }

  /**
   * Create a new Employee Master record
   */
  static createEmployee(data) {
    const db = getDatabase();
    if (!data.employee_code || !data.employee_name) {
      throw new Error('Employee Code and Employee Name are required');
    }

    const existing = db.prepare('SELECT employee_code FROM employees WHERE employee_code = ?').get(data.employee_code.toString());
    if (existing) {
      throw new Error(`Employee with code ${data.employee_code} already exists`);
    }

    const stdHours = data.standard_work_hours ? parseFloat(data.standard_work_hours) : 12.0;
    const salary = data.salary ? parseFloat(data.salary) : null;
    let hourlyRate = data.hourly_rate ? parseFloat(data.hourly_rate) : null;
    let dailyRate = data.daily_rate ? parseFloat(data.daily_rate) : null;

    if ((!hourlyRate || hourlyRate <= 0) && salary > 0 && stdHours > 0) {
      const computed = CalculationEngine.getEmployeeRates({
        salary,
        standard_work_hours: stdHours,
        rate_type: data.rate_type || 'hourly'
      }, 30);
      hourlyRate = computed.hourlyRate;
      dailyRate = computed.dailyRate;
    }

    const stmt = db.prepare(`
      INSERT INTO employees (
        employee_code, employee_name, device_code, company, department,
        location, designation, grade, team, category,
        employment_type, gender, doj, doc, dob,
        rfid, uid_no, pan_no, voter_id_no, status,
        dor, holiday_group, shift_group_code,
        salary, standard_in_time, standard_out_time, standard_break_minutes, standard_work_hours,
        rate_type, hourly_rate, daily_rate, payment_mode,
        late_grace_minutes, late_deduction_multiplier, overtime_multiplier, overtime_allowed,
        min_overtime_minutes, min_overtime_deduction_minutes, special_rules, salary_history_json,
        wop, ypl
      ) VALUES (
        @employee_code, @employee_name, @device_code, @company, @department,
        @location, @designation, @grade, @team, @category,
        @employment_type, @gender, @doj, @doc, @dob,
        @rfid, @uid_no, @pan_no, @voter_id_no, @status,
        @dor, @holiday_group, @shift_group_code,
        @salary, @standard_in_time, @standard_out_time, @standard_break_minutes, @standard_work_hours,
        @rate_type, @hourly_rate, @daily_rate, @payment_mode,
        @late_grace_minutes, @late_deduction_multiplier, @overtime_multiplier, @overtime_allowed,
        @min_overtime_minutes, @min_overtime_deduction_minutes, @special_rules, @salary_history_json,
        @wop, @ypl
      )
    `);

    stmt.run({
      employee_code: data.employee_code.toString().trim(),
      employee_name: data.employee_name.trim(),
      device_code: data.device_code || data.employee_code.toString().trim(),
      company: data.company || 'Global Ivf Hospital',
      department: data.department || 'General',
      location: data.location || 'Default',
      designation: data.designation || null,
      grade: data.grade || null,
      team: data.team || null,
      category: data.category || 'HospitalStaff',
      employment_type: data.employment_type || null,
      gender: data.gender || 'Not Specified',
      doj: data.doj || null,
      doc: data.doc || null,
      dob: data.dob || null,
      rfid: data.rfid || null,
      uid_no: data.uid_no || null,
      pan_no: data.pan_no || null,
      voter_id_no: data.voter_id_no || null,
      status: data.status || 'Working',
      dor: data.dor || null,
      holiday_group: data.holiday_group || null,
      shift_group_code: data.shift_group_code || null,
      salary: salary,
      standard_in_time: data.standard_in_time || '08:00',
      standard_out_time: data.standard_out_time || '20:00',
      standard_break_minutes: parseInt(data.standard_break_minutes, 10) || 0,
      standard_work_hours: stdHours,
      rate_type: data.rate_type || 'hourly',
      hourly_rate: hourlyRate,
      daily_rate: dailyRate,
      payment_mode: data.payment_mode || 'Bank',
      late_grace_minutes: parseInt(data.late_grace_minutes, 10) || 11,
      late_deduction_multiplier: parseFloat(data.late_deduction_multiplier) || 0.5,
      overtime_multiplier: parseFloat(data.overtime_multiplier) || 2.0,
      overtime_allowed: data.overtime_allowed !== undefined ? (data.overtime_allowed ? 1 : 0) : 1,
      min_overtime_minutes: parseInt(data.min_overtime_minutes, 10) || 0,
      min_overtime_deduction_minutes: parseInt(data.min_overtime_deduction_minutes, 10) || 0,
      special_rules: data.special_rules || null,
      salary_history_json: data.salary_history_json ? (typeof data.salary_history_json === 'object' ? JSON.stringify(data.salary_history_json) : data.salary_history_json) : null,
      wop: parseFloat(data.wop) || 0,
      ypl: parseFloat(data.ypl) || 0
    });

    return this.getEmployeeByCode(data.employee_code);
  }


  /**
   * Get filtered and paginated list of employees
   */
  static getEmployees({
    search = '',
    department = '',
    status = '',
    gender = '',
    page = 1,
    limit = 20,
    sortBy = 'employee_code',
    sortOrder = 'asc'
  }) {
    const db = getDatabase();

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(`(
        employee_code LIKE ? OR 
        employee_name LIKE ? OR 
        department LIKE ? OR 
        designation LIKE ? OR
        device_code LIKE ?
      )`);
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (department && department.trim() !== '' && department !== 'All') {
      conditions.push('department = ?');
      params.push(department.trim());
    }

    if (status && status.trim() !== '' && status !== 'All') {
      conditions.push('status = ?');
      params.push(status.trim());
    }

    if (gender && gender.trim() !== '' && gender !== 'All') {
      conditions.push('gender = ?');
      params.push(gender.trim());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const allowedSortColumns = {
      'employee_code': 'CAST(employee_code AS INTEGER)',
      'employee_name': 'employee_name',
      'department': 'department',
      'designation': 'designation',
      'status': 'status',
      'doj': 'doj',
      'gender': 'gender',
      'salary': 'salary'
    };

    const sortColumnSql = allowedSortColumns[sortBy] || 'CAST(employee_code AS INTEGER)';
    const sortDir = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const countSql = `SELECT COUNT(*) as total FROM employees ${whereClause}`;
    const total = db.prepare(countSql).get(...params).total;

    const dataSql = `
      SELECT * FROM employees
      ${whereClause}
      ORDER BY ${sortColumnSql} ${sortDir}
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
   * Get single employee by EmployeeCode
   */
  static getEmployeeByCode(code) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM employees WHERE employee_code = ?').get(code.toString());
  }

  /**
   * Get distinct departments list
   */
  static getDepartments() {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT DISTINCT department 
      FROM employees 
      WHERE department IS NOT NULL AND department != '' 
      ORDER BY department ASC
    `).all();
    return rows.map(r => r.department);
  }

  /**
   * Get Dashboard & Hospital KPI Stats
   */
  static getStats() {
    const db = getDatabase();

    const totals = db.prepare(`
      SELECT 
        COUNT(*) as totalEmployees,
        SUM(CASE WHEN status = 'Working' THEN 1 ELSE 0 END) as activeWorking,
        SUM(CASE WHEN status = 'Resigned' THEN 1 ELSE 0 END) as resigned,
        COUNT(DISTINCT department) as totalDepartments
      FROM employees
    `).get();

    const departmentStats = db.prepare(`
      SELECT 
        department,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Working' THEN 1 ELSE 0 END) as working,
        SUM(CASE WHEN status = 'Resigned' THEN 1 ELSE 0 END) as resigned
      FROM employees
      WHERE department IS NOT NULL AND department != ''
      GROUP BY department
      ORDER BY total DESC
    `).all();

    const genderStats = db.prepare(`
      SELECT 
        COALESCE(gender, 'Not Specified') as gender,
        COUNT(*) as count
      FROM employees
      GROUP BY gender
      ORDER BY count DESC
    `).all();

    const recentImports = db.prepare(`
      SELECT * FROM import_logs
      ORDER BY created_at DESC
      LIMIT 5
    `).all();

    return {
      overview: {
        totalEmployees: totals.totalEmployees || 0,
        activeWorking: totals.activeWorking || 0,
        resigned: totals.resigned || 0,
        totalDepartments: totals.totalDepartments || 0
      },
      departmentStats,
      genderStats,
      recentImports
    };
  }

  /**
   * Clear all employee master data (for reset or test purposes)
   */
  static clearEmployees() {
    const db = getDatabase();
    db.prepare('DELETE FROM employees').run();
    db.prepare('DELETE FROM import_logs').run();
    return { success: true, message: 'Employee master data cleared successfully' };
  }
}

module.exports = EmployeeService;
