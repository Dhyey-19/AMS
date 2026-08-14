const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const { getDatabase } = require('../config/database');

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
   * Parse either a CSV or XLSX file into an array of objects
   */
  static async parseFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.xlsx' || ext === '.xls') {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
      return rawRows;
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
   * Map raw row to standardized Employee Record
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

    return {
      employee_code: employeeCode.toString(),
      employee_name: employeeName,
      device_code: normalized['devicecode'] || employeeCode.toString(),
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
      shift_group_code: normalized['shiftgroupcode'] || null
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
        dor, holiday_group, shift_group_code
      ) VALUES (
        @employee_code, @employee_name, @device_code, @company, @department,
        @location, @designation, @grade, @team, @category,
        @employment_type, @gender, @doj, @doc, @dob,
        @rfid, @uid_no, @pan_no, @voter_id_no, @status,
        @dor, @holiday_group, @shift_group_code
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
        updated_at = CURRENT_TIMESTAMP
      WHERE employee_code = @employee_code
    `);

    // Execute within a single database transaction for maximum performance & atomicity
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

    // Save import log
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
   * Import sample file located in `excel files/MD MASTER.csv`
   */
  static async importSampleFile(mode = 'upsert', importedBy = 'Admin') {
    const samplePath = path.resolve(__dirname, '../../../excel files/MD MASTER.csv');
    if (!fs.existsSync(samplePath)) {
      throw new Error(`Sample file not found at: ${samplePath}`);
    }
    return this.importMasterData(samplePath, 'MD MASTER.csv', mode, importedBy);
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

    // Build WHERE clauses
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

    // Validate sort column to avoid SQL injection
    const allowedSortColumns = {
      'employee_code': 'CAST(employee_code AS INTEGER)',
      'employee_name': 'employee_name',
      'department': 'department',
      'designation': 'designation',
      'status': 'status',
      'doj': 'doj',
      'gender': 'gender'
    };

    const sortColumnSql = allowedSortColumns[sortBy] || 'CAST(employee_code AS INTEGER)';
    const sortDir = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // Get Total Count
    const countSql = `SELECT COUNT(*) as total FROM employees ${whereClause}`;
    const total = db.prepare(countSql).get(...params).total;

    // Get Paginated Data
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
