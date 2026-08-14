const express = require('express');
const router = express.Router();
const AttendanceController = require('../controllers/attendanceController');
const upload = require('../middleware/upload');
const { authenticateToken } = require('../middleware/auth');

// Protect all routes with JWT token
router.use(authenticateToken);

// Import endpoints
router.post('/import', upload.single('file'), AttendanceController.importFile);
router.post('/import-sample', AttendanceController.importSample);

// List & Filter records
router.get('/', AttendanceController.getAttendance);
router.get('/months', AttendanceController.getMonths);

// Reports endpoints
router.get('/reports/daily', AttendanceController.getDailyReport);
router.get('/reports/monthly', AttendanceController.getMonthlyReport);
router.get('/reports/range', AttendanceController.getRangeReport);
router.get('/reports/employee/:code', AttendanceController.getEmployeeReport);

// Clear data
router.delete('/clear', AttendanceController.clearAttendance);

module.exports = router;
