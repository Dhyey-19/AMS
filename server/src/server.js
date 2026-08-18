const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
require('dotenv').config();

const { getDatabase } = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');

const app = express();
const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 5050;

// Initialize SQLite Database
try {
  getDatabase();
  console.log('📦 Local SQLite database (ams.db) initialized successfully.');
} catch (err) {
  console.error('❌ Failed to initialize SQLite database:', err);
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(morgan('dev'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'Global IVF Hospital - AMS',
    timestamp: new Date().toISOString()
  });
});

const fs = require('fs');

// Serve frontend in production (Monolithic setup)
const possibleClientPaths = [
  process.env.CLIENT_DIST_PATH,
  path.resolve(__dirname, 'client_dist'),
  path.resolve(process.cwd(), 'client_dist'),
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(process.cwd(), 'client/dist')
].filter(Boolean);

const clientBuildPath = possibleClientPaths.find(p => fs.existsSync(p)) || path.resolve(process.cwd(), 'client_dist');
app.use(express.static(clientBuildPath));

app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(clientBuildPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <title>Global IVF Hospital - AMS Backend</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 2.5rem; border-radius: 16px; border: 1px solid #334155; text-align: center; max-width: 480px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
            h1 { color: #38bdf8; font-size: 1.5rem; margin-bottom: 0.5rem; }
            p { color: #94a3b8; line-height: 1.6; }
            .badge { display: inline-block; background: #0369a1; color: #e0f2fe; padding: 4px 12px; border-radius: 9999px; font-size: 0.85rem; font-weight: 600; margin-top: 1rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🏥 Global IVF Hospital</h1>
            <p><strong>Attendance Management System (AMS)</strong></p>
            <p>Backend API server is running on port ${PORT}. Run <code>npm run build</code> or start the client development server.</p>
            <div class="badge">API Ready: /api/health</div>
          </div>
        </body>
        </html>
      `);
    }
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

app.listen(PORT, HOST, () => {
  const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  const url = `http://${displayHost}:${PORT}`;
  console.log(`🚀 AMS Server is running at ${url}`);
  console.log(`🏥 Global IVF Hospital - Attendance Management System`);

  // Auto-open browser in standalone/pkg mode
  if (process.env.AUTO_OPEN !== 'false' && (process.pkg || process.env.NODE_ENV === 'production')) {
    setTimeout(() => {
      try {
        const cmd = process.platform === 'win32' ? `start ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
        require('child_process').exec(cmd);
      } catch (e) {}
    }, 1200);
  }
});
