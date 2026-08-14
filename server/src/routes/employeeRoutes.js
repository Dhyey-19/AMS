const express = require('express');
const router = express.Router();
const EmployeeController = require('../controllers/employeeController');
const upload = require('../middleware/upload');
const { authenticateToken } = require('../middleware/auth');

// All employee routes are protected by JWT authentication
router.use(authenticateToken);

// Master Data Import
router.post('/import', upload.single('file'), EmployeeController.importFile);
router.post('/import-sample', EmployeeController.importSample);

// Query & Filter Employees
router.get('/', EmployeeController.getEmployees);
router.get('/stats', EmployeeController.getStats);
router.get('/departments', EmployeeController.getDepartments);
router.get('/:code', EmployeeController.getEmployeeByCode);

// Clear data (Admin tool)
router.delete('/clear', EmployeeController.clearEmployees);

module.exports = router;
