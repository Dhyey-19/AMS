import React, { useState, useEffect, useCallback } from 'react';
import { attendanceApi, employeeApi } from '../services/api';
import { AttendanceTable } from '../components/attendance/AttendanceTable';
import { AttendanceImportModal } from '../components/attendance/AttendanceImportModal';
import { Toast } from '../components/common/Toast';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  Calendar, 
  Clock, 
  RefreshCw, 
  CheckCircle2, 
  Trash2,
  FileText
} from 'lucide-react';

export const AttendanceImportPage = () => {
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('attendance_date_iso');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [importingMay, setImportingMay] = useState(false);

  const fetchAttendance = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const res = await attendanceApi.getAll({
        search,
        department: selectedDepartment,
        statusCode: selectedStatus,
        startDate,
        endDate,
        page,
        limit: pagination.limit,
        sortBy,
        sortOrder
      });
      setRecords(res.data || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
      setToast({ message: 'Failed to load attendance logs', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [search, selectedDepartment, selectedStatus, startDate, endDate, sortBy, sortOrder, pagination.limit]);

  const fetchDepartments = async () => {
    try {
      const res = await employeeApi.getDepartments();
      setDepartments(res.data || []);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAttendance(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchAttendance]);

  const handlePageChange = (newPage) => {
    fetchAttendance(newPage);
  };

  const handleSort = (col, dir) => {
    setSortBy(col);
    setSortOrder(dir);
  };

  const handleImportMayDirect = async () => {
    try {
      setImportingMay(true);
      const res = await attendanceApi.importSample('MD MAY.csv');
      setToast({
        message: `MD MAY.csv imported: ${res.data.inserted} inserted, ${res.data.updated} updated on unique ID+Date!`,
        type: 'success'
      });
      fetchAttendance(1);
    } catch (err) {
      setToast({ message: err.message || 'Import failed', type: 'error' });
    } finally {
      setImportingMay(false);
    }
  };

  const handleClearAttendance = async () => {
    if (window.confirm('Are you sure you want to clear all imported attendance records?')) {
      try {
        await attendanceApi.clear();
        setToast({ message: 'All attendance records cleared', type: 'info' });
        fetchAttendance(1);
      } catch (err) {
        setToast({ message: 'Failed to clear attendance', type: 'error' });
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Action Banner Card - Clean Light Theme */}
      <div 
        className="card"
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div 
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--teal-600) 0%, var(--teal-700) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 10px rgba(13, 148, 136, 0.25)',
              flexShrink: 0
            }}
          >
            <Calendar size={22} />
          </div>
          <div>
            <h2 style={{ color: 'var(--slate-900)', fontSize: '1.15rem', fontWeight: '700', margin: 0 }}>
              Attendance Data Ingestion Center
            </h2>
            <p style={{ color: 'var(--slate-500)', fontSize: '0.8125rem', marginTop: '0.15rem', marginBottom: 0 }}>
              Upload biometric attendance CSV/XLSX spreadsheets. Automatic deduplication on <code>Employee ID + Date</code>.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-success btn-sm"
            onClick={handleImportMayDirect}
            disabled={importingMay}
          >
            {importingMay ? (
              <>
                <RefreshCw size={15} className="spin" />
                Loading MD MAY...
              </>
            ) : (
              <>
                <FileText size={15} />
                Load MD MAY.csv
              </>
            )}
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => setIsImportModalOpen(true)}
          >
            <UploadCloud size={15} />
            Upload File
          </button>

          {records.length > 0 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleClearAttendance}
              style={{ color: 'var(--danger-text)', borderColor: 'var(--danger-border)' }}
              title="Clear all attendance records"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Attendance Records Table */}
      <AttendanceTable
        records={records}
        pagination={pagination}
        departments={departments}
        search={search}
        setSearch={setSearch}
        selectedDepartment={selectedDepartment}
        setSelectedDepartment={setSelectedDepartment}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onPageChange={handlePageChange}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        loading={loading}
      />

      {/* Import Modal */}
      <AttendanceImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => {
          fetchAttendance(1);
          setToast({ message: 'Attendance records imported successfully!', type: 'success' });
        }}
      />

      {/* Toast Alert */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: 'success' })}
      />
    </div>
  );
};
