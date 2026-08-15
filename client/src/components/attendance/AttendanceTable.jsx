import React, { useState, useRef, useEffect } from 'react';
import { AttendanceStatusBadge, DepartmentBadge } from '../common/Badge';
import { Pagination } from '../common/Pagination';
import { Modal } from '../common/Modal';
import { 
  Search, 
  ArrowUpDown, 
  Download, 
  Calendar, 
  Clock, 
  FileSpreadsheet, 
  Columns, 
  Trash2, 
  CheckSquare, 
  Square, 
  AlertTriangle, 
  RefreshCw,
  X,
  SlidersHorizontal,
  CheckCircle2
} from 'lucide-react';
import { attendanceApi } from '../../services/api';

const ALL_COLUMNS = [
  { id: 'date', label: 'Date', sortKey: 'attendance_date_iso' },
  { id: 'code', label: 'Employee Code', sortKey: 'employee_code' },
  { id: 'name', label: 'Employee Name', sortKey: 'employee_name' },
  { id: 'department', label: 'Department', sortKey: 'department' },
  { id: 'shift', label: 'Shift / Timings', sortKey: null },
  { id: 'in_time', label: 'In Time', sortKey: 'in_time' },
  { id: 'out_time', label: 'Out Time', sortKey: null },
  { id: 'duration', label: 'Duration', sortKey: 'total_duration_minutes' },
  { id: 'late_by', label: 'Late By', sortKey: 'late_by_minutes' },
  { id: 'status', label: 'Status', sortKey: 'status_code' },
  { id: 'punches', label: 'Punches', sortKey: null }
];

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
  onLimitChange,
  onOpenImportModal,
  onRecordsDeleted,
  loading = false
}) => {
  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('ams_attendance_columns');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return ALL_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: true }), {});
  });
  const [isColumnFilterOpen, setIsColumnFilterOpen] = useState(false);
  const [columnSearch, setColumnSearch] = useState('');
  const columnFilterRef = useRef(null);

  // Row Selection State
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAllAcrossPages, setSelectAllAcrossPages] = useState(false);
  const selectAllRef = useRef(null);

  // Reset selection when filters change
  useEffect(() => {
    setSelectedIds([]);
    setSelectAllAcrossPages(false);
  }, [search, selectedDepartment, selectedStatus, startDate, endDate]);

  // Delete Confirmation Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Save Column preferences to localStorage
  const toggleColumnVisibility = (colId) => {
    setVisibleColumns(prev => {
      const updated = { ...prev, [colId]: !prev[colId] };
      localStorage.setItem('ams_attendance_columns', JSON.stringify(updated));
      return updated;
    });
  };

  const handleShowAllColumns = () => {
    const allVisible = ALL_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: true }), {});
    setVisibleColumns(allVisible);
    localStorage.setItem('ams_attendance_columns', JSON.stringify(allVisible));
  };

  const handleResetColumns = () => {
    const defaultVisible = ALL_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: true }), {});
    setVisibleColumns(defaultVisible);
    localStorage.setItem('ams_attendance_columns', JSON.stringify(defaultVisible));
  };

  // Close column dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (columnFilterRef.current && !columnFilterRef.current.contains(e.target)) {
        setIsColumnFilterOpen(false);
      }
    };
    if (isColumnFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isColumnFilterOpen]);

  // Handle Header Sort
  const handleHeaderSort = (colKey) => {
    if (!colKey) return;
    if (sortBy === colKey) {
      onSort(colKey, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(colKey, 'asc');
    }
  };

  // Selection Logic
  const visibleRecordIds = records.map(r => r.id).filter(Boolean);
  const isAllSelected = visibleRecordIds.length > 0 && visibleRecordIds.every(id => selectedIds.includes(id));
  const isSomeSelected = (selectAllAcrossPages || visibleRecordIds.some(id => selectedIds.includes(id))) && !isAllSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = !selectAllAcrossPages && isSomeSelected;
    }
  }, [isSomeSelected, selectAllAcrossPages]);

  const handleToggleSelectAll = () => {
    if (selectAllAcrossPages || isAllSelected) {
      setSelectedIds([]);
      setSelectAllAcrossPages(false);
    } else {
      setSelectedIds(visibleRecordIds);
      setSelectAllAcrossPages(false);
    }
  };

  const handleToggleRow = (id) => {
    setSelectAllAcrossPages(false);
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(item => item !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  // CSV Export for Visible or Selected Records
  const handleExportCSV = (onlySelected = false) => {
    const targetRecords = onlySelected 
      ? records.filter(r => selectedIds.includes(r.id))
      : records;

    if (!targetRecords || targetRecords.length === 0) return;

    const headers = [
      'EmployeeCode', 'EmployeeName', 'Department', 'Designation', 'Date',
      'BeginTime', 'EndTime', 'InTime', 'OutTime', 'Duration', 'LateBy', 'Status', 'PunchRecords'
    ];

    const rows = targetRecords.map(r => [
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
    link.setAttribute('download', `global_ivf_attendance_${onlySelected ? 'selected_' : ''}${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Batch Delete Execution
  const handleConfirmBatchDelete = async () => {
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') {
      setDeleteError('Please type "delete" to confirm.');
      return;
    }

    try {
      setIsDeleting(true);
      setDeleteError(null);

      let res;
      if (selectAllAcrossPages) {
        res = await attendanceApi.deleteBatch({
          selectAllMatching: true,
          filters: {
            search,
            department: selectedDepartment,
            statusCode: selectedStatus,
            startDate,
            endDate
          }
        });
      } else {
        res = await attendanceApi.deleteBatch(selectedIds);
      }
      
      setIsDeleteModalOpen(false);
      setDeleteConfirmText('');
      setSelectedIds([]);
      setSelectAllAcrossPages(false);

      if (onRecordsDeleted) {
        onRecordsDeleted(res.deletedCount || (selectAllAcrossPages ? pagination.total : selectedIds.length));
      }
    } catch (err) {
      console.error('Batch delete error:', err);
      setDeleteError(err.response?.data?.message || err.message || 'Failed to delete selected records');
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedRecordsPreview = records.filter(r => selectedIds.includes(r.id));
  const filteredColumnList = ALL_COLUMNS.filter(col => 
    col.label.toLowerCase().includes(columnSearch.toLowerCase())
  );
  const visibleColumnCount = Object.values(visibleColumns).filter(Boolean).length;
  const effectiveSelectedCount = selectAllAcrossPages ? (pagination?.total || records.length) : selectedIds.length;

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

          {/* Action Buttons & Column Visibility Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
            {/* Column Visibility Dropdown Button */}
            <div className="column-filter-container" ref={columnFilterRef}>
              <button
                type="button"
                className={`btn btn-sm ${isColumnFilterOpen ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setIsColumnFilterOpen(!isColumnFilterOpen)}
                title="Customize visible columns"
              >
                <Columns size={15} />
                <span>Columns</span>
                <span 
                  style={{ 
                    background: isColumnFilterOpen ? 'rgba(255, 255, 255, 0.25)' : 'var(--slate-200)', 
                    color: isColumnFilterOpen ? '#ffffff' : 'var(--slate-700)',
                    padding: '0.1rem 0.4rem', 
                    borderRadius: '999px', 
                    fontSize: '0.7rem',
                    fontWeight: '700'
                  }}
                >
                  {visibleColumnCount}/{ALL_COLUMNS.length}
                </span>
              </button>

              {/* Column Visibility Popover */}
              {isColumnFilterOpen && (
                <div className="column-filter-popover">
                  <div className="column-filter-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <SlidersHorizontal size={14} color="var(--primary-600)" />
                      <span>Filter Columns</span>
                    </div>
                    <button 
                      onClick={() => setIsColumnFilterOpen(false)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--slate-400)' }}
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--slate-200)', background: '#ffffff' }}>
                    <input
                      type="text"
                      placeholder="Search columns..."
                      value={columnSearch}
                      onChange={(e) => setColumnSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.3rem 0.5rem',
                        fontSize: '0.775rem',
                        border: '1px solid var(--slate-300)',
                        borderRadius: '4px',
                        outline: 'none'
                      }}
                      autoFocus
                    />
                  </div>

                  <div className="column-filter-list">
                    {filteredColumnList.map((col) => (
                      <label 
                        key={col.id} 
                        className="column-filter-item"
                      >
                        <input
                          type="checkbox"
                          checked={!!visibleColumns[col.id]}
                          onChange={() => toggleColumnVisibility(col.id)}
                        />
                        <span>{col.label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="column-filter-footer">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.725rem', padding: '0.2rem 0.5rem' }}
                      onClick={handleShowAllColumns}
                    >
                      Show All
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.725rem', padding: '0.2rem 0.5rem' }}
                      onClick={handleResetColumns}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Export CSV */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleExportCSV(false)}
              disabled={records.length === 0}
              title="Export visible records to CSV"
            >
              <Download size={15} />
              Export CSV
            </button>

            {/* Import Button */}
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

      {/* Batch Selection Banner */}
      {(selectedIds.length > 0 || selectAllAcrossPages) && (
        <div className="batch-selection-banner">
          <div className="batch-selection-info" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <CheckSquare size={18} color="#38bdf8" />
              <span>
                <span className="batch-selection-count" style={{ background: selectAllAcrossPages ? '#0284c7' : 'var(--primary-600)' }}>
                  {effectiveSelectedCount}
                </span>{' '}
                {selectAllAcrossPages
                  ? `records selected across ALL ${pagination?.totalPages || 1} pages in grid`
                  : `record${selectedIds.length > 1 ? 's' : ''} selected on this page`}
              </span>
            </div>

            {pagination && pagination.total > records.length && (
              <div style={{ fontSize: '0.775rem', color: '#cbd5e1', marginLeft: '1.75rem' }}>
                {!selectAllAcrossPages ? (
                  <span>
                    All {records.length} records on this page are selected.{' '}
                    <button
                      type="button"
                      onClick={() => setSelectAllAcrossPages(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#38bdf8',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontWeight: '700',
                        padding: 0
                      }}
                    >
                      Select all {pagination.total} records across all pages
                    </button>
                  </span>
                ) : (
                  <span>
                    All {pagination.total} records across all pages are selected.{' '}
                    <button
                      type="button"
                      onClick={() => setSelectAllAcrossPages(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#38bdf8',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontWeight: '700',
                        padding: 0
                      }}
                    >
                      Select only current page ({records.length} records)
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="batch-selection-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleExportCSV(true)}
              disabled={selectAllAcrossPages}
              title={selectAllAcrossPages ? 'Exporting selected across all pages is available by regular Export CSV with filters' : 'Export checked records'}
              style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              <Download size={14} />
              Export Selected
            </button>

            <button
              type="button"
              className="btn-batch-delete"
              onClick={() => {
                setDeleteConfirmText('');
                setDeleteError(null);
                setIsDeleteModalOpen(true);
              }}
            >
              <Trash2 size={14} />
              Delete Selected ({effectiveSelectedCount})
            </button>

            <button
              type="button"
              className="btn-batch-cancel"
              onClick={() => {
                setSelectedIds([]);
                setSelectAllAcrossPages(false);
              }}
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="table-responsive-wrapper" style={{ border: 'none', borderRadius: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              {/* Checkbox Column */}
              <th className="th-checkbox">
                <input
                  type="checkbox"
                  ref={selectAllRef}
                  checked={selectAllAcrossPages || isAllSelected}
                  onChange={handleToggleSelectAll}
                  className="table-checkbox"
                  title="Select all on this page"
                />
              </th>

              {visibleColumns.date && (
                <th className="sortable" onClick={() => handleHeaderSort('attendance_date_iso')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span>Date</span>
                    <ArrowUpDown size={13} color={sortBy === 'attendance_date_iso' ? '#0284c7' : '#94a3b8'} />
                  </div>
                </th>
              )}

              {visibleColumns.code && (
                <th className="sortable" onClick={() => handleHeaderSort('employee_code')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span>Code</span>
                    <ArrowUpDown size={13} color={sortBy === 'employee_code' ? '#0284c7' : '#94a3b8'} />
                  </div>
                </th>
              )}

              {visibleColumns.name && (
                <th className="sortable" onClick={() => handleHeaderSort('employee_name')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span>Employee Name</span>
                    <ArrowUpDown size={13} color={sortBy === 'employee_name' ? '#0284c7' : '#94a3b8'} />
                  </div>
                </th>
              )}

              {visibleColumns.department && (
                <th className="sortable" onClick={() => handleHeaderSort('department')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span>Department</span>
                    <ArrowUpDown size={13} color={sortBy === 'department' ? '#0284c7' : '#94a3b8'} />
                  </div>
                </th>
              )}

              {visibleColumns.shift && <th>Shift / Timings</th>}

              {visibleColumns.in_time && (
                <th className="sortable" onClick={() => handleHeaderSort('in_time')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span>In Time</span>
                    <ArrowUpDown size={13} color={sortBy === 'in_time' ? '#0284c7' : '#94a3b8'} />
                  </div>
                </th>
              )}

              {visibleColumns.out_time && <th>Out Time</th>}

              {visibleColumns.duration && (
                <th className="sortable" onClick={() => handleHeaderSort('total_duration_minutes')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span>Duration</span>
                    <ArrowUpDown size={13} color={sortBy === 'total_duration_minutes' ? '#0284c7' : '#94a3b8'} />
                  </div>
                </th>
              )}

              {visibleColumns.late_by && (
                <th className="sortable" onClick={() => handleHeaderSort('late_by_minutes')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span>Late By</span>
                    <ArrowUpDown size={13} color={sortBy === 'late_by_minutes' ? '#0284c7' : '#94a3b8'} />
                  </div>
                </th>
              )}

              {visibleColumns.status && (
                <th className="sortable" onClick={() => handleHeaderSort('status_code')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span>Status</span>
                    <ArrowUpDown size={13} color={sortBy === 'status_code' ? '#0284c7' : '#94a3b8'} />
                  </div>
                </th>
              )}

              {visibleColumns.punches && <th style={{ textAlign: 'right' }}>Punches</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={visibleColumnCount + 1} style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <div style={{ color: '#0284c7', fontWeight: '600' }} className="animate-pulse">
                    Loading attendance records...
                  </div>
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={visibleColumnCount + 1} style={{ textAlign: 'center', padding: '4rem 1rem' }}>
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
              records.map((r) => {
                const isSelected = selectAllAcrossPages || selectedIds.includes(r.id);
                return (
                  <tr 
                    key={r.id || `${r.employee_code}-${r.attendance_date_iso}`}
                    className={isSelected ? 'row-selected' : ''}
                  >
                    {/* Checkbox Cell */}
                    <td className="td-checkbox">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleRow(r.id)}
                        className="table-checkbox"
                        aria-label={`Select record for ${r.employee_name}`}
                      />
                    </td>

                    {visibleColumns.date && (
                      <td style={{ whiteSpace: 'nowrap', fontWeight: '600', color: '#334155' }}>
                        {r.attendance_date_iso || r.attendance_date}
                      </td>
                    )}

                    {visibleColumns.code && (
                      <td>
                        <span className="emp-code-pill">{r.employee_code}</span>
                      </td>
                    )}

                    {visibleColumns.name && (
                      <td>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{r.employee_name}</div>
                      </td>
                    )}

                    {visibleColumns.department && (
                      <td>
                        <DepartmentBadge department={r.department} />
                      </td>
                    )}

                    {visibleColumns.shift && (
                      <td>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {r.begin_time && r.begin_time !== '00:00' ? `${r.begin_time} - ${r.end_time}` : (r.shift_name || '-')}
                        </span>
                      </td>
                    )}

                    {visibleColumns.in_time && (
                      <td>
                        <span style={{ fontSize: '0.8125rem', color: r.in_time ? '#0f172a' : '#94a3b8', fontWeight: r.in_time ? '600' : 'normal' }}>
                          {r.in_time || '--:--'}
                        </span>
                      </td>
                    )}

                    {visibleColumns.out_time && (
                      <td>
                        <span style={{ fontSize: '0.8125rem', color: r.out_time ? '#0f172a' : '#94a3b8' }}>
                          {r.out_time || '--:--'}
                        </span>
                      </td>
                    )}

                    {visibleColumns.duration && (
                      <td>
                        <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: r.total_duration !== '00:00' ? '#059669' : '#94a3b8' }}>
                          {r.total_duration || '00:00'}
                        </span>
                      </td>
                    )}

                    {visibleColumns.late_by && (
                      <td>
                        <span style={{ fontSize: '0.8125rem', color: r.late_by !== '00:00' ? '#e11d48' : '#64748b', fontWeight: r.late_by !== '00:00' ? '600' : 'normal' }}>
                          {r.late_by || '00:00'}
                        </span>
                      </td>
                    )}

                    {visibleColumns.status && (
                      <td>
                        <AttendanceStatusBadge status={r.status_code} />
                      </td>
                    )}

                    {visibleColumns.punches && (
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
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar with Page Size Selector */}
      <Pagination 
        pagination={pagination} 
        onPageChange={onPageChange} 
        onLimitChange={onLimitChange}
        pageSizeOptions={[20, 50, 100, 200]}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setIsDeleteModalOpen(false);
            setDeleteConfirmText('');
            setDeleteError(null);
          }
        }}
        title="Confirm Record Deletion"
        size="md"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setDeleteConfirmText('');
                setDeleteError(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              style={{
                backgroundColor: '#e11d48',
                color: '#ffffff',
                borderColor: '#e11d48',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
              onClick={handleConfirmBatchDelete}
              disabled={deleteConfirmText.trim().toLowerCase() !== 'delete' || isDeleting}
            >
              {isDeleting ? (
                <>
                  <RefreshCw size={15} className="spin" />
                  Deleting Records...
                </>
              ) : (
                <>
                  <Trash2 size={15} />
                  Delete {effectiveSelectedCount} Record{effectiveSelectedCount > 1 ? 's' : ''}
                </>
              )}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Warning Banner */}
          <div 
            style={{
              padding: '1rem',
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem'
            }}
          >
            <AlertTriangle size={22} style={{ color: 'var(--danger-solid)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ color: 'var(--danger-text)', fontWeight: '700', fontSize: '0.95rem', margin: 0 }}>
                Permanent Deletion Warning
              </h4>
              <p style={{ color: '#9f1239', fontSize: '0.8125rem', margin: '0.35rem 0 0 0', lineHeight: '1.4' }}>
                {selectAllAcrossPages ? (
                  <>
                    You are about to permanently delete <strong>ALL {pagination?.total} attendance records</strong> matching your active search and filter criteria across the entire database.
                  </>
                ) : (
                  <>
                    You are about to permanently delete <strong>{selectedIds.length} attendance record{selectedIds.length > 1 ? 's' : ''}</strong>.
                  </>
                )}
                {' '}This action cannot be undone and will permanently remove these punch entries from calculation metrics.
              </p>
            </div>
          </div>

          {deleteError && (
            <div className="auth-alert-error" style={{ fontSize: '0.8125rem' }}>
              <AlertTriangle size={16} />
              <span>{deleteError}</span>
            </div>
          )}

          {/* Selected Records Preview List */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--slate-600)', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'block' }}>
              {selectAllAcrossPages ? `Sample of records matching filters (${pagination?.total} total):` : `Records to be removed (${selectedRecordsPreview.length} previewed):`}
            </label>
            <div className="delete-preview-list">
              {selectedRecordsPreview.slice(0, 8).map((r) => (
                <div key={r.id || `${r.employee_code}-${r.attendance_date_iso}`} className="delete-preview-row">
                  <div>
                    <strong style={{ color: 'var(--slate-900)' }}>{r.employee_name}</strong>{' '}
                    <span style={{ color: 'var(--slate-500)', fontSize: '0.75rem' }}>#{r.employee_code}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--slate-600)' }}>{r.attendance_date_iso || r.attendance_date}</span>
                    <span className="badge" style={{ padding: '0.1rem 0.35rem', fontSize: '0.65rem' }}>{r.status_code}</span>
                  </div>
                </div>
              ))}
              {effectiveSelectedCount > 8 && (
                <div style={{ padding: '0.4rem', textAlign: 'center', color: 'var(--slate-500)', fontSize: '0.75rem', fontStyle: 'italic' }}>
                  ... and {effectiveSelectedCount - 8} more records
                </div>
              )}
            </div>
          </div>

          {/* Typing confirmation input */}
          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--slate-800)', display: 'block', marginBottom: '0.4rem' }}>
              To confirm deletion, please type <span style={{ color: '#e11d48', backgroundColor: '#ffe4e6', padding: '0.1rem 0.35rem', borderRadius: '4px', fontFamily: 'monospace' }}>delete</span> below:
            </label>
            <input
              type="text"
              className="delete-type-input"
              placeholder="type 'delete' to enable confirmation button"
              value={deleteConfirmText}
              onChange={(e) => {
                setDeleteConfirmText(e.target.value);
                setDeleteError(null);
              }}
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

