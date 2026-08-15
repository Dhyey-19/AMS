import React, { useState, useEffect, useCallback } from 'react';
import { employeeApi } from '../services/api';
import { EmployeeTable } from '../components/employees/EmployeeTable';
import { EmployeeDetailsModal } from '../components/employees/EmployeeDetailsModal';
import { EditEmployeeMasterModal } from '../components/employees/EditEmployeeMasterModal';
import { MasterDataImportModal } from '../components/employees/MasterDataImportModal';
import { Toast } from '../components/common/Toast';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  Trash2
} from 'lucide-react';

export const MasterDataPage = ({ onNavigateToEmployeeAttendance }) => {
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
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success' });

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
              background: 'linear-gradient(135deg, var(--primary-600) 0%, var(--primary-700) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 10px rgba(2, 132, 199, 0.25)',
              flexShrink: 0
            }}
          >
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <h2 style={{ color: 'var(--slate-900)', fontSize: '1.15rem', fontWeight: '700', margin: 0 }}>
              Employee Master Data & Rules Center
            </h2>
            <p style={{ color: 'var(--slate-500)', fontSize: '0.8125rem', marginTop: '0.15rem', marginBottom: 0 }}>
              Maintain employee master profiles, shift timings, individual salary rates, late/overtime rules, and bond conditions.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setIsImportModalOpen(true)}
          >
            <UploadCloud size={15} />
            Upload File / Workbook
          </button>

          {employees.length > 0 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleClearData}
              style={{ color: 'var(--danger-text)', borderColor: 'var(--danger-border)' }}
              title="Clear all master data"
            >
              <Trash2 size={15} />
              Clear Master Data
            </button>
          )}
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
      {selectedEmployee && (
        <EmployeeDetailsModal
          isOpen={!!selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          employee={selectedEmployee}
          onOpenAttendanceSheet={onNavigateToEmployeeAttendance}
          onEditMaster={(emp) => setEditingEmployee(emp)}
        />
      )}

      {/* Edit Employee Master Modal */}
      {editingEmployee && (
        <EditEmployeeMasterModal
          isOpen={!!editingEmployee}
          onClose={() => setEditingEmployee(null)}
          employee={editingEmployee}
          onUpdated={() => {
            fetchEmployees(pagination.page);
            fetchDepartments();
          }}
        />
      )}

      {/* Master Data Import Modal */}
      <MasterDataImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => {
          fetchEmployees(1);
          fetchDepartments();
          setToast({ message: 'File successfully processed and imported into database!', type: 'success' });
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
