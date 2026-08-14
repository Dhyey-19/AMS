const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Database path in project root
const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '../../../ams.db');

let db;

function getDatabase() {
  if (!db) {
    db = new Database(DB_PATH, { verbose: process.env.NODE_ENV === 'development' ? console.log : null });
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT DEFAULT 'Admin',
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Employees Master Data table
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      employee_code TEXT PRIMARY KEY COLLATE NOCASE,
      employee_name TEXT NOT NULL,
      device_code TEXT,
      company TEXT DEFAULT 'Global Ivf Hospital',
      department TEXT,
      location TEXT DEFAULT 'Default',
      designation TEXT,
      grade TEXT,
      team TEXT,
      category TEXT,
      employment_type TEXT,
      gender TEXT,
      doj TEXT,
      doc TEXT,
      dob TEXT,
      rfid TEXT,
      uid_no TEXT,
      pan_no TEXT,
      voter_id_no TEXT,
      status TEXT DEFAULT 'Working',
      dor TEXT,
      holiday_group TEXT,
      shift_group_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(employee_name);
    CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department);
    CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
  `);

  // Attendance Records table
  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_code TEXT NOT NULL COLLATE NOCASE,
      attendance_date TEXT NOT NULL,
      attendance_date_iso TEXT NOT NULL,
      employee_name TEXT,
      designation TEXT,
      department TEXT,
      begin_time TEXT,
      end_time TEXT,
      in_time TEXT,
      out_time TEXT,
      late_by TEXT DEFAULT '00:00',
      early_by TEXT DEFAULT '00:00',
      over_time TEXT DEFAULT '00:00',
      punch_records TEXT,
      shift_name TEXT,
      status_code TEXT NOT NULL DEFAULT 'A',
      total_duration TEXT DEFAULT '00:00',
      total_duration_minutes INTEGER DEFAULT 0,
      late_by_minutes INTEGER DEFAULT 0,
      early_by_minutes INTEGER DEFAULT 0,
      over_time_minutes INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employee_code, attendance_date_iso)
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance(employee_code, attendance_date_iso);
    CREATE INDEX IF NOT EXISTS idx_attendance_date_iso ON attendance(attendance_date_iso);
    CREATE INDEX IF NOT EXISTS idx_attendance_dept ON attendance(department);
    CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status_code);
  `);

  // Import logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS import_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      file_type TEXT NOT NULL,
      total_rows INTEGER DEFAULT 0,
      inserted_count INTEGER DEFAULT 0,
      updated_count INTEGER DEFAULT 0,
      skipped_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      details TEXT,
      imported_by TEXT DEFAULT 'Admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default admin user if no users exist
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123', salt);
    db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, email)
      VALUES (?, ?, ?, ?, ?)
    `).run('admin', hash, 'Hospital Administrator', 'Admin', 'admin@globalivf.com');
    console.log('✅ Default administrator seeded (username: admin, password: admin123)');
  }
}

module.exports = {
  getDatabase,
  initSchema
};
