import React, { useState, useEffect, useCallback } from 'react';
import { employeeApi } from '../services/api';
import { EmployeeTable } from '../components/employees/EmployeeTable';
import { EmployeeDetailsModal } from '../components/employees/EmployeeDetailsModal';
import { MasterDataImportModal } from '../components/employees/MasterDataImportModal';
import { Toast } from '../components/common/Toast';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  FileText, 
  Users, 
  CheckCircle2, 
  RefreshCw,
  Trash2
} from 'lucide-react';

export const MasterDataPage = () => {
  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedGender, setSelectedGender] = useState('All');
  const [sortBy, setSortBy] = useState('employee_code');
  const [sortOrder, setSortOrder] = useState('asc');
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [importingSample, setImportingSample] = useState(false);

  const fetchEmployees = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const res = await employeeApi.getAll({
        search,
        department: selectedDepartment,
        status: selectedStatus,
        gender: selectedGender,
        page,
        limit: pagination.limit,
        sortBy,
        sortOrder
      });
      setEmployees(res.data || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch employees:', err);
      setToast({ message: 'Failed to load employee records', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [search, selectedDepartment, selectedStatus, selectedGender, sortBy, sortOrder, pagination.limit]);

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
    // Debounce search/filter queries
    const timer = setTimeout(() => {
      fetchEmployees(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchEmployees]);

  const handlePageChange = (newPage) => {
    fetchEmployees(newPage);
  };

  const handleSort = (column, direction) => {
    setSortBy(column);
    setSortOrder(direction);
  };

  const handleImportSampleDirect = async () => {
    try {
      setImportingSample(true);
      const res = await employeeApi.importSample('upsert');
      setToast({
        message: `Sample imported: ${res.data.inserted} inserted, ${res.data.updated} updated, 0 duplicates!`,
        type: 'success'
      });
      fetchEmployees(1);
      fetchDepartments();
    } catch (err) {
      setToast({ message: err.message || 'Sample import failed', type: 'error' });
    } finally {
      setImportingSample(false);
    }
  };

  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to clear all imported master data?')) {
      try {
        await employeeApi.clear();
        setToast({ message: 'Employee master data cleared successfully', type: 'info' });
        fetchEmployees(1);
        fetchDepartments();
      } catch (err) {
        setToast({ message: 'Failed to clear data', type: 'error' });
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Action Banner Card */}
      <div 
        className="card"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          borderColor: '#334155'
        }}
      >
        <div 
          style={{
            padding: '1.5rem 1.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.25rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div 
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
              }}
            >
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h2 style={{ color: '#ffffff', fontSize: '1.25rem', fontWeight: '700' }}>
                Master Employee Data Center
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.8125rem', marginTop: '0.2rem' }}>
                Import staff roster from <code>MD MASTER.csv</code> or custom Excel/CSV spreadsheets. Automatic duplicate detection based on <code>EmployeeCode</code>.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleImportSampleDirect}
              disabled={importingSample}
              style={{ background: '#334155', color: '#f8fafc', borderColor: '#475569' }}
            >
              {importingSample ? (
                <>
                  <RefreshCw size={15} className="animate-pulse" />
                  Loading Sample...
                </>
              ) : (
                <>
                  <FileText size={15} color="#38bdf8" />
                  Load Sample (MD MASTER.csv)
                </>
              )}
            </button>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => setIsImportModalOpen(true)}
            >
              <UploadCloud size={15} />
              Upload CSV / Excel
            </button>

            {employees.length > 0 && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleClearData}
                style={{ background: 'transparent', color: '#fda4af', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                title="Clear all records"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Employee Table with Filters & Pagination */}
      <EmployeeTable
        employees={employees}
        pagination={pagination}
        departments={departments}
        search={search}
        setSearch={setSearch}
        selectedDepartment={selectedDepartment}
        setSelectedDepartment={setSelectedDepartment}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        selectedGender={selectedGender}
        setSelectedGender={setSelectedGender}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onPageChange={handlePageChange}
        onSelectEmployee={(emp) => setSelectedEmployee(emp)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        loading={loading}
      />

      {/* Employee Details Modal */}
      <EmployeeDetailsModal
        isOpen={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        employee={selectedEmployee}
      />

      {/* Master Data Import Modal */}
      <MasterDataImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => {
          fetchEmployees(1);
          fetchDepartments();
          setToast({ message: 'Master Data successfully imported into SQLite database!', type: 'success' });
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
