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
   * Helper to parse break time in either "HH:MM" (e.g. "01:00", "00:30") or minutes (e.g. 60)
   */
  static parseBreakTimeToMinutes(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'string' && val.includes(':')) {
      const parts = val.split(':');
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      return h * 60 + m;
    }
    const num = parseFloat(val);
    if (isNaN(num)) return 0;
    // If decimal <= 12 and has decimal point (like 0.5, 1.0, 1.5, 2.0), treat as hours
    if (num <= 12 && String(val).includes('.')) {
      return Math.round(num * 60);
    }
    return Math.round(num);
  }

  /**
   * Helper to parse standard work hours from "HH:MM" or decimal numbers
   */
  static parseWorkHours(val, defaultVal = 12.0) {
    if (val === null || val === undefined || val === '') return defaultVal;
    if (typeof val === 'string' && val.includes(':')) {
      const parts = val.split(':');
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      return Number((h + m / 60).toFixed(4));
    }
    const num = parseFloat(val);
    return isNaN(num) || num <= 0 ? defaultVal : Number(num.toFixed(4));
  }

  /**
   * Parse either a CSV or XLSX file into an object containing main rows and optional WEF rows
   */
  static async parseFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.xlsx' || ext === '.xls') {
      const workbook = xlsx.readFile(filePath);
      const preferredNames = ['Employee Master Data', 'Master Data', 'Employees', 'Staff', 'Master'];
      let targetSheetName = workbook.SheetNames.find(n => preferredNames.includes(n.trim())) || workbook.SheetNames[0];
      const sheet = workbook.Sheets[targetSheetName];
      const mainRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

      // Check if there is also a WEF History sheet
      const wefSheetName = workbook.SheetNames.find(n => ['WEF History Revisions', 'WEF History', 'WEF Revisions', 'WEF'].includes(n.trim()));
      let wefRows = [];
      if (wefSheetName && wefSheetName !== targetSheetName) {
        const wefSheet = workbook.Sheets[wefSheetName];
        wefRows = xlsx.utils.sheet_to_json(wefSheet, { defval: '' });
      }

      return { mainRows, wefRows, isMultiSheet: !!wefRows.length };
    }

    // CSV Parsing
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve({ mainRows: results, wefRows: [], isMultiSheet: false }))
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

    const employeeCode = normalized['employeecode'] || normalized['code'] || normalized['empid'] || normalized['id'] || normalized['empcode'] || normalized['staffid'] || normalized['staffcode'];
    const employeeName = normalized['employeename'] || normalized['name'] || normalized['empname'] || normalized['staffname'];

    if (!employeeCode || !employeeName) {
      return null;
    }

    const salary = normalized['salary'] !== undefined && normalized['salary'] !== null && normalized['salary'] !== '' 
      ? parseFloat(normalized['salary']) 
      : (normalized['monthlysalary'] ? parseFloat(normalized['monthlysalary']) : (normalized['basesalary'] ? parseFloat(normalized['basesalary']) : null));

    const stdIn = CalculationEngine.formatTimeString(
      normalized['standardintime'] || normalized['intime'] || normalized['schedin'] || normalized['schedintime'] || normalized['shiftin'] || normalized['standardin'] || '08:00'
    ) || '08:00';

    const stdOut = CalculationEngine.formatTimeString(
      normalized['standardouttime'] || normalized['outtime'] || normalized['schedout'] || normalized['schedouttime'] || normalized['shiftout'] || normalized['standardout'] || '20:00'
    ) || '20:00';

    const rawBreak = normalized['standardbreaktime'] || normalized['standardbreakminutes'] || normalized['breaktime'] || normalized['breakhours'] || normalized['breakminutes'] || normalized['break'] || normalized['stdbreak'] || 0;
    const stdBreak = this.parseBreakTimeToMinutes(rawBreak);
    
    let stdHours = 12.0;
    if (normalized['standardworkhours'] || normalized['workhours'] || normalized['dailyworkhours'] || normalized['targethours'] || normalized['stdworkhours'] || normalized['stdhours']) {
      stdHours = this.parseWorkHours(
        normalized['standardworkhours'] || normalized['workhours'] || normalized['dailyworkhours'] || normalized['targethours'] || normalized['stdworkhours'] || normalized['stdhours'], 
        12.0
      );
    } else {
      const inM = CalculationEngine.timeToMinutes(stdIn);
      const outM = CalculationEngine.timeToMinutes(stdOut);
      let diff = outM >= inM ? (outM - inM) : (1440 - inM + outM);
      let workM = Math.max(0, diff - stdBreak);
      stdHours = workM > 0 ? Number((workM / 60).toFixed(4)) : 12.0;
    }

    const parsedDoj = this.parseExcelDateToISO(normalized['doj'] || normalized['dateofjoining'] || normalized['joiningdate']);
    const parsedDoc = this.parseExcelDateToISO(normalized['doc'] || normalized['dateofconfirmation'] || normalized['confirmationdate']);
    const parsedDob = this.parseExcelDateToISO(normalized['dob'] || normalized['dateofbirth'] || normalized['birthdate']);
    const parsedDor = this.parseExcelDateToISO(normalized['dor'] || normalized['dateofresignation'] || normalized['resigndate'] || normalized['leavingdate'] || normalized['dol']);
    const parsedWef = this.parseExcelDateToISO(normalized['wefdate'] || normalized['wef'] || normalized['effectivedate'] || normalized['w.e.f.'] || normalized['w.e.f']) || parsedDoj || null;

    let overtimeAllowed = 1;
    if (normalized['overtimeallowed'] !== undefined) {
      const otVal = String(normalized['overtimeallowed']).trim().toLowerCase();
      if (['0', 'no', 'false', 'n', 'disabled'].includes(otVal)) {
        overtimeAllowed = 0;
      }
    }

    return {
      employee_code: employeeCode.toString().trim(),
      employee_name: employeeName.toString().trim(),
      device_code: (normalized['devicecode'] || normalized['biocode'] || normalized['biometricid'] || employeeCode).toString().trim(),
      company: normalized['company'] || normalized['branch'] || normalized['hospital'] || 'Global Ivf Hospital',
      department: normalized['department'] || normalized['dept'] || normalized['division'] || 'General',
      location: normalized['location'] || normalized['site'] || 'Default',
      designation: normalized['designation'] || normalized['post'] || normalized['role'] || normalized['jobtitle'] || null,
      grade: normalized['grade'] || normalized['level'] || null,
      team: normalized['team'] || null,
      category: normalized['category'] || 'DefaultCategory',
      employment_type: normalized['employmenttype'] || normalized['emptype'] || null,
      gender: normalized['gender'] || normalized['sex'] || 'Not Specified',
      doj: parsedDoj,
      doc: parsedDoc,
      dob: parsedDob,
      rfid: normalized['rfid'] || normalized['rfidcard'] || normalized['cardno'] || null,
      uid_no: normalized['uidno'] || normalized['uid'] || normalized['aadhaarno'] || normalized['aadhaar'] || normalized['adharno'] || null,
      pan_no: normalized['panno'] || normalized['pan'] || normalized['pancard'] || null,
      voter_id_no: normalized['voteridno'] || normalized['voterid'] || normalized['voter'] || null,
      status: normalized['status'] || normalized['empstatus'] || 'Working',
      dor: parsedDor,
      holiday_group: normalized['holidaygroup'] || normalized['holiday'] || null,
      shift_group_code: normalized['shiftgroupcode'] || normalized['shiftgroup'] || normalized['shiftcode'] || null,
      salary: salary,
      incentive: normalized['incentive'] ? parseFloat(normalized['incentive']) : 0,
      wef_date: parsedWef,
      standard_in_time: stdIn,
      standard_out_time: stdOut,
      standard_break_minutes: stdBreak,
      standard_work_hours: stdHours,
      payment_mode: normalized['paymentmode'] || normalized['paymode'] || 'Bank',
      late_grace_minutes: normalized['lategraceminutes'] ? parseInt(normalized['lategraceminutes'], 10) : (normalized['grace'] ? parseInt(normalized['grace'], 10) : 11),
      late_deduction_multiplier: normalized['latedeductionmultiplier'] ? parseFloat(normalized['latedeductionmultiplier']) : (normalized['latepenalty'] ? parseFloat(normalized['latepenalty']) : 0.5),
      overtime_multiplier: normalized['overtimemultiplier'] ? parseFloat(normalized['overtimemultiplier']) : (normalized['otmultiplier'] ? parseFloat(normalized['otmultiplier']) : 2.0),
      overtime_allowed: overtimeAllowed,
      min_overtime_minutes: normalized['minovertimeminutes'] ? parseInt(normalized['minovertimeminutes'], 10) : (normalized['minot'] ? parseInt(normalized['minot'], 10) : 0),
      min_overtime_deduction_minutes: (normalized['minovertimedeductionminutes'] || normalized['minovertimededuction'] || normalized['overtimedeductionminutes'] || normalized['overtimededuction']) ? parseInt(normalized['minovertimedeductionminutes'] || normalized['minovertimededuction'] || normalized['overtimedeductionminutes'] || normalized['overtimededuction'], 10) : 0,
      special_rules: normalized['specialrules'] || normalized['rules'] || normalized['bondterms'] || normalized['remarks'] || normalized['notes'] || null,
      salary_history_json: normalized['salaryhistoryjson'] || null,
      wop: normalized['wop'] ? parseFloat(normalized['wop']) : (normalized['weeklyoffpresent'] ? parseFloat(normalized['weeklyoffpresent']) : 0),
      ypl: normalized['ypl'] ? parseFloat(normalized['ypl']) : (normalized['yearlypaidleave'] ? parseFloat(normalized['yearlypaidleave']) : 0)
    };
  }

  /**
   * Import master data from uploaded file with deduplication
   */
  static async importMasterData(filePath, originalFilename, mode = 'upsert', importedBy = 'Admin') {
    const parseResult = await this.parseFile(filePath);
    const rawRows = Array.isArray(parseResult) ? parseResult : (parseResult.mainRows || []);
    const extraWefRows = parseResult.wefRows || [];
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
        salary, incentive, wef_date, standard_in_time, standard_out_time, standard_break_minutes, standard_work_hours,
        payment_mode,
        late_grace_minutes, late_deduction_multiplier, overtime_multiplier, overtime_allowed,
        min_overtime_minutes, min_overtime_deduction_minutes, special_rules, salary_history_json,
        wop, ypl
      ) VALUES (
        @employee_code, @employee_name, @device_code, @company, @department,
        @location, @designation, @grade, @team, @category,
        @employment_type, @gender, @doj, @doc, @dob,
        @rfid, @uid_no, @pan_no, @voter_id_no, @status,
        @dor, @holiday_group, @shift_group_code,
        @salary, @incentive, @wef_date, @standard_in_time, @standard_out_time, @standard_break_minutes, @standard_work_hours,
        @payment_mode,
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
        doj = COALESCE(@doj, doj),
        doc = COALESCE(@doc, doc),
        dob = COALESCE(@dob, dob),
        rfid = COALESCE(@rfid, rfid),
        uid_no = COALESCE(@uid_no, uid_no),
        pan_no = COALESCE(@pan_no, pan_no),
        voter_id_no = COALESCE(@voter_id_no, voter_id_no),
        status = @status,
        dor = COALESCE(@dor, dor),
        holiday_group = COALESCE(@holiday_group, holiday_group),
        shift_group_code = COALESCE(@shift_group_code, shift_group_code),
        salary = COALESCE(@salary, salary),
        incentive = COALESCE(@incentive, incentive),
        wef_date = COALESCE(@wef_date, wef_date),
        standard_in_time = COALESCE(@standard_in_time, standard_in_time),
        standard_out_time = COALESCE(@standard_out_time, standard_out_time),
        standard_break_minutes = COALESCE(@standard_break_minutes, standard_break_minutes),
        standard_work_hours = COALESCE(@standard_work_hours, standard_work_hours),
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

    const upsertWefStmt = db.prepare(`
      INSERT INTO employee_wef_history (
        employee_code, effective_date, salary, incentive,
        standard_in_time, standard_out_time, standard_break_minutes, standard_work_hours,
        payment_mode, late_grace_minutes, late_deduction_multiplier,
        overtime_multiplier, overtime_allowed, min_overtime_minutes, min_overtime_deduction_minutes,
        special_rules, remarks
      ) VALUES (
        @employee_code, @effective_date, @salary, @incentive,
        @standard_in_time, @standard_out_time, @standard_break_minutes, @standard_work_hours,
        @payment_mode, @late_grace_minutes, @late_deduction_multiplier,
        @overtime_multiplier, @overtime_allowed, @min_overtime_minutes, @min_overtime_deduction_minutes,
        @special_rules, @remarks
      )
      ON CONFLICT(employee_code, effective_date) DO UPDATE SET
        salary = COALESCE(excluded.salary, employee_wef_history.salary),
        incentive = COALESCE(excluded.incentive, employee_wef_history.incentive),
        standard_in_time = COALESCE(excluded.standard_in_time, employee_wef_history.standard_in_time),
        standard_out_time = COALESCE(excluded.standard_out_time, employee_wef_history.standard_out_time),
        standard_break_minutes = COALESCE(excluded.standard_break_minutes, employee_wef_history.standard_break_minutes),
        standard_work_hours = COALESCE(excluded.standard_work_hours, employee_wef_history.standard_work_hours),
        payment_mode = COALESCE(excluded.payment_mode, employee_wef_history.payment_mode),
        special_rules = COALESCE(excluded.special_rules, employee_wef_history.special_rules),
        updated_at = CURRENT_TIMESTAMP
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
              upsertWefStmt.run({
                employee_code: emp.employee_code,
                effective_date: emp.wef_date || emp.doj || '1900-01-01',
                salary: emp.salary,
                incentive: emp.incentive || 0,
                standard_in_time: emp.standard_in_time || '08:00',
                standard_out_time: emp.standard_out_time || '20:00',
                standard_break_minutes: emp.standard_break_minutes || 0,
                standard_work_hours: emp.standard_work_hours || 12.0,
                payment_mode: emp.payment_mode || 'Bank',
                late_grace_minutes: emp.late_grace_minutes ?? 11,
                late_deduction_multiplier: emp.late_deduction_multiplier ?? 0.5,
                overtime_multiplier: emp.overtime_multiplier ?? 2.0,
                overtime_allowed: emp.overtime_allowed ?? 1,
                min_overtime_minutes: emp.min_overtime_minutes || 0,
                min_overtime_deduction_minutes: emp.min_overtime_deduction_minutes || 0,
                special_rules: emp.special_rules || null,
                remarks: 'Master Import'
              });
              updated++;
            }
          } else {
            insertStmt.run(emp);
            upsertWefStmt.run({
              employee_code: emp.employee_code,
              effective_date: emp.wef_date || emp.doj || '1900-01-01',
              salary: emp.salary,
              incentive: emp.incentive || 0,
              standard_in_time: emp.standard_in_time || '08:00',
              standard_out_time: emp.standard_out_time || '20:00',
              standard_break_minutes: emp.standard_break_minutes || 0,
              standard_work_hours: emp.standard_work_hours || 12.0,
              payment_mode: emp.payment_mode || 'Bank',
              late_grace_minutes: emp.late_grace_minutes ?? 11,
              late_deduction_multiplier: emp.late_deduction_multiplier ?? 0.5,
              overtime_multiplier: emp.overtime_multiplier ?? 2.0,
              overtime_allowed: emp.overtime_allowed ?? 1,
              min_overtime_minutes: emp.min_overtime_minutes || 0,
              min_overtime_deduction_minutes: emp.min_overtime_deduction_minutes || 0,
              special_rules: emp.special_rules || null,
              remarks: 'Master Import'
            });
            inserted++;
          }
        } catch (err) {
          errors.push({ row: idx + 2, error: err.message });
        }
      });

      // Also process secondary WEF revisions sheet if available in workbook
      if (extraWefRows && extraWefRows.length > 0) {
        extraWefRows.forEach(wRow => {
          try {
            const normW = {};
            for (const [k, v] of Object.entries(wRow)) {
              normW[this.normalizeKey(k)] = this.cleanValue(v);
            }
            const empCode = normW['employeecode'] || normW['code'] || normW['empid'];
            const effDate = this.parseExcelDateToISO(normW['effectivedate'] || normW['wefdate'] || normW['wef'] || normW['date']);
            if (!empCode || !effDate) return;

            const salary = normW['salary'] ? parseFloat(normW['salary']) : null;
            const incentive = normW['incentive'] ? parseFloat(normW['incentive']) : 0;
            const stdIn = CalculationEngine.formatTimeString(normW['standardintime'] || normW['intime'] || '08:00') || '08:00';
            const stdOut = CalculationEngine.formatTimeString(normW['standardouttime'] || normW['outtime'] || '20:00') || '20:00';
            const stdBreak = this.parseBreakTimeToMinutes(normW['standardbreaktime'] || normW['standardbreakminutes'] || normW['breaktime'] || 0);
            const stdHours = this.parseWorkHours(normW['standardworkhours'], 12.0);
            const payMode = normW['paymentmode'] || 'Bank';
            const remarks = normW['remarks'] || normW['revisionreason'] || normW['notes'] || 'Imported WEF Revision';

            upsertWefStmt.run({
              employee_code: empCode.toString().trim(),
              effective_date: effDate,
              salary,
              incentive,
              standard_in_time: stdIn,
              standard_out_time: stdOut,
              standard_break_minutes: stdBreak,
              standard_work_hours: stdHours,
              payment_mode: payMode,
              late_grace_minutes: normW['lategraceminutes'] ? parseInt(normW['lategraceminutes'], 10) : 11,
              late_deduction_multiplier: normW['latedeductionmultiplier'] ? parseFloat(normW['latedeductionmultiplier']) : 0.5,
              overtime_multiplier: normW['overtimemultiplier'] ? parseFloat(normW['overtimemultiplier']) : 2.0,
              overtime_allowed: normW['overtimeallowed'] !== undefined ? (['0', 'no', 'false', 'n'].includes(String(normW['overtimeallowed']).toLowerCase()) ? 0 : 1) : 1,
              min_overtime_minutes: normW['minovertimeminutes'] ? parseInt(normW['minovertimeminutes'], 10) : 0,
              min_overtime_deduction_minutes: normW['minovertimedeductionminutes'] ? parseInt(normW['minovertimedeductionminutes'], 10) : 0,
              special_rules: normW['specialrules'] || null,
              remarks
            });
          } catch (e) {}
        });
      }
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
        salary, incentive, standard_in_time, standard_out_time, standard_break_minutes, standard_work_hours,
        payment_mode,
        late_grace_minutes, late_deduction_multiplier, overtime_multiplier, overtime_allowed,
        min_overtime_minutes, min_overtime_deduction_minutes, special_rules, salary_history_json,
        wop, ypl
      ) VALUES (
        @employee_code, @employee_name, @device_code, @company, @department,
        @location, @designation, @grade, @team, @category,
        @employment_type, @gender, @doj, @status,
        @salary, @incentive, @standard_in_time, @standard_out_time, @standard_break_minutes, @standard_work_hours,
        @payment_mode,
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
        incentive = COALESCE(excluded.incentive, employees.incentive),
        standard_in_time = COALESCE(excluded.standard_in_time, employees.standard_in_time),
        standard_out_time = COALESCE(excluded.standard_out_time, employees.standard_out_time),
        standard_break_minutes = COALESCE(excluded.standard_break_minutes, employees.standard_break_minutes),
        standard_work_hours = COALESCE(excluded.standard_work_hours, employees.standard_work_hours),
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
            incentive: existingDb?.incentive || 0,
            standard_in_time: stdIn,
            standard_out_time: stdOut,
            standard_break_minutes: stdBreak,
            standard_work_hours: stdHours,
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
   * Helper to parse work hours from HH:MM string or float decimal
   */
  static parseWorkHours(val, defaultVal = 12.0) {
    if (val === null || val === undefined || val === '') return defaultVal;
    if (typeof val === 'string' && val.includes(':')) {
      const parts = val.split(':').map(Number);
      const h = parts[0] || 0;
      const m = parts[1] || 0;
      return Number((h + m / 60).toFixed(4));
    }
    const num = parseFloat(val);
    return isNaN(num) ? defaultVal : num;
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
      ? this.parseWorkHours(updateData.standard_work_hours, existing.standard_work_hours || 12.0)
      : existing.standard_work_hours;
    const salary = updateData.salary !== undefined
      ? (updateData.salary !== null && updateData.salary !== '' ? parseFloat(updateData.salary) : null)
      : existing.salary;
    const incentive = updateData.incentive !== undefined
      ? (updateData.incentive !== null && updateData.incentive !== '' ? parseFloat(updateData.incentive) : 0)
      : (existing.incentive || 0);

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
        incentive = @incentive,
        wef_date = COALESCE(@wef_date, wef_date),
        standard_in_time = COALESCE(@standard_in_time, standard_in_time),
        standard_out_time = COALESCE(@standard_out_time, standard_out_time),
        standard_break_minutes = COALESCE(@standard_break_minutes, standard_break_minutes),
        standard_work_hours = @standard_work_hours,
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

    const effectiveWefDate = updateData.wef_date || existing.wef_date || existing.doj || '1900-01-01';

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
      incentive: incentive,
      wef_date: effectiveWefDate,
      standard_in_time: updateData.standard_in_time ?? existing.standard_in_time,
      standard_out_time: updateData.standard_out_time ?? existing.standard_out_time,
      standard_break_minutes: updateData.standard_break_minutes ?? existing.standard_break_minutes,
      standard_work_hours: stdHours,
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

    // Upsert baseline W.E.F. entry in employee_wef_history
    try {
      db.prepare(`
        INSERT INTO employee_wef_history (
          employee_code, effective_date, salary, incentive,
          standard_in_time, standard_out_time, standard_break_minutes, standard_work_hours,
          payment_mode, late_grace_minutes, late_deduction_multiplier,
          overtime_multiplier, overtime_allowed, min_overtime_minutes, min_overtime_deduction_minutes,
          special_rules, remarks
        ) VALUES (
          @employee_code, @effective_date, @salary, @incentive,
          @standard_in_time, @standard_out_time, @standard_break_minutes, @standard_work_hours,
          @payment_mode, @late_grace_minutes, @late_deduction_multiplier,
          @overtime_multiplier, @overtime_allowed, @min_overtime_minutes, @min_overtime_deduction_minutes,
          @special_rules, @remarks
        )
        ON CONFLICT(employee_code, effective_date) DO UPDATE SET
          salary = excluded.salary,
          incentive = excluded.incentive,
          standard_in_time = excluded.standard_in_time,
          standard_out_time = excluded.standard_out_time,
          standard_break_minutes = excluded.standard_break_minutes,
          standard_work_hours = excluded.standard_work_hours,
          payment_mode = excluded.payment_mode,
          late_grace_minutes = excluded.late_grace_minutes,
          late_deduction_multiplier = excluded.late_deduction_multiplier,
          overtime_multiplier = excluded.overtime_multiplier,
          overtime_allowed = excluded.overtime_allowed,
          min_overtime_minutes = excluded.min_overtime_minutes,
          min_overtime_deduction_minutes = excluded.min_overtime_deduction_minutes,
          special_rules = excluded.special_rules,
          updated_at = CURRENT_TIMESTAMP
      `).run({
        employee_code: employeeCode.toString(),
        effective_date: effectiveWefDate,
        salary: salary,
        incentive: incentive,
        standard_in_time: updateData.standard_in_time ?? existing.standard_in_time ?? '08:00',
        standard_out_time: updateData.standard_out_time ?? existing.standard_out_time ?? '20:00',
        standard_break_minutes: updateData.standard_break_minutes ?? existing.standard_break_minutes ?? 0,
        standard_work_hours: stdHours,
        payment_mode: updateData.payment_mode ?? existing.payment_mode ?? 'Bank',
        late_grace_minutes: updateData.late_grace_minutes ?? existing.late_grace_minutes ?? 11,
        late_deduction_multiplier: updateData.late_deduction_multiplier ?? existing.late_deduction_multiplier ?? 0.5,
        overtime_multiplier: updateData.overtime_multiplier ?? existing.overtime_multiplier ?? 2.0,
        overtime_allowed: updateData.overtime_allowed !== undefined ? (updateData.overtime_allowed ? 1 : 0) : (existing.overtime_allowed ?? 1),
        min_overtime_minutes: updateData.min_overtime_minutes !== undefined ? (parseInt(updateData.min_overtime_minutes, 10) || 0) : (existing.min_overtime_minutes || 0),
        min_overtime_deduction_minutes: updateData.min_overtime_deduction_minutes !== undefined ? (parseInt(updateData.min_overtime_deduction_minutes, 10) || 0) : (existing.min_overtime_deduction_minutes || 0),
        special_rules: updateData.special_rules ?? existing.special_rules,
        remarks: 'Master Profile Update'
      });
    } catch (e) {
      console.error('Failed to sync W.E.F. on updateEmployee:', e.message);
    }

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

    const stdHours = data.standard_work_hours !== undefined
      ? this.parseWorkHours(data.standard_work_hours, 12.0)
      : 12.0;
    const salary = data.salary ? parseFloat(data.salary) : null;
    const incentive = data.incentive ? parseFloat(data.incentive) : 0;
    const effectiveWefDate = data.wef_date || data.doj || '1900-01-01';

    const stmt = db.prepare(`
      INSERT INTO employees (
        employee_code, employee_name, device_code, company, department,
        location, designation, grade, team, category,
        employment_type, gender, doj, doc, dob,
        rfid, uid_no, pan_no, voter_id_no, status,
        dor, holiday_group, shift_group_code,
        salary, incentive, wef_date, standard_in_time, standard_out_time, standard_break_minutes, standard_work_hours,
        payment_mode,
        late_grace_minutes, late_deduction_multiplier, overtime_multiplier, overtime_allowed,
        min_overtime_minutes, min_overtime_deduction_minutes, special_rules, salary_history_json,
        wop, ypl
      ) VALUES (
        @employee_code, @employee_name, @device_code, @company, @department,
        @location, @designation, @grade, @team, @category,
        @employment_type, @gender, @doj, @doc, @dob,
        @rfid, @uid_no, @pan_no, @voter_id_no, @status,
        @dor, @holiday_group, @shift_group_code,
        @salary, @incentive, @wef_date, @standard_in_time, @standard_out_time, @standard_break_minutes, @standard_work_hours,
        @payment_mode,
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
      incentive: incentive,
      wef_date: effectiveWefDate,
      standard_in_time: data.standard_in_time || '08:00',
      standard_out_time: data.standard_out_time || '20:00',
      standard_break_minutes: this.parseBreakTimeToMinutes(data.standard_break_time !== undefined ? data.standard_break_time : data.standard_break_minutes),
      standard_work_hours: stdHours,
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

    // Create initial W.E.F. revision
    try {
      db.prepare(`
        INSERT OR IGNORE INTO employee_wef_history (
          employee_code, effective_date, salary, incentive,
          standard_in_time, standard_out_time, standard_break_minutes, standard_work_hours,
          payment_mode, late_grace_minutes, late_deduction_multiplier,
          overtime_multiplier, overtime_allowed, min_overtime_minutes, min_overtime_deduction_minutes,
          special_rules, remarks
        ) VALUES (
          @employee_code, @effective_date, @salary, @incentive,
          @standard_in_time, @standard_out_time, @standard_break_minutes, @standard_work_hours,
          @payment_mode, @late_grace_minutes, @late_deduction_multiplier,
          @overtime_multiplier, @overtime_allowed, @min_overtime_minutes, @min_overtime_deduction_minutes,
          @special_rules, @remarks
        )
      `).run({
        employee_code: data.employee_code.toString().trim(),
        effective_date: effectiveWefDate,
        salary: salary,
        incentive: incentive,
        standard_in_time: data.standard_in_time || '08:00',
        standard_out_time: data.standard_out_time || '20:00',
        standard_break_minutes: this.parseBreakTimeToMinutes(data.standard_break_time !== undefined ? data.standard_break_time : data.standard_break_minutes),
        standard_work_hours: stdHours,
        payment_mode: data.payment_mode || 'Bank',
        late_grace_minutes: parseInt(data.late_grace_minutes, 10) || 11,
        late_deduction_multiplier: parseFloat(data.late_deduction_multiplier) || 0.5,
        overtime_multiplier: parseFloat(data.overtime_multiplier) || 2.0,
        overtime_allowed: data.overtime_allowed !== undefined ? (data.overtime_allowed ? 1 : 0) : 1,
        min_overtime_minutes: parseInt(data.min_overtime_minutes, 10) || 0,
        min_overtime_deduction_minutes: parseInt(data.min_overtime_deduction_minutes, 10) || 0,
        special_rules: data.special_rules || null,
        remarks: 'Initial Master Record'
      });
    } catch (e) {
      console.error('Failed to create initial W.E.F. on createEmployee:', e.message);
    }

    return this.getEmployeeByCode(data.employee_code);
  }


  /**
   * Get filtered and paginated list of employees with W.E.F. revision histories
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

    // Batch attach wef_history to employees
    if (data.length > 0) {
      const codes = data.map(e => String(e.employee_code));
      const placeholders = codes.map(() => '?').join(',');
      const wefRows = db.prepare(`
        SELECT * FROM employee_wef_history
        WHERE employee_code IN (${placeholders})
        ORDER BY effective_date DESC, id DESC
      `).all(...codes);

      const wefMap = new Map();
      for (const r of wefRows) {
        const key = String(r.employee_code).toLowerCase().trim();
        if (!wefMap.has(key)) wefMap.set(key, []);
        wefMap.get(key).push(r);
      }

      data.forEach(e => {
        const key = String(e.employee_code).toLowerCase().trim();
        e.wef_history = wefMap.get(key) || [];
      });
    }

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
   * Get single employee by EmployeeCode with W.E.F. history
   */
  static getEmployeeByCode(code) {
    const db = getDatabase();
    const emp = db.prepare('SELECT * FROM employees WHERE employee_code = ?').get(code.toString());
    if (emp) {
      emp.wef_history = db.prepare(`
        SELECT * FROM employee_wef_history
        WHERE employee_code = ?
        ORDER BY effective_date DESC, id DESC
      `).all(code.toString());
    }
    return emp;
  }

  /**
   * Get W.E.F. revisions history for an employee
   */
  static getWefHistory(employeeCode) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM employee_wef_history
      WHERE employee_code = ?
      ORDER BY effective_date DESC, id DESC
    `).all(employeeCode.toString());
  }

  /**
   * Add a new W.E.F. revision entry for an employee
   */
  static addWefRevision(employeeCode, wefData) {
    const db = getDatabase();
    const emp = db.prepare('SELECT * FROM employees WHERE employee_code = ?').get(employeeCode.toString());
    if (!emp) {
      throw new Error(`Employee with code ${employeeCode} not found`);
    }

    if (!wefData.effective_date || String(wefData.effective_date).trim() === '') {
      throw new Error('Effective Date (W.E.F.) is required');
    }

    const effectiveDate = String(wefData.effective_date).trim();
    const stdHours = wefData.standard_work_hours !== undefined
      ? this.parseWorkHours(wefData.standard_work_hours, emp.standard_work_hours || 12.0)
      : (emp.standard_work_hours || 12.0);
    const salary = wefData.salary !== undefined && wefData.salary !== null && wefData.salary !== ''
      ? parseFloat(wefData.salary)
      : emp.salary;
    const incentive = wefData.incentive !== undefined && wefData.incentive !== null && wefData.incentive !== ''
      ? parseFloat(wefData.incentive)
      : (emp.incentive || 0);

    const stdBreak = this.parseBreakTimeToMinutes(
      wefData.standard_break_time !== undefined ? wefData.standard_break_time : (wefData.standard_break_minutes !== undefined ? wefData.standard_break_minutes : emp.standard_break_minutes)
    );

    const stmt = db.prepare(`
      INSERT INTO employee_wef_history (
        employee_code, effective_date, salary, incentive,
        standard_in_time, standard_out_time, standard_break_minutes, standard_work_hours,
        payment_mode, late_grace_minutes, late_deduction_multiplier,
        overtime_multiplier, overtime_allowed, min_overtime_minutes, min_overtime_deduction_minutes,
        special_rules, remarks
      ) VALUES (
        @employee_code, @effective_date, @salary, @incentive,
        @standard_in_time, @standard_out_time, @standard_break_minutes, @standard_work_hours,
        @payment_mode, @late_grace_minutes, @late_deduction_multiplier,
        @overtime_multiplier, @overtime_allowed, @min_overtime_minutes, @min_overtime_deduction_minutes,
        @special_rules, @remarks
      )
      ON CONFLICT(employee_code, effective_date) DO UPDATE SET
        salary = excluded.salary,
        incentive = excluded.incentive,
        standard_in_time = excluded.standard_in_time,
        standard_out_time = excluded.standard_out_time,
        standard_break_minutes = excluded.standard_break_minutes,
        standard_work_hours = excluded.standard_work_hours,
        payment_mode = excluded.payment_mode,
        late_grace_minutes = excluded.late_grace_minutes,
        late_deduction_multiplier = excluded.late_deduction_multiplier,
        overtime_multiplier = excluded.overtime_multiplier,
        overtime_allowed = excluded.overtime_allowed,
        min_overtime_minutes = excluded.min_overtime_minutes,
        min_overtime_deduction_minutes = excluded.min_overtime_deduction_minutes,
        special_rules = excluded.special_rules,
        remarks = excluded.remarks,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run({
      employee_code: employeeCode.toString(),
      effective_date: effectiveDate,
      salary,
      incentive,
      standard_in_time: wefData.standard_in_time || emp.standard_in_time || '08:00',
      standard_out_time: wefData.standard_out_time || emp.standard_out_time || '20:00',
      standard_break_minutes: stdBreak,
      standard_work_hours: stdHours,
      payment_mode: wefData.payment_mode || emp.payment_mode || 'Bank',
      late_grace_minutes: wefData.late_grace_minutes !== undefined ? parseInt(wefData.late_grace_minutes, 10) : (emp.late_grace_minutes ?? 11),
      late_deduction_multiplier: wefData.late_deduction_multiplier !== undefined ? parseFloat(wefData.late_deduction_multiplier) : (emp.late_deduction_multiplier ?? 0.5),
      overtime_multiplier: wefData.overtime_multiplier !== undefined ? parseFloat(wefData.overtime_multiplier) : (emp.overtime_multiplier ?? 2.0),
      overtime_allowed: wefData.overtime_allowed !== undefined ? (wefData.overtime_allowed ? 1 : 0) : (emp.overtime_allowed ?? 1),
      min_overtime_minutes: wefData.min_overtime_minutes !== undefined ? parseInt(wefData.min_overtime_minutes, 10) : (emp.min_overtime_minutes || 0),
      min_overtime_deduction_minutes: wefData.min_overtime_deduction_minutes !== undefined ? parseInt(wefData.min_overtime_deduction_minutes, 10) : (emp.min_overtime_deduction_minutes || 0),
      special_rules: wefData.special_rules !== undefined ? wefData.special_rules : emp.special_rules,
      remarks: wefData.remarks || 'Salary / Schedule Revision'
    });

    this.syncLatestWefToMaster(employeeCode);
    return this.getEmployeeByCode(employeeCode);
  }

  /**
   * Update an existing W.E.F. revision
   */
  static updateWefRevision(id, wefData) {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM employee_wef_history WHERE id = ?').get(id);
    if (!existing) {
      throw new Error(`W.E.F. revision with ID ${id} not found`);
    }

    const stdHours = wefData.standard_work_hours !== undefined
      ? this.parseWorkHours(wefData.standard_work_hours, existing.standard_work_hours || 12.0)
      : existing.standard_work_hours;
    const salary = wefData.salary !== undefined && wefData.salary !== null && wefData.salary !== ''
      ? parseFloat(wefData.salary)
      : existing.salary;
    const incentive = wefData.incentive !== undefined && wefData.incentive !== null && wefData.incentive !== ''
      ? parseFloat(wefData.incentive)
      : (existing.incentive || 0);

    const stdBreak = this.parseBreakTimeToMinutes(
      wefData.standard_break_time !== undefined ? wefData.standard_break_time : (wefData.standard_break_minutes !== undefined ? wefData.standard_break_minutes : existing.standard_break_minutes)
    );

    db.prepare(`
      UPDATE employee_wef_history SET
        effective_date = COALESCE(@effective_date, effective_date),
        salary = @salary,
        incentive = @incentive,
        standard_in_time = COALESCE(@standard_in_time, standard_in_time),
        standard_out_time = COALESCE(@standard_out_time, standard_out_time),
        standard_break_minutes = @standard_break_minutes,
        standard_work_hours = @standard_work_hours,
        payment_mode = COALESCE(@payment_mode, payment_mode),
        late_grace_minutes = COALESCE(@late_grace_minutes, late_grace_minutes),
        late_deduction_multiplier = COALESCE(@late_deduction_multiplier, late_deduction_multiplier),
        overtime_multiplier = COALESCE(@overtime_multiplier, overtime_multiplier),
        overtime_allowed = COALESCE(@overtime_allowed, overtime_allowed),
        min_overtime_minutes = COALESCE(@min_overtime_minutes, min_overtime_minutes),
        min_overtime_deduction_minutes = COALESCE(@min_overtime_deduction_minutes, min_overtime_deduction_minutes),
        special_rules = COALESCE(@special_rules, special_rules),
        remarks = COALESCE(@remarks, remarks),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({
      id,
      effective_date: wefData.effective_date ? String(wefData.effective_date).trim() : existing.effective_date,
      salary,
      incentive,
      standard_in_time: wefData.standard_in_time || existing.standard_in_time,
      standard_out_time: wefData.standard_out_time || existing.standard_out_time,
      standard_break_minutes: stdBreak,
      standard_work_hours: stdHours,
      payment_mode: wefData.payment_mode || existing.payment_mode,
      late_grace_minutes: wefData.late_grace_minutes !== undefined ? parseInt(wefData.late_grace_minutes, 10) : existing.late_grace_minutes,
      late_deduction_multiplier: wefData.late_deduction_multiplier !== undefined ? parseFloat(wefData.late_deduction_multiplier) : existing.late_deduction_multiplier,
      overtime_multiplier: wefData.overtime_multiplier !== undefined ? parseFloat(wefData.overtime_multiplier) : existing.overtime_multiplier,
      overtime_allowed: wefData.overtime_allowed !== undefined ? (wefData.overtime_allowed ? 1 : 0) : existing.overtime_allowed,
      min_overtime_minutes: wefData.min_overtime_minutes !== undefined ? parseInt(wefData.min_overtime_minutes, 10) : existing.min_overtime_minutes,
      min_overtime_deduction_minutes: wefData.min_overtime_deduction_minutes !== undefined ? parseInt(wefData.min_overtime_deduction_minutes, 10) : existing.min_overtime_deduction_minutes,
      special_rules: wefData.special_rules !== undefined ? wefData.special_rules : existing.special_rules,
      remarks: wefData.remarks !== undefined ? wefData.remarks : existing.remarks
    });

    this.syncLatestWefToMaster(existing.employee_code);
    return this.getEmployeeByCode(existing.employee_code);
  }

  /**
   * Delete a W.E.F. revision
   */
  static deleteWefRevision(id) {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM employee_wef_history WHERE id = ?').get(id);
    if (!existing) {
      throw new Error(`W.E.F. revision with ID ${id} not found`);
    }

    const count = db.prepare('SELECT COUNT(*) as count FROM employee_wef_history WHERE employee_code = ?').get(existing.employee_code).count;
    if (count <= 1) {
      throw new Error('Cannot delete the only W.E.F. revision for this employee. You can edit it instead.');
    }

    db.prepare('DELETE FROM employee_wef_history WHERE id = ?').run(id);
    this.syncLatestWefToMaster(existing.employee_code);

    return { success: true, message: 'W.E.F. revision deleted successfully' };
  }

  /**
   * Sync latest W.E.F. revision into employee master table
   */
  static syncLatestWefToMaster(employeeCode) {
    const db = getDatabase();
    const latest = db.prepare(`
      SELECT * FROM employee_wef_history
      WHERE employee_code = ?
      ORDER BY effective_date DESC, id DESC
      LIMIT 1
    `).get(employeeCode.toString());

    if (!latest) return;

    db.prepare(`
      UPDATE employees SET
        wef_date = @effective_date,
        salary = @salary,
        incentive = @incentive,
        standard_in_time = @standard_in_time,
        standard_out_time = @standard_out_time,
        standard_break_minutes = @standard_break_minutes,
        standard_work_hours = @standard_work_hours,
        payment_mode = @payment_mode,
        late_grace_minutes = @late_grace_minutes,
        late_deduction_multiplier = @late_deduction_multiplier,
        overtime_multiplier = @overtime_multiplier,
        overtime_allowed = @overtime_allowed,
        min_overtime_minutes = @min_overtime_minutes,
        min_overtime_deduction_minutes = @min_overtime_deduction_minutes,
        special_rules = COALESCE(@special_rules, special_rules),
        updated_at = CURRENT_TIMESTAMP
      WHERE employee_code = @employee_code
    `).run({
      employee_code: employeeCode.toString(),
      effective_date: latest.effective_date,
      salary: latest.salary,
      incentive: latest.incentive || 0,
      standard_in_time: latest.standard_in_time || '08:00',
      standard_out_time: latest.standard_out_time || '20:00',
      standard_break_minutes: latest.standard_break_minutes || 0,
      standard_work_hours: latest.standard_work_hours || 12.0,
      payment_mode: latest.payment_mode || 'Bank',
      late_grace_minutes: latest.late_grace_minutes ?? 11,
      late_deduction_multiplier: latest.late_deduction_multiplier ?? 0.5,
      overtime_multiplier: latest.overtime_multiplier ?? 2.0,
      overtime_allowed: latest.overtime_allowed ?? 1,
      min_overtime_minutes: latest.min_overtime_minutes || 0,
      min_overtime_deduction_minutes: latest.min_overtime_deduction_minutes || 0,
      special_rules: latest.special_rules || null
    });
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
   * Export Master Data with ALL fields and ALL records to XLSX or CSV Buffer
   */
  static exportMasterData({ format = 'xlsx', search = '', department = '', status = '', gender = '' }) {
    const db = getDatabase();
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

    // Query 100% of employees matching filter without pagination limit
    const employees = db.prepare(`
      SELECT * FROM employees
      ${whereClause}
      ORDER BY CAST(employee_code AS INTEGER) ASC, employee_code ASC
    `).all(...params);

    // Query all WEF revisions for matching employees
    const allWefRevisions = db.prepare(`
      SELECT w.*, e.employee_name, e.department, e.designation
      FROM employee_wef_history w
      LEFT JOIN employees e ON w.employee_code = e.employee_code
      ORDER BY CAST(w.employee_code AS INTEGER) ASC, w.employee_code ASC, w.effective_date DESC, w.id DESC
    `).all();

    const formatBreakHHMM = (mins) => {
      const m = parseInt(mins, 10) || 0;
      const h = Math.floor(m / 60);
      const rem = m % 60;
      return `${String(h).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
    };

    const formatHoursHHMM = (hrs) => {
      if (hrs === null || hrs === undefined || hrs === '') return '12:00';
      if (typeof hrs === 'string' && hrs.includes(':')) return hrs;
      const totalM = Math.round((parseFloat(hrs) || 12) * 60);
      const h = Math.floor(totalM / 60);
      const m = totalM % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const columnDefs = [
      { key: 'employee_code', label: 'EmployeeCode', width: 14 },
      { key: 'employee_name', label: 'EmployeeName', width: 28 },
      { key: 'device_code', label: 'DeviceCode', width: 14 },
      { key: 'company', label: 'Company', width: 22 },
      { key: 'department', label: 'Department', width: 22 },
      { key: 'location', label: 'Location', width: 16 },
      { key: 'designation', label: 'Designation', width: 24 },
      { key: 'grade', label: 'Grade', width: 12 },
      { key: 'team', label: 'Team', width: 14 },
      { key: 'category', label: 'Category', width: 18 },
      { key: 'employment_type', label: 'EmploymentType', width: 16 },
      { key: 'gender', label: 'Gender', width: 12 },
      { key: 'doj', label: 'DOJ', width: 14 },
      { key: 'doc', label: 'DOC', width: 14 },
      { key: 'dob', label: 'DOB', width: 14 },
      { key: 'rfid', label: 'RFID', width: 16 },
      { key: 'uid_no', label: 'UIDNo', width: 18 },
      { key: 'pan_no', label: 'PANNo', width: 16 },
      { key: 'voter_id_no', label: 'VoterIDNo', width: 16 },
      { key: 'status', label: 'Status', width: 14 },
      { key: 'dor', label: 'DOR', width: 14 },
      { key: 'holiday_group', label: 'HolidayGroup', width: 16 },
      { key: 'shift_group_code', label: 'ShiftGroupCode', width: 16 },
      { key: 'salary', label: 'Salary', width: 14 },
      { key: 'incentive', label: 'Incentive', width: 14 },
      { key: 'wef_date', label: 'WEFDate', width: 14 },
      { key: 'standard_in_time', label: 'StandardInTime', width: 16 },
      { key: 'standard_out_time', label: 'StandardOutTime', width: 16 },
      { key: 'standard_break_time', label: 'StandardBreakTime', width: 18 },
      { key: 'standard_break_minutes', label: 'StandardBreakMinutes', width: 20 },
      { key: 'standard_work_hours', label: 'StandardWorkHours', width: 18 },
      { key: 'payment_mode', label: 'PaymentMode', width: 16 },
      { key: 'late_grace_minutes', label: 'LateGraceMinutes', width: 18 },
      { key: 'late_deduction_multiplier', label: 'LateDeductionMultiplier', width: 22 },
      { key: 'overtime_multiplier', label: 'OvertimeMultiplier', width: 18 },
      { key: 'overtime_allowed', label: 'OvertimeAllowed', width: 16 },
      { key: 'min_overtime_minutes', label: 'MinOvertimeMinutes', width: 20 },
      { key: 'min_overtime_deduction_minutes', label: 'MinOvertimeDeductionMinutes', width: 26 },
      { key: 'wop', label: 'WOP', width: 10 },
      { key: 'ypl', label: 'YPL', width: 10 },
      { key: 'special_rules', label: 'SpecialRules', width: 35 }
    ];

    const mapEmployeeToRow = (emp) => ({
      employee_code: emp.employee_code || '',
      employee_name: emp.employee_name || '',
      device_code: emp.device_code || emp.employee_code || '',
      company: emp.company || 'Global Ivf Hospital',
      department: emp.department || 'General',
      location: emp.location || 'Default',
      designation: emp.designation || '',
      grade: emp.grade || '',
      team: emp.team || '',
      category: emp.category || 'HospitalStaff',
      employment_type: emp.employment_type || 'Full Time',
      gender: emp.gender || 'Not Specified',
      doj: emp.doj || '',
      doc: emp.doc || '',
      dob: emp.dob || '',
      rfid: emp.rfid || '',
      uid_no: emp.uid_no || '',
      pan_no: emp.pan_no || '',
      voter_id_no: emp.voter_id_no || '',
      status: emp.status || 'Working',
      dor: emp.dor || '',
      holiday_group: emp.holiday_group || '',
      shift_group_code: emp.shift_group_code || '',
      salary: emp.salary !== null && emp.salary !== undefined ? emp.salary : '',
      incentive: emp.incentive || 0,
      wef_date: emp.wef_date || emp.doj || '',
      standard_in_time: emp.standard_in_time || '08:00',
      standard_out_time: emp.standard_out_time || '20:00',
      standard_break_time: formatBreakHHMM(emp.standard_break_minutes || 0),
      standard_break_minutes: emp.standard_break_minutes || 0,
      standard_work_hours: formatHoursHHMM(emp.standard_work_hours || 12.0),
      payment_mode: emp.payment_mode || 'Bank',
      late_grace_minutes: emp.late_grace_minutes ?? 11,
      late_deduction_multiplier: emp.late_deduction_multiplier ?? 0.5,
      overtime_multiplier: emp.overtime_multiplier ?? 2.0,
      overtime_allowed: emp.overtime_allowed === 0 ? 'No' : 'Yes',
      min_overtime_minutes: emp.min_overtime_minutes || 0,
      min_overtime_deduction_minutes: emp.min_overtime_deduction_minutes || 0,
      wop: emp.wop || 0,
      ypl: emp.ypl || 0,
      special_rules: emp.special_rules || ''
    });

    const timestampStr = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const headers = columnDefs.map(c => c.label);
      const csvRows = [headers];

      employees.forEach(emp => {
        const rowData = mapEmployeeToRow(emp);
        csvRows.push(columnDefs.map(col => rowData[col.key]));
      });

      const csvContent = csvRows.map(row => 
        row.map(val => {
          const str = String(val ?? '');
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return `"${str}"`;
        }).join(',')
      ).join('\n');

      return {
        buffer: Buffer.from('\uFEFF' + csvContent, 'utf-8'),
        filename: `Global_IVF_Hospital_Master_Data_${timestampStr}.csv`,
        mimeType: 'text/csv; charset=utf-8'
      };
    }

    // XLSX generation with multiple worksheets
    const wb = xlsx.utils.book_new();

    // Sheet 1: Master Data
    const masterRows = [columnDefs.map(c => c.label)];
    employees.forEach(emp => {
      const rowData = mapEmployeeToRow(emp);
      masterRows.push(columnDefs.map(c => rowData[c.key]));
    });

    const wsMaster = xlsx.utils.aoa_to_sheet(masterRows);
    wsMaster['!cols'] = columnDefs.map(c => ({ wch: c.width }));
    xlsx.utils.book_append_sheet(wb, wsMaster, 'Employee Master Data');

    // Sheet 2: WEF History Timeline
    const wefCols = [
      { label: 'EmployeeCode', width: 14 },
      { label: 'EmployeeName', width: 28 },
      { label: 'Department', width: 20 },
      { label: 'Designation', width: 22 },
      { label: 'EffectiveDate (W.E.F.)', width: 20 },
      { label: 'Salary', width: 14 },
      { label: 'Incentive', width: 14 },
      { label: 'StandardInTime', width: 16 },
      { label: 'StandardOutTime', width: 16 },
      { label: 'StandardBreakTime', width: 18 },
      { label: 'StandardWorkHours', width: 18 },
      { label: 'PaymentMode', width: 16 },
      { label: 'Remarks / Revision Reason', width: 35 }
    ];

    const wefSheetRows = [wefCols.map(c => c.label)];
    allWefRevisions.forEach(w => {
      wefSheetRows.push([
        w.employee_code,
        w.employee_name || '',
        w.department || '',
        w.designation || '',
        w.effective_date,
        w.salary || 0,
        w.incentive || 0,
        w.standard_in_time || '08:00',
        w.standard_out_time || '20:00',
        formatBreakHHMM(w.standard_break_minutes || 0),
        formatHoursHHMM(w.standard_work_hours || 12.0),
        w.payment_mode || 'Bank',
        w.remarks || ''
      ]);
    });

    const wsWef = xlsx.utils.aoa_to_sheet(wefSheetRows);
    wsWef['!cols'] = wefCols.map(c => ({ wch: c.width }));
    xlsx.utils.book_append_sheet(wb, wsWef, 'WEF History Revisions');

    // Sheet 3: Template Instructions & Field Definitions
    const guideRows = [
      ['GLOBAL IVF HOSPITAL - ATTENDANCE MANAGEMENT SYSTEM (AMS)'],
      ['EMPLOYEE MASTER DATA TEMPLATE & FIELD DEFINITIONS'],
      [''],
      ['Field Name', 'Required?', 'Format / Accepted Values', 'Description'],
      ['EmployeeCode', 'YES', 'Text / Number (e.g. 1, 2, EMP001)', 'Unique identifier for employee in hospital master'],
      ['EmployeeName', 'YES', 'Full Name (e.g. DR. SHITAL PATEL)', 'Staff member full name'],
      ['DeviceCode', 'NO', 'Numeric / Biometric ID (e.g. 1, 101)', 'Biometric fingerprint/face ID device code'],
      ['Company', 'NO', 'Text (e.g. Global Ivf Hospital)', 'Hospital or branch name'],
      ['Department', 'NO', 'Text (e.g. Medical Officer, Nursing, Lab)', 'Hospital department'],
      ['Location', 'NO', 'Text (e.g. Default, Main Branch)', 'Branch location'],
      ['Designation', 'NO', 'Text (e.g. Doctor, Staff Nurse, Lab Tech)', 'Staff designation or job role'],
      ['Grade', 'NO', 'Text (e.g. Grade A, Senior)', 'Staff grade level'],
      ['Team', 'NO', 'Text (e.g. Day Team, Night Team)', 'Work team or shift group'],
      ['Category', 'NO', 'Text (e.g. HospitalStaff)', 'Staff classification category'],
      ['EmploymentType', 'NO', 'Text (e.g. Full Time, Part Time, Contract)', 'Employment type'],
      ['Gender', 'NO', 'Male / Female / Other', 'Gender of employee'],
      ['DOJ', 'NO', 'YYYY-MM-DD or DD/MM/YYYY (e.g. 2026-05-01)', 'Date of Joining'],
      ['DOC', 'NO', 'YYYY-MM-DD or DD/MM/YYYY', 'Date of Confirmation'],
      ['DOB', 'NO', 'YYYY-MM-DD or DD/MM/YYYY', 'Date of Birth'],
      ['RFID', 'NO', 'Text / Number', 'RFID card number'],
      ['UIDNo', 'NO', '12-Digit Aadhaar / UID number', 'Aadhaar identification number'],
      ['PANNo', 'NO', '10-Digit PAN number', 'Permanent Account Number'],
      ['VoterIDNo', 'NO', 'Voter card number', 'Voter card identification number'],
      ['Status', 'NO', 'Working / Resigned', 'Employment status'],
      ['DOR', 'NO', 'YYYY-MM-DD or DD/MM/YYYY', 'Date of Resignation'],
      ['HolidayGroup', 'NO', 'Text', 'Holiday calendar group'],
      ['ShiftGroupCode', 'NO', 'Text', 'Shift group identification code'],
      ['Salary', 'NO', 'Number (e.g. 25000, 35000, 50000)', 'Fixed base monthly salary (in INR ₹)'],
      ['Incentive', 'NO', 'Number (e.g. 1000, 2500)', 'Fixed monthly incentive (in INR ₹)'],
      ['WEFDate', 'NO', 'YYYY-MM-DD (e.g. 2026-05-01, 2026-05-15)', 'With Effect From date for salary & shift rules'],
      ['StandardInTime', 'NO', '24-Hr HH:MM (e.g. 08:00, 09:00, 20:00)', 'Scheduled shift start time'],
      ['StandardOutTime', 'NO', '24-Hr HH:MM (e.g. 20:00, 18:00, 08:00)', 'Scheduled shift end time'],
      ['StandardBreakTime', 'NO', '24-Hr HH:MM (e.g. 00:00, 00:30, 01:00, 02:00)', 'Daily standard lunch / tea break duration'],
      ['StandardBreakMinutes', 'NO', 'Number in minutes (e.g. 0, 30, 60, 120)', 'Standard break in minutes'],
      ['StandardWorkHours', 'NO', 'HH:MM or Decimal (e.g. 12:00, 08:00, 12)', 'Daily target working hours for salary calc'],
      ['PaymentMode', 'NO', 'Bank / Cheque / Cash / TDS / Cheque', 'Salary disbursement mode'],
      ['LateGraceMinutes', 'NO', 'Number (e.g. 11, 15, 0)', 'Grace minutes allowed before late penalty kicks in'],
      ['LateDeductionMultiplier', 'NO', 'Number (e.g. 0.5 for 50%, 1.0 for 100%)', 'Penalty factor multiplied by hourly rate for late hours'],
      ['OvertimeMultiplier', 'NO', 'Number (e.g. 2.0 for double rate, 1.5)', 'Multiplier for overtime hours worked'],
      ['OvertimeAllowed', 'NO', 'Yes / No / 1 / 0', 'Whether overtime payout is allowed (Disabled for Doctors)'],
      ['MinOvertimeMinutes', 'NO', 'Number in minutes (e.g. 0, 30)', 'Minimum threshold before overtime counts'],
      ['MinOvertimeDeductionMinutes', 'NO', 'Number in minutes (e.g. 0, 30)', 'Minimum deduction on overtime'],
      ['WOP', 'NO', 'Number of Days (e.g. 0, 1, 2)', 'Weekly Off Present entitlement days'],
      ['YPL', 'NO', 'Number of Days (e.g. 12, 15, 18)', 'Yearly Paid Leave entitlement days'],
      ['SpecialRules', 'NO', 'Text (e.g. Bond condition, Sunday off rules)', 'Specific rules from Excel workbook sheets']
    ];

    const wsGuide = xlsx.utils.aoa_to_sheet(guideRows);
    wsGuide['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 40 }, { wch: 55 }];
    xlsx.utils.book_append_sheet(wb, wsGuide, 'Template Instructions');

    const xlsxBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return {
      buffer: xlsxBuffer,
      filename: `Global_IVF_Hospital_Master_Data_${timestampStr}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
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
