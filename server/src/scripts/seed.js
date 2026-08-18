const { getDatabase } = require('../config/database');
const bcrypt = require('bcryptjs');

function seedDatabase() {
  console.log('🌱 Seeding & Verifying SQLite Database (ams.db)...');
  const db = getDatabase();

  const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get('admin');
  if (!user) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123', salt);
    db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, email)
      VALUES (?, ?, ?, ?, ?)
    `).run('admin', hash, 'Hospital Administrator', 'Admin', 'admin@globalivf.com');
    console.log('✅ Admin user created: username="admin", password="admin123"');
  } else {
    console.log('ℹ️ Admin user already exists (username: admin).');
  }

  const empCount = db.prepare('SELECT COUNT(*) as count FROM employees').get().count;
  const attCount = db.prepare('SELECT COUNT(*) as count FROM attendance').get().count;

  console.log(`📊 Current Database Stats:`);
  console.log(`   - Employees: ${empCount}`);
  console.log(`   - Attendance Records: ${attCount}`);
  console.log('✅ Database is ready.');
}

seedDatabase();
