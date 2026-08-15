const express = require('express');
const router = express.Router();
const EmployeeController = require('../controllers/employeeController');
const upload = require('../middleware/upload');
const { authenticateToken } = require('../middleware/auth');

// All employee routes are protected by JWT authentication
router.use(authenticateToken);

// Master Data & Workbook Imports
router.post('/import', upload.single('file'), EmployeeController.importFile);
router.post('/import-workbook', upload.single('file'), EmployeeController.importWorkbookFile);

// Query & Filter Employees
router.get('/', EmployeeController.getEmployees);
router.get('/stats', EmployeeController.getStats);
router.get('/departments', EmployeeController.getDepartments);
router.get('/:code', EmployeeController.getEmployeeByCode);

// Create & Update
router.post('/', EmployeeController.createEmployee);
router.put('/:code', EmployeeController.updateEmployee);

// Clear data (Admin tool)
router.delete('/clear', EmployeeController.clearEmployees);

module.exports = router;
