const fs = require('fs');
const AttendanceService = require('../services/attendanceService');

class AttendanceController {
  /**
   * Upload & Import Attendance File
   */
  static async importFile(req, res) {
    let filePath = null;
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Please upload an attendance CSV or Excel file'
        });
      }

      filePath = req.file.path;
      const originalFilename = req.file.originalname;
      const importedBy = req.user ? req.user.username : 'Admin';

      const result = await AttendanceService.importAttendanceData(filePath, originalFilename, importedBy);

      return res.status(200).json({
        success: true,
        message: `Attendance imported successfully: ${result.inserted} new records inserted, ${result.updated} existing records updated.`,
        data: result
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to import attendance file'
      });
    } finally {
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('Failed to remove temp upload:', e);
        }
      }
    }
  }

  /**
   * Import Sample Month File (e.g. MD MAY.csv)
   */
  static async importSample(req, res) {
    try {
      const monthFileName = req.body.fileName || 'MD MAY.csv';
      const importedBy = req.user ? req.user.username : 'Admin';

      const result = await AttendanceService.importSampleMonth(monthFileName, importedBy);

      return res.status(200).json({
        success: true,
        message: `Sample ${monthFileName} imported successfully: ${result.inserted} inserted, ${result.updated} updated.`,
        data: result
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to import sample attendance'
      });
    }
  }

  /**
   * Single Employee Full Attendance Record & Calculations Sheet
   */
  static async getEmployeeSheet(req, res) {
    try {
      const { code } = req.params;
      const { month, startDate, endDate } = req.query;

      const sheetData = AttendanceService.getEmployeeAttendanceSheet(code, {
        month,
        startDate,
        endDate
      });

      return res.status(200).json({
        success: true,
        data: sheetData
      });
    } catch (err) {
      return res.status(404).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Export Single Employee Attendance Record to XLSX or CSV
   */
  static async exportEmployeeSheet(req, res) {
    try {
      const { code } = req.params;
      const { month, startDate, endDate, format = 'xlsx' } = req.query;

      const { buffer, filename, mimeType } = AttendanceService.exportEmployeeAttendance(code, {
        month,
        startDate,
        endDate,
        format
      });

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to export employee attendance'
      });
    }
  }

  /**
   * Query & Filter Attendance Records
   */
  static async getAttendance(req, res) {
    try {
      const {
        search,
        employeeCode,
        department,
        statusCode,
        startDate,
        endDate,
        page,
        limit,
        sortBy,
        sortOrder
      } = req.query;

      const result = AttendanceService.getAttendanceRecords({
        search,
        employeeCode,
        department,
        statusCode,
        startDate,
        endDate,
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
   * Daily Attendance Report
   */
  static async getDailyReport(req, res) {
    try {
      const { date, department } = req.query;
      const report = AttendanceService.getDailyReport(date, department);
      return res.status(200).json({
        success: true,
        data: report
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Monthly Summary Report
   */
  static async getMonthlyReport(req, res) {
    try {
      const { month, department } = req.query;
      const report = AttendanceService.getMonthlySummaryReport(month, department);
      return res.status(200).json({
        success: true,
        data: report
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Get available recorded months
   */
  static async getMonths(req, res) {
    try {
      const months = AttendanceService.getAvailableMonths();
      return res.status(200).json({
        success: true,
        data: months
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Clear all attendance data
   */
  static async clearAttendance(req, res) {
    try {
      const result = AttendanceService.clearAttendance();
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

module.exports = AttendanceController;
