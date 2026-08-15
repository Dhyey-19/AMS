import React, { useState } from 'react';
import { AttendanceStatusBadge, DepartmentBadge } from '../common/Badge';
import { Pagination } from '../common/Pagination';
import { 
  Search, 
  ArrowUpDown, 
  Download, 
  Calendar, 
  Clock, 
  Info,
  FileSpreadsheet,
  Users
} from 'lucide-react';

export const AttendanceTable = ({
  records = [],
  pagination,
  departments = [],
  search,
  setSearch,
  selectedDepartment,
  setSelectedDepartment,
  selectedStatus,
  setSelectedStatus,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  sortBy,
  sortOrder,
  onSort,
  onPageChange,
  onOpenImportModal,
  loading = false
}) => {
  const [activePunchInfo, setActivePunchInfo] = useState(null);

  const handleHeaderSort = (col) => {
    if (sortBy === col) {
      onSort(col, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(col, 'asc');
    }
  };

  const handleExportCSV = () => {
    if (!records || records.length === 0) return;

    const headers = [
      'EmployeeCode', 'EmployeeName', 'Department', 'Designation', 'Date',
      'BeginTime', 'EndTime', 'InTime', 'OutTime', 'Duration', 'LateBy', 'Status', 'PunchRecords'
    ];

    const rows = records.map(r => [
      `"${r.employee_code || ''}"`,
      `"${r.employee_name || ''}"`,
      `"${r.department || ''}"`,
      `"${r.designation || ''}"`,
      `"${r.attendance_date_iso || r.attendance_date || ''}"`,
      `"${r.begin_time || ''}"`,
      `"${r.end_time || ''}"`,
      `"${r.in_time || ''}"`,
      `"${r.out_time || ''}"`,
      `"${r.total_duration || ''}"`,
      `"${r.late_by || ''}"`,
      `"${r.status_code || ''}"`,
      `"${(r.punch_records || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `global_ivf_attendance_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Table Toolbar & Filters */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
        <div className="table-toolbar" style={{ marginBottom: '1rem' }}>
          {/* Search Box */}
          <div className="table-search-box">
            <Search className="search-input-icon" size={18} />
            <input
              type="text"
              className="table-search-input"
              placeholder="Search by name, employee code, department, shift..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleExportCSV}
              disabled={records.length === 0}
              title="Export visible records to CSV"
            >
              <Download size={15} />
              Export CSV
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={onOpenImportModal}
            >
              <FileSpreadsheet size={15} />
              Import Attendance
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="table-filter-group">
          {/* Start Date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>From:</span>
            <input
              type="date"
              className="form-input"
              style={{ width: 'auto', padding: '0.4rem 0.625rem', fontSize: '0.8125rem' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* End Date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>To:</span>
            <input
              type="date"
              className="form-input"
              style={{ width: 'auto', padding: '0.4rem 0.625rem', fontSize: '0.8125rem' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* Department Filter */}
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: '160px', padding: '0.45rem 0.75rem', fontSize: '0.8125rem' }}
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
            <option value="P">Present (P)</option>
            <option value="A">Absent (A)</option>
            <option value="WO">Weekly Off (WO)</option>
            <option value="WOP">Off Present (WOP)</option>
            <option value="HD">Half Day (HD)</option>
          </select>

          {(search || selectedDepartment !== 'All' || selectedStatus !== 'All' || startDate || endDate) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearch('');
                setSelectedDepartment('All');
                setSelectedStatus('All');
                setStartDate('');
                setEndDate('');
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
              <th className="sortable" onClick={() => handleHeaderSort('attendance_date_iso')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span>Date</span>
                  <ArrowUpDown size={13} color={sortBy === 'attendance_date_iso' ? '#0284c7' : '#94a3b8'} />
                </div>
              </th>
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
              <th>Shift / Timings</th>
              <th className="sortable" onClick={() => handleHeaderSort('in_time')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span>In Time</span>
                  <ArrowUpDown size={13} color={sortBy === 'in_time' ? '#0284c7' : '#94a3b8'} />
                </div>
              </th>
              <th>Out Time</th>
              <th className="sortable" onClick={() => handleHeaderSort('total_duration_minutes')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span>Duration</span>
                  <ArrowUpDown size={13} color={sortBy === 'total_duration_minutes' ? '#0284c7' : '#94a3b8'} />
                </div>
              </th>
              <th className="sortable" onClick={() => handleHeaderSort('late_by_minutes')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span>Late By</span>
                  <ArrowUpDown size={13} color={sortBy === 'late_by_minutes' ? '#0284c7' : '#94a3b8'} />
                </div>
              </th>
              <th className="sortable" onClick={() => handleHeaderSort('status_code')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span>Status</span>
                  <ArrowUpDown size={13} color={sortBy === 'status_code' ? '#0284c7' : '#94a3b8'} />
                </div>
              </th>
              <th style={{ textAlign: 'right' }}>Punches</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <div style={{ color: '#0284c7', fontWeight: '600' }} className="animate-pulse">
                    Loading attendance records...
                  </div>
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                      <Calendar size={24} />
                    </div>
                    <h4 style={{ color: '#334155', fontWeight: '700' }}>No Attendance Records Found</h4>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', maxWidth: '380px' }}>
                      {search || selectedDepartment !== 'All' || selectedStatus !== 'All' || startDate || endDate
                        ? 'No records match your active search filters. Try adjusting your query.'
                        : 'No attendance logs have been imported yet. Upload an attendance CSV or Excel file to get started.'}
                    </p>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={onOpenImportModal}
                      style={{ marginTop: '0.5rem' }}
                    >
                      <FileSpreadsheet size={15} />
                      Upload Attendance Data
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={`${r.employee_code}-${r.attendance_date_iso}`}>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: '600', color: '#334155' }}>
                    {r.attendance_date_iso || r.attendance_date}
                  </td>
                  <td>
                    <span className="emp-code-pill">{r.employee_code}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: '600', color: '#0f172a' }}>{r.employee_name}</div>
                  </td>
                  <td>
                    <DepartmentBadge department={r.department} />
                  </td>
                  <td>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {r.begin_time && r.begin_time !== '00:00' ? `${r.begin_time} - ${r.end_time}` : (r.shift_name || '-')}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8125rem', color: r.in_time ? '#0f172a' : '#94a3b8', fontWeight: r.in_time ? '600' : 'normal' }}>
                      {r.in_time || '--:--'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8125rem', color: r.out_time ? '#0f172a' : '#94a3b8' }}>
                      {r.out_time || '--:--'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: r.total_duration !== '00:00' ? '#059669' : '#94a3b8' }}>
                      {r.total_duration || '00:00'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8125rem', color: r.late_by !== '00:00' ? '#e11d48' : '#64748b', fontWeight: r.late_by !== '00:00' ? '600' : 'normal' }}>
                      {r.late_by || '00:00'}
                    </span>
                  </td>
                  <td>
                    <AttendanceStatusBadge status={r.status_code} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {r.punch_records ? (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => alert(`Punch Records for ${r.employee_name} on ${r.attendance_date_iso}:\n\n${r.punch_records}`)}
                        title={r.punch_records}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      >
                        <Clock size={12} />
                        Punches
                      </button>
                    ) : (
                      <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>-</span>
                    )}
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
