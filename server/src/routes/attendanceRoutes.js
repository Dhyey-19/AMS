const express = require('express');
const router = express.Router();
const AttendanceController = require('../controllers/attendanceController');
const upload = require('../middleware/upload');
const { authenticateToken } = require('../middleware/auth');

// Protect all routes with JWT token
router.use(authenticateToken);

// Import endpoints
router.post('/parse-headers', upload.single('file'), AttendanceController.parseHeaders);
router.post('/import', upload.single('file'), AttendanceController.importFile);

// List & Filter records
router.get('/', AttendanceController.getAttendance);
router.get('/months', AttendanceController.getMonths);

// Employee-Wise Attendance Record & Calculations Sheet
router.get('/employee/:code/sheet', AttendanceController.getEmployeeSheet);
router.get('/employee/:code/export', AttendanceController.exportEmployeeSheet);
router.put('/employee/:code/date/:dateIso', AttendanceController.updateRecord);

// Reports endpoints
router.get('/reports/daily', AttendanceController.getDailyReport);
router.get('/reports/monthly', AttendanceController.getMonthlyReport);
router.get('/reports/range', AttendanceController.getRangeReport);
router.get('/reports/employee/:code', AttendanceController.getEmployeeReport);

// Delete batch & clear data
router.post('/delete-batch', AttendanceController.deleteBatch);
router.delete('/clear', AttendanceController.clearAttendance);

module.exports = router;
