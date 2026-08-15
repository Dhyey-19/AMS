import React, { useState } from 'react';
import { StatusBadge, DepartmentBadge } from '../common/Badge';
import { Pagination } from '../common/Pagination';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  Eye, 
  Users, 
  Download, 
  FileSpreadsheet 
} from 'lucide-react';

export const EmployeeTable = ({
  employees = [],
  pagination,
  departments = [],
  search,
  setSearch,
  selectedDepartment,
  setSelectedDepartment,
  selectedStatus,
  setSelectedStatus,
  selectedGender,
  setSelectedGender,
  sortBy,
  sortOrder,
  onSort,
  onPageChange,
  onSelectEmployee,
  onOpenImportModal,
  loading = false
}) => {
  const handleHeaderSort = (columnKey) => {
    if (sortBy === columnKey) {
      onSort(columnKey, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(columnKey, 'asc');
    }
  };

  const handleExportCSV = () => {
    if (!employees || employees.length === 0) return;

    const headers = [
      'EmployeeCode', 'EmployeeName', 'DeviceCode', 'Department', 'Designation',
      'Gender', 'DOJ', 'Status', 'DOR', 'ShiftGroupCode'
    ];

    const rows = employees.map(emp => [
      `"${emp.employee_code || ''}"`,
      `"${emp.employee_name || ''}"`,
      `"${emp.device_code || ''}"`,
      `"${emp.department || ''}"`,
      `"${emp.designation || ''}"`,
      `"${emp.gender || ''}"`,
      `"${emp.doj || ''}"`,
      `"${emp.status || ''}"`,
      `"${emp.dor || ''}"`,
      `"${emp.shift_group_code || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `global_ivf_master_data_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Table Toolbar / Filters */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
        <div className="table-toolbar" style={{ marginBottom: '1rem' }}>
          {/* Search Box */}
          <div className="table-search-box">
            <Search className="search-input-icon" size={18} />
            <input
              type="text"
              className="table-search-input"
              placeholder="Search by name, employee code, designation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleExportCSV}
              disabled={employees.length === 0}
              title="Export visible records to CSV"
            >
              <Download size={15} />
              Export
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={onOpenImportModal}
            >
              <FileSpreadsheet size={15} />
              Import CSV / Excel
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="table-filter-group">
          {/* Department Filter */}
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: '180px', padding: '0.45rem 0.75rem', fontSize: '0.8125rem' }}
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
          >
            <option value="All">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: '140px', padding: '0.45rem 0.75rem', fontSize: '0.8125rem' }}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Working">Working Only</option>
            <option value="Resigned">Resigned Only</option>
          </select>

          {/* Gender Filter */}
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: '130px', padding: '0.45rem 0.75rem', fontSize: '0.8125rem' }}
            value={selectedGender}
            onChange={(e) => setSelectedGender(e.target.value)}
          >
            <option value="All">All Genders</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
          </select>

          {(search || selectedDepartment !== 'All' || selectedStatus !== 'All' || selectedGender !== 'All') && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearch('');
                setSelectedDepartment('All');
                setSelectedStatus('All');
                setSelectedGender('All');
              }}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Table Section */}
      <div className="table-responsive-wrapper" style={{ border: 'none', borderRadius: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleHeaderSort('employee_code')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span>Code</span>
                  <ArrowUpDown size={13} color={sortBy === 'employee_code' ? '#0284c7' : '#94a3b8'} />
                </div>
              </th>
              <th className="sortable" onClick={() => handleHeaderSort('employee_name')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span>Employee Name</span>
                  <ArrowUpDown size={13} color={sortBy === 'employee_name' ? '#0284c7' : '#94a3b8'} />
                </div>
              </th>
              <th className="sortable" onClick={() => handleHeaderSort('department')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span>Department</span>
                  <ArrowUpDown size={13} color={sortBy === 'department' ? '#0284c7' : '#94a3b8'} />
                </div>
              </th>
              <th>Designation</th>
              <th>Gender</th>
              <th className="sortable" onClick={() => handleHeaderSort('doj')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span>DOJ</span>
                  <ArrowUpDown size={13} color={sortBy === 'doj' ? '#0284c7' : '#94a3b8'} />
                </div>
              </th>
              <th className="sortable" onClick={() => handleHeaderSort('salary')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span>Salary (₹)</span>
                  <ArrowUpDown size={13} color={sortBy === 'salary' ? '#0284c7' : '#94a3b8'} />
                </div>
              </th>
              <th>WOP / YPL</th>
              <th className="sortable" onClick={() => handleHeaderSort('status')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span>Status</span>
                  <ArrowUpDown size={13} color={sortBy === 'status' ? '#0284c7' : '#94a3b8'} />
                </div>
              </th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <div style={{ color: '#0284c7', fontWeight: '600' }} className="animate-pulse">
                    Loading records from database...
                  </div>
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                      <Users size={24} />
                    </div>
                    <h4 style={{ color: '#334155', fontWeight: '700' }}>No Employee Records Found</h4>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', maxWidth: '360px' }}>
                      {search || selectedDepartment !== 'All' || selectedStatus !== 'All'
                        ? 'No records match your active search filters. Try adjusting your query.'
                        : 'Your master employee database is empty. Upload a CSV or Excel file to import employee data.'}
                    </p>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={onOpenImportModal}
                      style={{ marginTop: '0.5rem' }}
                    >
                      <FileSpreadsheet size={15} />
                      Upload Master Data
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.employee_code}>
                  <td>
                    <span className="emp-code-pill">{emp.employee_code}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: '600', color: '#0f172a' }}>
                      {emp.employee_name}
                    </div>
                  </td>
                  <td>
                    <DepartmentBadge department={emp.department} />
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8125rem', color: '#475569' }}>
                      {emp.designation || '-'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                      {emp.gender || '-'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                      {emp.doj && emp.doj !== '1900-01-01' ? emp.doj : '-'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: emp.salary ? '#15803d' : '#94a3b8' }}>
                      {emp.salary ? `₹${Number(emp.salary).toLocaleString()}` : '-'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', display: 'inline-flex', gap: '0.35rem' }}>
                      <span className="badge badge-info">{emp.wop || 0} WOP</span>
                      <span className="badge badge-success">{emp.ypl || 0} YPL</span>
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={emp.status} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onSelectEmployee(emp)}
                        title="View Full Profile"
                        style={{ padding: '0.35rem 0.65rem' }}
                      >
                        <Eye size={14} />
                        Profile
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <Pagination pagination={pagination} onPageChange={onPageChange} />
    </div>
  );
};
