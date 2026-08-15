const { getDatabase } = require('../config/database');

function clearAttendanceData() {
  const db = getDatabase();

  const beforeAtt = db.prepare('SELECT COUNT(*) as count FROM attendance').get().count;
  const beforeEmp = db.prepare('SELECT COUNT(*) as count FROM employees').get().count;

  // 1. Delete all attendance transaction records
  const delAttendance = db.prepare('DELETE FROM attendance').run();

  // 2. Delete attendance import logs (keeping master import logs)
  const delLogs = db.prepare("DELETE FROM import_logs WHERE file_type = 'attendance'").run();

  // 3. Reclaim disk space
  db.exec('VACUUM;');

  const afterAtt = db.prepare('SELECT COUNT(*) as count FROM attendance').get().count;
  const afterEmp = db.prepare('SELECT COUNT(*) as count FROM employees').get().count;

  console.log('----------------------------------------------------');
  console.log('✅ ATTENDANCE TRANSACTION DATA CLEARED SUCCESSFULLY');
  console.log('----------------------------------------------------');
  console.log(`Deleted Attendance Records: ${delAttendance.changes}`);
  console.log(`Attendance Records Before: ${beforeAtt} -> After: ${afterAtt}`);
  console.log(`Employee Master Records: ${afterEmp} (Preserved intact)`);
  console.log('----------------------------------------------------');
}

clearAttendanceData();
