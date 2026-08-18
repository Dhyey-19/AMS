const fs = require('fs');
const AttendanceService = require('../services/attendanceService');

class AttendanceController {
  /**
   * Parse Attendance File Headers, Sample Rows & Suggested Mappings
   */
  static async parseHeaders(req, res) {
    let filePath = null;
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Please upload an attendance CSV or Excel file'
        });
      }

      filePath = req.file.path;
      const sheetName = req.body.sheetName || req.query.sheetName || null;
      const data = await AttendanceService.parseFileHeaders(filePath, sheetName);

      return res.status(200).json({
        success: true,
        data: {
          filename: req.file.originalname,
          size: req.file.size,
          ...data
        }
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to read headers from file'
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
   * Upload & Import Attendance File with Column Mapping
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

      let columnMapping = null;
      if (req.body.columnMapping) {
        try {
          columnMapping = typeof req.body.columnMapping === 'string'
            ? JSON.parse(req.body.columnMapping)
            : req.body.columnMapping;
        } catch (e) {
          columnMapping = null;
        }
      }

      const sheetName = req.body.sheetName || null;

      const result = await AttendanceService.importAttendanceData(
        filePath,
        originalFilename,
        importedBy,
        columnMapping,
        sheetName
      );

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
   * Update or directly edit an individual attendance record in the database
   */
  static async updateRecord(req, res) {
    try {
      const { code, dateIso } = req.params;
      const updateData = req.body;

      if (!code || !dateIso) {
        return res.status(400).json({
          success: false,
          message: 'Employee code and attendance date (ISO) are required'
        });
      }

      const updated = AttendanceService.updateAttendanceRecord(code, dateIso, updateData);
      return res.status(200).json({
        success: true,
        message: 'Attendance record updated successfully in database',
        data: updated
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to update attendance record'
      });
    }
  }

  /**
   * Delete batch of attendance records by array of IDs or matching filters
   */
  static async deleteBatch(req, res) {
    try {
      let { ids, selectAllMatching, filters } = req.body || {};

      // Handle cases where the whole object was passed in ids
      if (ids && typeof ids === 'object' && !Array.isArray(ids)) {
        selectAllMatching = ids.selectAllMatching !== undefined ? ids.selectAllMatching : selectAllMatching;
        filters = ids.filters || filters;
        ids = ids.ids;
      }

      if (!selectAllMatching && (!ids || !Array.isArray(ids) || ids.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an array of attendance record IDs to delete or specify selectAllMatching'
        });
      }

      const result = AttendanceService.deleteBatchAttendance({ ids, selectAllMatching, filters });
      return res.status(200).json({
        success: true,
        message: `Successfully deleted ${result.deletedCount} attendance record(s)`,
        deletedCount: result.deletedCount
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to delete attendance records'
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
