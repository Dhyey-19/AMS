import React, { useState, useEffect } from 'react';
import { 
  User, 
  Calendar, 
  Clock, 
  DollarSign, 
  FileSpreadsheet, 
  Download, 
  Edit3, 
  RefreshCw, 
  Search, 
  ChevronDown, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  TrendingUp, 
  Award, 
  ShieldAlert, 
  FileText,
  Upload,
  Sparkles,
  Info,
  Building,
  Briefcase
} from 'lucide-react';
import { employeeApi, attendanceApi } from '../services/api';
import { EditEmployeeMasterModal } from '../components/employees/EditEmployeeMasterModal';

export const EmployeeAttendancePage = ({ initialEmployeeCode, onNavigateToEmployees }) => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeCode, setSelectedEmployeeCode] = useState(initialEmployeeCode || '');
  const [selectedMonth, setSelectedMonth] = useState('2026-05');
  const [availableMonths, setAvailableMonths] = useState(['2026-05', '2026-04', '2026-06', '2026-07', '2026-08']);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [sheetData, setSheetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('attendance'); // 'attendance', 'salary-history'

  // Workbook Import State
  const [importingWorkbook, setImportingWorkbook] = useState(false);
  const [importMessage, setImportMessage] = useState(null);

  // 1. Fetch Employee List and Available Months on load
  useEffect(() => {
    const initPage = async () => {
      try {
        const [empRes, monthsRes] = await Promise.all([
          employeeApi.getAll({ limit: 200, sortBy: 'employee_code', sortOrder: 'asc' }),
          attendanceApi.getMonths()
        ]);

        const empList = empRes.data || [];
        setEmployees(empList);

        if (monthsRes.data && monthsRes.data.length > 0) {
          setAvailableMonths(monthsRes.data);
          if (!selectedMonth || !monthsRes.data.includes(selectedMonth)) {
            setSelectedMonth(monthsRes.data[0]);
          }
        }

        // Set initial selected employee
        if (!selectedEmployeeCode && empList.length > 0) {
          // Prefer SANJAY (128) or first employee
          const defaultEmp = empList.find(e => e.employee_code === '128') || empList[0];
          setSelectedEmployeeCode(defaultEmp.employee_code);
        }
      } catch (err) {
        console.error('Failed to initialize employee attendance page:', err);
      }
    };
    initPage();
  }, []);

  // 2. Fetch Detailed Dynamic Sheet when employee or month changes
  useEffect(() => {
    if (!selectedEmployeeCode) return;

    const fetchSheet = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await attendanceApi.getEmployeeSheet(selectedEmployeeCode, {
          month: selectedMonth
        });
        setSheetData(res.data);
      } catch (err) {
        console.error('Failed to fetch employee attendance sheet:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load attendance record');
      } finally {
        setLoading(false);
      }
    };

    fetchSheet();
  }, [selectedEmployeeCode, selectedMonth]);

  // Handle Export to XLSX or CSV
  const handleExport = async (format = 'xlsx') => {
    if (!selectedEmployeeCode) return;
    setExporting(true);
    try {
      const response = await attendanceApi.exportEmployeeSheet(selectedEmployeeCode, {
        month: selectedMonth,
        format
      });

      // Trigger browser file download
      const blob = new Blob([response.data], { 
        type: format === 'xlsx' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
          : 'text/csv' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const empName = sheetData?.employee?.employee_name || selectedEmployeeCode;
      link.setAttribute('download', `${selectedEmployeeCode}_${empName.replace(/\s+/g, '_')}_${selectedMonth}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export employee attendance sheet');
    } finally {
      setExporting(false);
    }
  };

  // 1-Click Import MAY - 26.xlsx Workbook
  const handleImportSampleWorkbook = async () => {
    if (!window.confirm('Import complete multi-sheet MAY - 26.xlsx workbook? This will sync all 46 employee profiles and attendance sheets.')) return;
    setImportingWorkbook(true);
    setImportMessage(null);
    try {
      const res = await employeeApi.importSampleWorkbook();
      setImportMessage({
        type: 'success',
        text: res.message || 'MAY - 26.xlsx imported successfully!'
      });
      // Refresh employees and sheet
      const empRes = await employeeApi.getAll({ limit: 200 });
      setEmployees(empRes.data || []);
      const sheetRes = await attendanceApi.getEmployeeSheet(selectedEmployeeCode, { month: selectedMonth });
      setSheetData(sheetRes.data);
    } catch (err) {
      setImportMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to import sample workbook'
      });
    } finally {
      setImportingWorkbook(false);
    }
  };

  // Filtered employees for dropdown search
  const filteredEmployees = employees.filter(e => 
    e.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.employee_code.toString().includes(searchQuery) ||
    (e.department && e.department.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const currentEmp = sheetData?.employee;
  const summary = sheetData?.summary;
  const records = sheetData?.dailyRecords || [];

  return (
    <div className="employee-attendance-page animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Top Banner & Control Bar */}
      <div 
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.5rem',
          background: '#ffffff',
          padding: '1.25rem 1.5rem',
          borderRadius: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0'
        }}
      >
        {/* Left: Employee Search & Switcher Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '280px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>
              Select Employee Profile
            </label>
            <div 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 1rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: isDropdownOpen ? '0 0 0 2px rgba(2, 132, 199, 0.2)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div 
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '0.85rem'
                  }}
                >
                  {currentEmp?.employee_name?.charAt(0) || 'E'}
                </div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#0f172a', lineHeight: '1.2' }}>
                    {currentEmp?.employee_name || 'Select Employee...'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Code: #{currentEmp?.employee_code || ''} • {currentEmp?.department || 'General'}
                  </div>
                </div>
              </div>
              <ChevronDown size={18} style={{ color: '#64748b' }} />
            </div>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div 
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '0.35rem',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
                  zIndex: 50,
                  maxHeight: '340px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', background: '#f8fafc', borderRadius: '8px' }}>
                    <Search size={16} style={{ color: '#94a3b8' }} />
                    <input 
                      type="text"
                      placeholder="Search employee by name, code, dept..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.85rem' }}
                      autoFocus
                    />
                  </div>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {filteredEmployees.map((emp) => {
                    const isSelected = emp.employee_code === selectedEmployeeCode;
                    return (
                      <div
                        key={emp.employee_code}
                        onClick={() => {
                          setSelectedEmployeeCode(emp.employee_code);
                          setIsDropdownOpen(false);
                          setSearchQuery('');
                        }}
                        style={{
                          padding: '0.65rem 1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: isSelected ? '#f0f9ff' : 'transparent',
                          borderLeft: isSelected ? '3px solid #0284c7' : '3px solid transparent',
                          cursor: 'pointer',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <div>
                          <div style={{ fontWeight: isSelected ? '700' : '500', fontSize: '0.875rem', color: isSelected ? '#0369a1' : '#1e293b' }}>
                            {emp.employee_name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            #{emp.employee_code} • {emp.designation || emp.department || 'Staff'} {emp.salary ? `• ₹${emp.salary}` : ''}
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 size={16} style={{ color: '#0284c7' }} />}
                      </div>
                    );
                  })}
                  {filteredEmployees.length === 0 && (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                      No employees match "{searchQuery}"
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Month Selector */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>
              Attendance Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                padding: '0.65rem 1rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                fontWeight: '600',
                fontSize: '0.9rem',
                color: '#0f172a',
                cursor: 'pointer'
              }}
            >
              {availableMonths.map((m) => {
                const [year, monthNum] = m.split('-');
                const monthName = new Date(parseInt(year), parseInt(monthNum) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
                return (
                  <option key={m} value={m}>
                    {monthName} ({m})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Right: Actions Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsEditModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.65rem 1rem',
              borderRadius: '10px',
              backgroundColor: '#f0f9ff',
              border: '1px solid #bae6fd',
              color: '#0369a1',
              fontWeight: '600',
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="Edit Master Data & Rules for this employee"
          >
            <Edit3 size={16} /> Edit Master Rules
          </button>

          <button
            onClick={() => handleExport('xlsx')}
            disabled={exporting || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.65rem 1.15rem',
              borderRadius: '10px',
              backgroundColor: '#0284c7',
              border: 'none',
              color: '#ffffff',
              fontWeight: '600',
              fontSize: '0.875rem',
              cursor: exporting ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            <FileSpreadsheet size={16} /> {exporting ? 'Exporting...' : 'Export Excel'}
          </button>

          <button
            onClick={() => handleExport('csv')}
            disabled={exporting || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.65rem 1rem',
              borderRadius: '10px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontWeight: '600',
              fontSize: '0.875rem',
              cursor: exporting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Download size={16} /> CSV
          </button>

          <button
            onClick={handleImportSampleWorkbook}
            disabled={importingWorkbook}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.65rem 0.9rem',
              borderRadius: '10px',
              backgroundColor: '#f1f5f9',
              border: '1px solid #e2e8f0',
              color: '#475569',
              fontWeight: '600',
              fontSize: '0.825rem',
              cursor: importingWorkbook ? 'not-allowed' : 'pointer'
            }}
            title="Import or Sync MAY - 26.xlsx multi-sheet workbook"
          >
            <Upload size={15} /> {importingWorkbook ? 'Syncing...' : 'Sync MAY - 26.xlsx'}
          </button>
        </div>
      </div>

      {/* Import Feedback Banner */}
      {importMessage && (
        <div 
          style={{
            marginBottom: '1.5rem',
            padding: '0.85rem 1.25rem',
            borderRadius: '12px',
            backgroundColor: importMessage.type === 'success' ? '#ecfdf5' : '#fff1f2',
            border: `1px solid ${importMessage.type === 'success' ? '#a7f3d0' : '#fecdd3'}`,
            color: importMessage.type === 'success' ? '#065f46' : '#9f1239',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.875rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {importMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{importMessage.text}</span>
          </div>
          <button 
            onClick={() => setImportMessage(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: '700' }}
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', background: '#ffffff', borderRadius: '16px' }}>
          <RefreshCw size={32} className="spin" style={{ color: '#0284c7', marginBottom: '1rem' }} />
          <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1e293b' }}>
            Computing Dynamic Attendance & Salary Records...
          </div>
          <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
            Applying individual shift timings, tolerance grace, and rate calculations
          </div>
        </div>
      ) : error ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: '#ffffff', borderRadius: '16px', border: '1px solid #fecdd3' }}>
          <AlertTriangle size={36} style={{ color: '#e11d48', marginBottom: '0.75rem' }} />
          <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#9f1239' }}>{error}</div>
        </div>
      ) : (
        <>
          {/* 1. Employee Profile & Master Rules Hero Card */}
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '1.5rem',
              marginBottom: '1.5rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div 
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 50%, #10b981 100%)'
              }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {/* Profile Main Info */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div 
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    fontSize: '1.6rem',
                    boxShadow: '0 4px 10px rgba(2, 132, 199, 0.25)',
                    flexShrink: 0
                  }}
                >
                  {currentEmp?.employee_name?.charAt(0) || 'E'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '800', color: '#0f172a' }}>
                      {currentEmp?.employee_name}
                    </h2>
                    <span 
                      style={{
                        padding: '0.2rem 0.55rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        backgroundColor: currentEmp?.status === 'Working' ? '#ecfdf5' : '#fff1f2',
                        color: currentEmp?.status === 'Working' ? '#065f46' : '#9f1239'
                      }}
                    >
                      {currentEmp?.status || 'Working'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span><strong>ID:</strong> #{currentEmp?.employee_code}</span>
                    <span>•</span>
                    <span><strong>Dept:</strong> {currentEmp?.department || 'General'}</span>
                    <span>•</span>
                    <span><strong>Designation:</strong> {currentEmp?.designation || 'Staff'}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                    <strong>D.O.J:</strong> {currentEmp?.doj || 'Not recorded'} • <strong>Payment Mode:</strong> {currentEmp?.payment_mode || 'Bank'}
                  </div>
                </div>
              </div>

              {/* Working Hours & Shifts Pill */}
              <div 
                style={{
                  background: '#f8fafc',
                  borderRadius: '12px',
                  padding: '1rem',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0284c7', fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  <Clock size={15} /> Standard Working Shift
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Shift Timings:</span>{' '}
                    <strong style={{ color: '#0f172a' }}>{currentEmp?.standard_in_time} - {currentEmp?.standard_out_time}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Daily Target:</span>{' '}
                    <strong style={{ color: '#0f172a' }}>{currentEmp?.standard_work_hours} hrs/day</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Scheduled Break:</span>{' '}
                    <strong style={{ color: '#0f172a' }}>{currentEmp?.standard_break_minutes || 0} mins</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Late Grace:</span>{' '}
                    <strong style={{ color: '#0f172a' }}>{currentEmp?.late_grace_minutes || 11} mins</strong>
                  </div>
                </div>
              </div>

              {/* Salary & Hourly Rates Pill */}
              <div 
                style={{
                  background: '#f0fdf4',
                  borderRadius: '12px',
                  padding: '1rem',
                  border: '1px solid #bbf7d0',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#15803d', fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  <DollarSign size={15} /> Salary & Rate Breakdown
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#166534' }}>Base Salary:</span>{' '}
                    <strong style={{ color: '#14532d', fontSize: '1rem' }}>₹{currentEmp?.salary?.toLocaleString() || '0'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#166534' }}>Hourly Rate:</span>{' '}
                    <strong style={{ color: '#14532d' }}>₹{summary?.hourlyRate}/hr</strong>
                  </div>
                  <div>
                    <span style={{ color: '#166534' }}>Daily Rate:</span>{' '}
                    <strong style={{ color: '#14532d' }}>₹{summary?.dailyRate}/day</strong>
                  </div>
                  <div>
                    <span style={{ color: '#166534' }}>Late / OT Factor:</span>{' '}
                    <strong style={{ color: '#14532d' }}>{currentEmp?.late_deduction_multiplier}x / {currentEmp?.overtime_multiplier}x</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Special Rules / Bond Box (if present in Excel sheet) */}
            {currentEmp?.special_rules && (
              <div 
                style={{
                  marginTop: '1.25rem',
                  padding: '0.85rem 1.15rem',
                  borderRadius: '10px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem'
                }}
              >
                <ShieldAlert size={18} style={{ color: '#b45309', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.825rem', color: '#92400e', textTransform: 'uppercase' }}>
                    Special Employee Rules & Bond Terms
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#78350f', marginTop: '0.2rem', lineHeight: '1.5' }}>
                    {currentEmp.special_rules}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Dynamic Monthly Summary Cards */}
          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}
          >
            {/* Card 1: Attendance Percentage */}
            <div 
              style={{
                background: '#ffffff',
                padding: '1.25rem',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                  Attendance Rate
                </span>
                <span 
                  style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    background: summary?.attendancePercentage >= 90 ? '#ecfdf5' : (summary?.attendancePercentage >= 75 ? '#fffbeb' : '#fff1f2'),
                    color: summary?.attendancePercentage >= 90 ? '#065f46' : (summary?.attendancePercentage >= 75 ? '#92400e' : '#9f1239')
                  }}
                >
                  {summary?.attendancePercentage >= 90 ? 'Excellent' : (summary?.attendancePercentage >= 75 ? 'Good' : 'Needs Review')}
                </span>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: '800', color: '#0f172a' }}>
                {summary?.attendancePercentage}%
              </div>
              <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.35rem' }}>
                Present: <strong>{summary?.presentDays}</strong> | WOP: <strong>{summary?.weeklyOffPresentDays}</strong> | Absent: <strong>{summary?.absentDays}</strong> | Off: <strong>{summary?.weeklyOffDays}</strong>
              </div>
            </div>

            {/* Card 2: Work Hours Variance */}
            <div 
              style={{
                background: '#ffffff',
                padding: '1.25rem',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                  Total Work Time
                </span>
                <span 
                  style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    background: Number(summary?.totalWorkDiffHours) >= 0 ? '#ecfdf5' : '#fff1f2',
                    color: Number(summary?.totalWorkDiffHours) >= 0 ? '#065f46' : '#9f1239'
                  }}
                >
                  Diff: {summary?.totalWorkDiffFormatted}
                </span>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: '800', color: '#0f172a' }}>
                {summary?.totalActualWorkHours} <span style={{ fontSize: '1rem', fontWeight: '500', color: '#64748b' }}>hrs</span>
              </div>
              <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.35rem' }}>
                Expected: <strong>{summary?.totalExpectedWorkHours} hrs</strong> ({summary?.workingDaysInMonth} working days)
              </div>
            </div>

            {/* Card 3: Late Arrivals & Deductions */}
            <div 
              style={{
                background: '#ffffff',
                padding: '1.25rem',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                  Late Arrivals
                </span>
                <span 
                  style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    background: summary?.lateDaysCount === 0 ? '#ecfdf5' : '#fffbeb',
                    color: summary?.lateDaysCount === 0 ? '#065f46' : '#92400e'
                  }}
                >
                  {summary?.lateDaysCount} Instances
                </span>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: '800', color: summary?.lateDaysCount > 0 ? '#b45309' : '#0f172a' }}>
                {summary?.totalLateFormatted} <span style={{ fontSize: '1rem', fontWeight: '500', color: '#64748b' }}>hrs</span>
              </div>
              <div style={{ fontSize: '0.775rem', color: '#991b1b', marginTop: '0.35rem' }}>
                Late Salary Deduction: <strong>-₹{summary?.totalLateDeductions}</strong>
              </div>
            </div>

            {/* Card 4: Overtime & Bonus */}
            <div 
              style={{
                background: '#ffffff',
                padding: '1.25rem',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                  Overtime (O.T.)
                </span>
                <span 
                  style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    background: Number(summary?.totalOvertimeHours) > 0 ? '#f0fdf4' : '#f1f5f9',
                    color: Number(summary?.totalOvertimeHours) > 0 ? '#15803d' : '#64748b'
                  }}
                >
                  {currentEmp?.overtime_multiplier}x Rate
                </span>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: '800', color: Number(summary?.totalOvertimeHours) > 0 ? '#15803d' : '#0f172a' }}>
                {summary?.totalOvertimeFormatted} <span style={{ fontSize: '1rem', fontWeight: '500', color: '#64748b' }}>hrs</span>
              </div>
              <div style={{ fontSize: '0.775rem', color: '#15803d', marginTop: '0.35rem' }}>
                Overtime Compensation: <strong>+₹{summary?.totalOvertimePay}</strong>
              </div>
            </div>

            {/* Card 5: Net Payable Salary */}
            <div 
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                padding: '1.25rem',
                borderRadius: '14px',
                boxShadow: '0 10px 15px -3px rgba(2, 132, 199, 0.25)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#bae6fd', textTransform: 'uppercase' }}>
                  Net Payable Salary
                </span>
                <span 
                  style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    background: 'rgba(255, 255, 255, 0.2)',
                    color: '#ffffff'
                  }}
                >
                  {selectedMonth}
                </span>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: '800', color: '#ffffff' }}>
                ₹{summary?.netPayableSalary?.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.775rem', color: '#e0f2fe', marginTop: '0.35rem' }}>
                Gross Earned: ₹{summary?.grossEarnedSalary} | Ded: ₹{summary?.totalDeductions}
              </div>
            </div>
          </div>

          {/* Sub Navigation Bar */}
          <div 
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1rem',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '0.5rem'
            }}
          >
            <button
              onClick={() => setActiveSubTab('attendance')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontWeight: activeSubTab === 'attendance' ? '700' : '500',
                fontSize: '0.875rem',
                backgroundColor: activeSubTab === 'attendance' ? '#0284c7' : 'transparent',
                color: activeSubTab === 'attendance' ? '#ffffff' : '#64748b',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Daily Attendance Sheet ({records.length} Days)
            </button>

            {currentEmp?.salary_history && currentEmp?.salary_history.length > 0 && (
              <button
                onClick={() => setActiveSubTab('salary-history')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontWeight: activeSubTab === 'salary-history' ? '700' : '500',
                  fontSize: '0.875rem',
                  backgroundColor: activeSubTab === 'salary-history' ? '#0284c7' : 'transparent',
                  color: activeSubTab === 'salary-history' ? '#ffffff' : '#64748b',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Salary Scales & Revisions ({currentEmp.salary_history.length} Months)
              </button>
            )}
          </div>

          {/* 3. Detailed Attendance & Calculations Table */}
          {activeSubTab === 'attendance' && (
            <div 
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
              }}
            >
              <div 
                style={{
                  padding: '1rem 1.25rem',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#f8fafc'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} style={{ color: '#0284c7' }} />
                  <span style={{ fontWeight: '700', fontSize: '0.95rem', color: '#0f172a' }}>
                    Individual Attendance Record & Dynamic Formulas
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  All derived values are calculated dynamically using employee master rules
                </div>
              </div>

              <div style={{ overflowX: 'auto', maxHeight: '680px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#0f172a', color: '#f8fafc', zIndex: 10 }}>
                    <tr>
                      <th style={{ padding: '0.75rem 0.6rem', borderRight: '1px solid #334155' }}>DATE</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'center', borderRight: '1px solid #334155' }}>P/A</th>
                      <th style={{ padding: '0.75rem 0.6rem', borderRight: '1px solid #334155' }}>SCHED IN</th>
                      <th style={{ padding: '0.75rem 0.6rem', borderRight: '1px solid #334155' }}>SCHED OUT</th>
                      <th style={{ padding: '0.75rem 0.6rem', borderRight: '1px solid #334155' }}>WORK TIME</th>
                      <th style={{ padding: '0.75rem 0.6rem', borderRight: '1px solid #334155', background: '#1e293b' }}>A.IN TIME</th>
                      <th style={{ padding: '0.75rem 0.6rem', borderRight: '1px solid #334155', background: '#1e293b' }}>A.OUT TIME</th>
                      <th style={{ padding: '0.75rem 0.6rem', borderRight: '1px solid #334155', background: '#1e293b' }}>A.DURATION</th>
                      <th style={{ padding: '0.75rem 0.6rem', borderRight: '1px solid #334155', background: '#1e293b' }}>A.WORK TIME</th>
                      <th style={{ padding: '0.75rem 0.6rem', borderRight: '1px solid #334155', textAlign: 'center' }}>DIFF (+/-)</th>
                      <th style={{ padding: '0.75rem 0.6rem', borderRight: '1px solid #334155', color: '#fbbf24' }}>LATE BY</th>
                      <th style={{ padding: '0.75rem 0.6rem', borderRight: '1px solid #334155', color: '#4ade80' }}>O.T.</th>
                      <th style={{ padding: '0.75rem 0.6rem', borderRight: '1px solid #334155', textAlign: 'right' }}>RATE</th>
                      <th style={{ padding: '0.75rem 0.6rem', borderRight: '1px solid #334155', textAlign: 'right' }}>SALARY</th>
                      <th style={{ padding: '0.75rem 0.6rem', borderRight: '1px solid #334155', textAlign: 'right', color: '#f87171' }}>LATE DED</th>
                      <th style={{ padding: '0.75rem 0.6rem', borderRight: '1px solid #334155', textAlign: 'right', color: '#4ade80' }}>O.T. PAY</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', background: '#0369a1' }}>NET SALARY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, idx) => {
                      const isEven = idx % 2 === 0;
                      const isWO = r.status_code === 'WO';
                      const isWOP = r.status_code === 'WOP';
                      const isAbsent = r.status_code === 'A';
                      const isLate = r.is_late;

                      let rowBg = isEven ? '#ffffff' : '#f8fafc';
                      if (isWO) rowBg = '#eff6ff';
                      if (isWOP) rowBg = '#ecfeff';
                      if (isAbsent) rowBg = '#fff1f2';

                      return (
                        <tr 
                          key={r.attendance_date_iso || idx}
                          style={{
                            backgroundColor: rowBg,
                            borderBottom: '1px solid #e2e8f0',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = rowBg; }}
                        >
                          {/* Date */}
                          <td style={{ padding: '0.65rem 0.6rem', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', borderRight: '1px solid #e2e8f0' }}>
                            {r.attendance_date || r.attendance_date_iso}
                          </td>

                          {/* Status Badge */}
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                backgroundColor: isAbsent ? '#fecdd3' : (isWO ? '#bfdbfe' : (isWOP ? '#a5f3fc' : '#bbf7d0')),
                                color: isAbsent ? '#9f1239' : (isWO ? '#1e40af' : (isWOP ? '#0e7490' : '#14532d'))
                              }}
                            >
                              {r.status_code}
                            </span>
                          </td>

                          {/* Sched In / Out / Work */}
                          <td style={{ padding: '0.65rem 0.6rem', color: '#475569', borderRight: '1px solid #e2e8f0' }}>{r.scheduled_in_time}</td>
                          <td style={{ padding: '0.65rem 0.6rem', color: '#475569', borderRight: '1px solid #e2e8f0' }}>{r.scheduled_out_time}</td>
                          <td style={{ padding: '0.65rem 0.6rem', fontWeight: '600', color: '#334155', borderRight: '1px solid #e2e8f0' }}>{r.scheduled_work_formatted}</td>

                          {/* Actual In / Out / Dur / Work */}
                          <td style={{ padding: '0.65rem 0.6rem', fontWeight: isLate ? '700' : 'normal', color: isLate ? '#b45309' : '#0f172a', borderRight: '1px solid #e2e8f0', background: isLate ? '#fef3c7' : 'transparent' }}>
                            {r.actual_in_time || '—'}
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem', color: '#0f172a', borderRight: '1px solid #e2e8f0' }}>
                            {r.actual_out_time || '—'}
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                            {r.actual_duration_formatted}
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem', fontWeight: '700', color: '#0f172a', borderRight: '1px solid #e2e8f0' }}>
                            {r.actual_work_formatted}
                          </td>

                          {/* Work Hour Difference (+/-) */}
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                            <span 
                              style={{
                                fontWeight: '700',
                                color: r.work_diff_minutes > 0 ? '#15803d' : (r.work_diff_minutes < 0 ? '#b91c1c' : '#64748b')
                              }}
                            >
                              {r.work_diff_formatted}
                            </span>
                          </td>

                          {/* Late */}
                          <td style={{ padding: '0.65rem 0.6rem', color: isLate ? '#b45309' : '#94a3b8', fontWeight: isLate ? '700' : 'normal', borderRight: '1px solid #e2e8f0' }}>
                            {isLate ? r.late_formatted : '—'}
                          </td>

                          {/* Overtime */}
                          <td style={{ padding: '0.65rem 0.6rem', color: r.overtime_minutes > 0 ? '#15803d' : '#94a3b8', fontWeight: r.overtime_minutes > 0 ? '700' : 'normal', borderRight: '1px solid #e2e8f0' }}>
                            {r.overtime_minutes > 0 ? r.overtime_formatted : '—'}
                          </td>

                          {/* Rates & Financials */}
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', color: '#64748b', borderRight: '1px solid #e2e8f0' }}>
                            ₹{r.hourly_rate}
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', fontWeight: '600', color: '#0f172a', borderRight: '1px solid #e2e8f0' }}>
                            ₹{r.daily_salary_earned}
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', color: r.late_salary_deduction > 0 ? '#b91c1c' : '#94a3b8', borderRight: '1px solid #e2e8f0' }}>
                            {r.late_salary_deduction > 0 ? `-₹${r.late_salary_deduction}` : '—'}
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', color: r.overtime_pay > 0 ? '#15803d' : '#94a3b8', borderRight: '1px solid #e2e8f0' }}>
                            {r.overtime_pay > 0 ? `+₹${r.overtime_pay}` : '—'}
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', fontWeight: '700', color: '#0369a1', background: 'rgba(2, 132, 199, 0.05)' }}>
                            ₹{r.net_daily_salary}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Summary Footer Matching Excel Total Row */}
                  <tfoot style={{ position: 'sticky', bottom: 0, background: '#0f172a', color: '#f8fafc', fontWeight: '700' }}>
                    <tr>
                      <td style={{ padding: '0.85rem 0.6rem', borderRight: '1px solid #334155' }}>TOTAL</td>
                      <td style={{ padding: '0.85rem 0.6rem', textAlign: 'center', borderRight: '1px solid #334155' }}>{summary?.presentDays}P/{summary?.absentDays}A</td>
                      <td style={{ padding: '0.85rem 0.6rem', borderRight: '1px solid #334155' }}>—</td>
                      <td style={{ padding: '0.85rem 0.6rem', borderRight: '1px solid #334155' }}>—</td>
                      <td style={{ padding: '0.85rem 0.6rem', borderRight: '1px solid #334155' }}>{summary?.totalExpectedWorkHours}h</td>
                      <td style={{ padding: '0.85rem 0.6rem', borderRight: '1px solid #334155' }}>—</td>
                      <td style={{ padding: '0.85rem 0.6rem', borderRight: '1px solid #334155' }}>—</td>
                      <td style={{ padding: '0.85rem 0.6rem', borderRight: '1px solid #334155' }}>—</td>
                      <td style={{ padding: '0.85rem 0.6rem', borderRight: '1px solid #334155', color: '#38bdf8' }}>{summary?.totalActualWorkHours}h</td>
                      <td style={{ padding: '0.85rem 0.6rem', textAlign: 'center', borderRight: '1px solid #334155', color: Number(summary?.totalWorkDiffHours) >= 0 ? '#4ade80' : '#f87171' }}>
                        {summary?.totalWorkDiffFormatted}
                      </td>
                      <td style={{ padding: '0.85rem 0.6rem', color: '#fbbf24', borderRight: '1px solid #334155' }}>{summary?.totalLateFormatted}</td>
                      <td style={{ padding: '0.85rem 0.6rem', color: '#4ade80', borderRight: '1px solid #334155' }}>{summary?.totalOvertimeFormatted}</td>
                      <td style={{ padding: '0.85rem 0.6rem', textAlign: 'right', borderRight: '1px solid #334155' }}>—</td>
                      <td style={{ padding: '0.85rem 0.6rem', textAlign: 'right', borderRight: '1px solid #334155' }}>₹{summary?.grossEarnedSalary}</td>
                      <td style={{ padding: '0.85rem 0.6rem', textAlign: 'right', color: '#f87171', borderRight: '1px solid #334155' }}>-₹{summary?.totalLateDeductions}</td>
                      <td style={{ padding: '0.85rem 0.6rem', textAlign: 'right', color: '#4ade80', borderRight: '1px solid #334155' }}>+₹{summary?.totalOvertimePay}</td>
                      <td style={{ padding: '0.85rem 0.6rem', textAlign: 'right', color: '#38bdf8', fontSize: '0.95rem' }}>₹{summary?.netPayableSalary}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 4. Historical Salary Scales Table */}
          {activeSubTab === 'salary-history' && currentEmp?.salary_history && (
            <div 
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
              }}
            >
              <div 
                style={{
                  padding: '1rem 1.25rem',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#f8fafc'
                }}
              >
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>
                  Historical Salary Scale & Rate Revisions (From Excel Columns Z, AA, AB, AC, AD)
                </h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead style={{ background: '#1e293b', color: '#f8fafc' }}>
                    <tr>
                      <th style={{ padding: '0.75rem 1rem' }}>MONTH</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>PER DAY RATE (₹)</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>PER HOUR RATE (₹)</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>BASE SALARY (₹)</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>ACTUAL SALARY (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentEmp.salary_history.map((h, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: '600', color: '#0f172a' }}>{h.month}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#334155' }}>₹{h.perDay}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#334155' }}>₹{h.perHour}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>₹{h.baseSalary?.toLocaleString()}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700', color: '#0369a1' }}>₹{h.actualSalary?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit Employee Master Modal */}
      {isEditModalOpen && currentEmp && (
        <EditEmployeeMasterModal 
          employee={currentEmp}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onUpdated={async (updated) => {
            // Refresh employee data & calculations
            const res = await attendanceApi.getEmployeeSheet(selectedEmployeeCode, { month: selectedMonth });
            setSheetData(res.data);
          }}
        />
      )}
    </div>
  );
};
