const fs = require('fs');
const EmployeeService = require('../services/employeeService');

class EmployeeController {
  /**
   * Upload and import Master Data file (CSV or XLSX)
   */
  static async importFile(req, res) {
    let filePath = null;
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Please upload a CSV or Excel file'
        });
      }

      filePath = req.file.path;
      const originalFilename = req.file.originalname;
      const mode = req.body.mode || 'upsert';
      const importedBy = req.user ? req.user.username : 'Admin';

      const result = await EmployeeService.importMasterData(filePath, originalFilename, mode, importedBy);

      return res.status(200).json({
        success: true,
        message: `Master Data imported successfully: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped.`,
        data: result
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to import Master Data'
      });
    } finally {
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('Failed to remove temp upload file:', e);
        }
      }
    }
  }

  /**
   * Upload & Import Full Multi-Sheet Workbook (e.g. MAY - 26.xlsx)
   */
  static async importWorkbookFile(req, res) {
    let filePath = null;
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Please upload an Excel workbook (.xlsx)'
        });
      }

      filePath = req.file.path;
      const originalFilename = req.file.originalname;
      const importedBy = req.user ? req.user.username : 'Admin';

      const result = await EmployeeService.importWorkbook(filePath, originalFilename, importedBy);

      return res.status(200).json({
        success: true,
        message: `Workbook processed: ${result.employeesUpserted} employee profiles updated, ${result.attendanceInserted} attendance records created, ${result.attendanceUpdated} updated.`,
        data: result
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to import Excel workbook'
      });
    } finally {
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('Failed to remove temp upload file:', e);
        }
      }
    }
  }

  /**
   * Import sample multi-sheet workbook from `excel files/MAY - 26.xlsx`
   */
  static async importSampleWorkbook(req, res) {
    try {
      const importedBy = req.user ? req.user.username : 'Admin';
      const result = await EmployeeService.importSampleWorkbook(importedBy);

      return res.status(200).json({
        success: true,
        message: `MAY - 26.xlsx imported successfully: ${result.employeesUpserted} employee profiles synced, ${result.attendanceInserted + result.attendanceUpdated} attendance records updated across ${result.totalSheets} sheets.`,
        data: result
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to import sample workbook'
      });
    }
  }

  /**
   * Import sample file from `excel files/MD MASTER.csv`
   */
  static async importSample(req, res) {
    try {
      const mode = req.body.mode || 'upsert';
      const importedBy = req.user ? req.user.username : 'Admin';

      const result = await EmployeeService.importSampleFile(mode, importedBy);

      return res.status(200).json({
        success: true,
        message: `Sample Master Data imported successfully: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped.`,
        data: result
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to import sample file'
      });
    }
  }

  /**
   * Get filtered & paginated employees
   */
  static async getEmployees(req, res) {
    try {
      const { search, department, status, gender, page, limit, sortBy, sortOrder } = req.query;
      const result = EmployeeService.getEmployees({
        search,
        department,
        status,
        gender,
        page,
        limit,
        sortBy,
        sortOrder
      });

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Get employee by code
   */
  static async getEmployeeByCode(req, res) {
    try {
      const { code } = req.params;
      const employee = EmployeeService.getEmployeeByCode(code);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: `Employee with code ${code} not found`
        });
      }
      return res.status(200).json({
        success: true,
        data: employee
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Create a new employee
   */
  static async createEmployee(req, res) {
    try {
      const newEmployee = EmployeeService.createEmployee(req.body);
      return res.status(201).json({
        success: true,
        message: `Employee ${newEmployee.employee_name} created successfully`,
        data: newEmployee
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Update employee master & attendance rules
   */
  static async updateEmployee(req, res) {
    try {
      const { code } = req.params;
      const updated = EmployeeService.updateEmployee(code, req.body);
      return res.status(200).json({
        success: true,
        message: `Employee ${updated.employee_name} updated successfully`,
        data: updated
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Get distinct departments
   */
  static async getDepartments(req, res) {
    try {
      const departments = EmployeeService.getDepartments();
      return res.status(200).json({
        success: true,
        data: departments
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Get Dashboard KPI Stats
   */
  static async getStats(req, res) {
    try {
      const stats = EmployeeService.getStats();
      return res.status(200).json({
        success: true,
        data: stats
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Clear all master data
   */
  static async clearEmployees(req, res) {
    try {
      const result = EmployeeService.clearEmployees();
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
}

module.exports = EmployeeController;
