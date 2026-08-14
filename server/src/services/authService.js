const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');

class AuthService {
  static register({ username, password, fullName, email, role = 'Staff' }) {
    const db = getDatabase();
    
    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
    if (existing) {
      throw new Error('Username is already taken');
    }

    if (!password || password.length < 4) {
      throw new Error('Password must be at least 4 characters long');
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const stmt = db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, email)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      username.trim(),
      passwordHash,
      fullName ? fullName.trim() : username.trim(),
      role,
      email ? email.trim() : null
    );

    const newUser = db.prepare('SELECT id, username, full_name, role, email, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role: newUser.role, fullName: newUser.full_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return { user: newUser, token };
  }

  static login({ username, password }) {
    const db = getDatabase();
    
    if (!username || !password) {
      throw new Error('Please provide both username and password');
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
    if (!user) {
      throw new Error('Invalid username or password');
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      throw new Error('Invalid username or password');
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, fullName: user.full_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const userProfile = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      email: user.email,
      createdAt: user.created_at
    };

    return { user: userProfile, token };
  }

  static getProfile(userId) {
    const db = getDatabase();
    const user = db.prepare('SELECT id, username, full_name, role, email, created_at FROM users WHERE id = ?').get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      email: user.email,
      createdAt: user.created_at
    };
  }
}

module.exports = AuthService;
