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
router.get('/export', EmployeeController.exportMasterData);
router.get('/stats', EmployeeController.getStats);
router.get('/departments', EmployeeController.getDepartments);
router.get('/:code', EmployeeController.getEmployeeByCode);

// Create & Update
router.post('/', EmployeeController.createEmployee);
router.put('/:code', EmployeeController.updateEmployee);

// W.E.F. (With Effect From) Revision Management
router.get('/:code/wef', EmployeeController.getWefHistory);
router.post('/:code/wef', EmployeeController.addWefRevision);
router.put('/:code/wef/:id', EmployeeController.updateWefRevision);
router.delete('/:code/wef/:id', EmployeeController.deleteWefRevision);

// Clear data (Admin tool)
router.delete('/clear', EmployeeController.clearEmployees);

module.exports = router;
