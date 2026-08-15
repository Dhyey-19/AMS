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
  TrendingUp, 
  ShieldAlert, 
  FileText,
  Upload,
  Sparkles
} from 'lucide-react';
import { employeeApi, attendanceApi } from '../services/api';
import { EditEmployeeMasterModal } from '../components/employees/EditEmployeeMasterModal';
import { EditDayAttendanceModal } from '../components/attendance/EditDayAttendanceModal';

const formatHoursToHHMM = (hrs) => {
  if (hrs === null || hrs === undefined || isNaN(hrs)) return '00:00';
  const totalMins = Math.round(Number(hrs) * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

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
  const [selectedRecordForEdit, setSelectedRecordForEdit] = useState(null);
  const [isDayEditModalOpen, setIsDayEditModalOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('attendance'); // 'attendance', 'salary-history'
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

        if (!selectedEmployeeCode && empList.length > 0) {
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



  const filteredEmployees = employees.filter(e => 
    e.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.employee_code.toString().includes(searchQuery) ||
    (e.department && e.department.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const currentEmp = sheetData?.employee;
  const summary = sheetData?.summary;
  const records = sheetData?.dailyRecords || [];

  return (
    <div className="employee-attendance-page animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner & Control Bar */}
      <div 
        className="card"
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}
      >
        {/* Left: Employee Search & Switcher Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--slate-500)', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>
              Select Employee Profile
            </label>
            <div 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.55rem 0.875rem',
                backgroundColor: '#ffffff',
                border: '1px solid var(--slate-300)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: isDropdownOpen ? '0 0 0 3px rgba(2, 132, 199, 0.12)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
                <div 
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, var(--primary-600) 0%, var(--primary-700) 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    flexShrink: 0
                  }}
                >
                  {currentEmp?.employee_name?.charAt(0) || 'E'}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--slate-900)', lineHeight: '1.2', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {currentEmp?.employee_name || 'Select Employee...'}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--slate-500)' }}>
                    Code: #{currentEmp?.employee_code || ''} • {currentEmp?.department || 'General'}
                  </div>
                </div>
              </div>
              <ChevronDown size={16} style={{ color: 'var(--slate-500)', flexShrink: 0 }} />
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
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-xl)',
                  zIndex: 50,
                  maxHeight: '320px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color-light)', background: 'var(--slate-50)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', background: '#ffffff', border: '1px solid var(--slate-200)', borderRadius: '6px' }}>
                    <Search size={15} style={{ color: 'var(--slate-400)' }} />
                    <input 
                      type="text"
                      placeholder="Search employee by name, code, dept..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.8125rem' }}
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
                          padding: '0.6rem 0.875rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: isSelected ? 'var(--primary-50)' : 'transparent',
                          borderLeft: isSelected ? '3px solid var(--primary-600)' : '3px solid transparent',
                          cursor: 'pointer',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--slate-50)'; }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <div>
                          <div style={{ fontWeight: isSelected ? '700' : '500', fontSize: '0.85rem', color: isSelected ? 'var(--primary-700)' : 'var(--slate-900)' }}>
                            {emp.employee_name}
                          </div>
                          <div style={{ fontSize: '0.725rem', color: 'var(--slate-500)' }}>
                            #{emp.employee_code} • {emp.designation || emp.department || 'Staff'} {emp.salary ? `• ₹${emp.salary}` : ''}
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 size={15} style={{ color: 'var(--primary-600)' }} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Month Selector */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--slate-500)', textTransform: 'uppercase', marginBottom: '0.25rem', display: 'block' }}>
              Attendance Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="form-select"
              style={{ width: 'auto', minWidth: '180px', fontWeight: '600', fontSize: '0.85rem' }}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="btn btn-secondary btn-sm"
            title="Edit Master Data & Rules for this employee"
          >
            <Edit3 size={15} color="var(--primary-600)" /> Edit Rules
          </button>

          <button
            onClick={() => handleExport('xlsx')}
            disabled={exporting || loading}
            className="btn btn-primary btn-sm"
          >
            <FileSpreadsheet size={15} /> {exporting ? 'Exporting...' : 'Export Excel'}
          </button>

          <button
            onClick={() => handleExport('csv')}
            disabled={exporting || loading}
            className="btn btn-secondary btn-sm"
          >
            <Download size={15} /> CSV
          </button>
        </div>
      </div>

      {/* Import Feedback Banner */}
      {importMessage && (
        <div 
          style={{
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: importMessage.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
            border: `1px solid ${importMessage.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
            color: importMessage.type === 'success' ? 'var(--success-text)' : 'var(--danger-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.875rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {importMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
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
        <div className="card" style={{ padding: '3.5rem', textAlign: 'center' }}>
          <RefreshCw size={30} className="spin" style={{ color: 'var(--primary-600)', marginBottom: '0.875rem' }} />
          <div style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--slate-800)' }}>
            Calculating Attendance & Salary Dynamics...
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '0.25rem' }}>
            Applying individual shift timings, tolerance grace, and rates
          </div>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center', borderColor: 'var(--danger-border)' }}>
          <AlertTriangle size={32} style={{ color: 'var(--danger-solid)', marginBottom: '0.5rem' }} />
          <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--danger-text)' }}>{error}</div>
        </div>
      ) : (
        <>
          {/* 1. Employee Profile & Master Rules Hero Card - Pure Light Theme */}
          <div className="card" style={{ padding: '1.25rem 1.5rem', position: 'relative' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
              {/* Profile Main Info */}
              <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'center' }}>
                <div 
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, var(--primary-600) 0%, var(--primary-700) 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    fontSize: '1.4rem',
                    flexShrink: 0,
                    boxShadow: '0 4px 10px rgba(2, 132, 199, 0.2)'
                  }}
                >
                  {currentEmp?.employee_name?.charAt(0) || 'E'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: 'var(--slate-900)' }}>
                      {currentEmp?.employee_name}
                    </h2>
                    <span 
                      className={`badge ${currentEmp?.status === 'Working' ? 'badge-working' : 'badge-resigned'}`}
                    >
                      {currentEmp?.status || 'Working'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--slate-600)', marginTop: '0.2rem' }}>
                    <strong>#{currentEmp?.employee_code}</strong> • {currentEmp?.department || 'General'} • {currentEmp?.designation || 'Staff'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '0.15rem' }}>
                    DOJ: {currentEmp?.doj || 'Not recorded'} • Mode: {currentEmp?.payment_mode || 'Bank'}
                  </div>
                </div>
              </div>

              {/* Working Hours & Shifts Box */}
              <div 
                style={{
                  background: 'var(--slate-50)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.875rem 1rem',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--primary-700)', fontWeight: '700', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  <Clock size={14} /> Standard Schedule
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', fontSize: '0.8125rem' }}>
                  <div><span style={{ color: 'var(--slate-500)' }}>Shift:</span> <strong>{currentEmp?.standard_in_time} - {currentEmp?.standard_out_time}</strong></div>
                  <div><span style={{ color: 'var(--slate-500)' }}>Daily Target:</span> <strong>{formatHoursToHHMM(currentEmp?.standard_work_hours)} hrs/d</strong></div>
                  <div><span style={{ color: 'var(--slate-500)' }}>Master Break:</span> <strong>{currentEmp?.standard_break_minutes || 0}m</strong></div>
                  <div><span style={{ color: 'var(--slate-500)' }}>Grace Window:</span> <strong>{currentEmp?.late_grace_minutes || 11}m</strong></div>
                  <div><span style={{ color: 'var(--slate-500)' }}>WOP Days:</span> <strong style={{ color: '#0284c7' }}>{currentEmp?.wop || 0}d</strong></div>
                  <div><span style={{ color: 'var(--slate-500)' }}>YPL Leaves:</span> <strong style={{ color: '#059669' }}>{currentEmp?.ypl || 0}d</strong></div>
                </div>
              </div>

              {/* Salary & Rates Box */}
              <div 
                style={{
                  background: 'var(--success-bg)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.875rem 1rem',
                  border: '1px solid var(--success-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--success-text)', fontWeight: '700', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  <DollarSign size={14} /> Salary & Rate Breakdown
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', fontSize: '0.8125rem' }}>
                  <div><span style={{ color: 'var(--slate-600)' }}>Base Salary:</span> <strong style={{ color: 'var(--success-text)', fontSize: '0.95rem' }}>₹{currentEmp?.salary?.toLocaleString() || '0'}</strong></div>
                  <div><span style={{ color: 'var(--slate-600)' }}>Incentive:</span> <strong style={{ color: '#0284c7' }}>₹{currentEmp?.incentive?.toLocaleString() || '0'}</strong></div>
                  <div><span style={{ color: 'var(--slate-600)' }}>Hourly Rate:</span> <strong>₹{summary?.hourlyRate}/hr</strong></div>
                  <div><span style={{ color: 'var(--slate-600)' }}>Daily Rate:</span> <strong>₹{summary?.dailyRate}/day</strong> ({summary?.calendarDays}d)</div>
                </div>
              </div>
            </div>

            {/* Special Rules / Bond Box */}
            {currentEmp?.special_rules && (
              <div 
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--warning-bg)',
                  border: '1px solid var(--warning-border)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem'
                }}
              >
                <ShieldAlert size={16} style={{ color: 'var(--warning-solid)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.775rem', color: 'var(--warning-text)', textTransform: 'uppercase' }}>
                    Special Employee Rules & Bond Terms
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#78350f', marginTop: '0.15rem', lineHeight: '1.4' }}>
                    {currentEmp.special_rules}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Dynamic Monthly Summary Cards - Light Theme */}
          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}
          >
            {/* Card 1: Attendance Rate */}
            <div className="card" style={{ padding: '1.15rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                  Attendance Rate
                </span>
                <span 
                  className="badge"
                  style={{
                    backgroundColor: summary?.attendancePercentage >= 90 ? 'var(--success-bg)' : (summary?.attendancePercentage >= 75 ? 'var(--warning-bg)' : 'var(--danger-bg)'),
                    color: summary?.attendancePercentage >= 90 ? 'var(--success-text)' : (summary?.attendancePercentage >= 75 ? 'var(--warning-text)' : 'var(--danger-text)')
                  }}
                >
                  {summary?.attendancePercentage >= 90 ? 'Excellent' : (summary?.attendancePercentage >= 75 ? 'Good' : 'Review')}
                </span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--slate-900)' }}>
                {summary?.attendancePercentage}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '0.25rem' }}>
                P: <strong>{summary?.presentDays}</strong> | WOP: <strong>{summary?.weeklyOffPresentDays}</strong> | A: <strong>{summary?.absentDays}</strong> | Off: <strong>{summary?.weeklyOffDays}</strong>
              </div>
            </div>

            {/* Card 2: Work Time Variance */}
            <div className="card" style={{ padding: '1.15rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                  Total Work Time
                </span>
                <span 
                  className="badge"
                  style={{
                    backgroundColor: Number(summary?.totalWorkDiffHours) >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)',
                    color: Number(summary?.totalWorkDiffHours) >= 0 ? 'var(--success-text)' : 'var(--danger-text)'
                  }}
                >
                  Diff: {summary?.totalWorkDiffFormatted}
                </span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--slate-900)' }}>
                {summary?.totalActualWorkFormatted || '00:00'} <span style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--slate-500)' }}>hrs</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '0.25rem' }}>
                Expected: <strong>{summary?.totalExpectedWorkFormatted || '00:00'} hrs</strong> ({summary?.workingDaysInMonth} work days)
              </div>
            </div>

            {/* Card 3: Late Arrivals */}
            <div className="card" style={{ padding: '1.15rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                  Late Arrivals
                </span>
                <span 
                  className="badge"
                  style={{
                    backgroundColor: summary?.lateDaysCount === 0 ? 'var(--success-bg)' : 'var(--warning-bg)',
                    color: summary?.lateDaysCount === 0 ? 'var(--success-text)' : 'var(--warning-text)'
                  }}
                >
                  {summary?.lateDaysCount} Late Days
                </span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: summary?.lateDaysCount > 0 ? 'var(--warning-solid)' : 'var(--slate-900)' }}>
                {summary?.totalLateFormatted || '00:00'} <span style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--slate-500)' }}>hrs</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--danger-text)', marginTop: '0.25rem' }}>
                Late Salary Deduction: <strong>-₹{summary?.totalLateDeductions}</strong>
              </div>
            </div>

            {/* Card 4: Overtime */}
            <div className="card" style={{ padding: '1.15rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                  Overtime (O.T.)
                </span>
                <span className="badge badge-dept">
                  {currentEmp?.overtime_multiplier}x Multiplier
                </span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: (summary?.totalOvertimeFormatted && summary?.totalOvertimeFormatted !== '00:00') ? 'var(--success-text)' : 'var(--slate-900)' }}>
                {summary?.totalOvertimeFormatted || '00:00'} <span style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--slate-500)' }}>hrs</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--success-text)', marginTop: '0.25rem' }}>
                Overtime Pay: <strong>+₹{summary?.totalOvertimePay}</strong> {currentEmp?.min_overtime_minutes > 0 ? `(Min: ${currentEmp.min_overtime_minutes}m)` : ''} {currentEmp?.min_overtime_deduction_minutes > 0 ? `(Ded: ${currentEmp.min_overtime_deduction_minutes}m)` : ''}
              </div>
            </div>

            {/* Card 5: Net Payable Salary */}
            <div 
              className="card"
              style={{
                padding: '1.15rem',
                background: 'linear-gradient(135deg, var(--primary-600) 0%, var(--primary-700) 100%)',
                color: '#ffffff',
                border: 'none',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#bae6fd', textTransform: 'uppercase' }}>
                  Net Payable Salary
                </span>
                <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}>
                  {selectedMonth}
                </span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#ffffff' }}>
                ₹{summary?.netPayableSalary?.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#e0f2fe', marginTop: '0.25rem' }}>
                Gross Earned: ₹{summary?.grossEarnedSalary} | Ded: ₹{summary?.totalDeductions}
              </div>
            </div>
          </div>

          {/* Sub Navigation Bar */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <button
              onClick={() => setActiveSubTab('attendance')}
              className={`btn btn-sm ${activeSubTab === 'attendance' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Daily Attendance Sheet ({records.length} Days)
            </button>

            {currentEmp?.salary_history && currentEmp?.salary_history.length > 0 && (
              <button
                onClick={() => setActiveSubTab('salary-history')}
                className={`btn btn-sm ${activeSubTab === 'salary-history' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Salary Scales & History ({currentEmp.salary_history.length} Months)
              </button>
            )}
          </div>

          {/* 3. Detailed Attendance & Calculations Table - Clean Light Theme */}
          {activeSubTab === 'attendance' && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} color="var(--primary-600)" />
                  <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--slate-900)' }}>
                    Individual Attendance Record & Dynamic Formulations
                  </span>
                </div>
                <div style={{ fontSize: '0.775rem', color: 'var(--slate-500)' }}>
                  All derived values are calculated on the fly
                </div>
              </div>

              <div className="table-responsive-wrapper" style={{ border: 'none', borderRadius: 0, maxHeight: '650px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                      <th>DATE</th>
                      <th style={{ textAlign: 'center' }}>P/A</th>
                      <th>CALC MODE</th>
                      <th>SCHED IN</th>
                      <th>SCHED OUT</th>
                      <th>TARGET</th>
                      <th>ACTUAL IN</th>
                      <th>ACTUAL OUT</th>
                      <th>DURATION</th>
                      <th>BREAK OUT</th>
                      <th>BREAK IN</th>
                      <th>EFF. BREAK</th>
                      <th>ACTUAL WORK</th>
                      <th style={{ textAlign: 'center' }}>DIFF (+/-)</th>
                      <th>LATE BY</th>
                      <th>O.T.</th>
                      <th style={{ textAlign: 'right' }}>RATE</th>
                      <th style={{ textAlign: 'right' }}>SALARY</th>
                      <th style={{ textAlign: 'right', color: 'var(--danger-text)' }}>LATE DED</th>
                      <th style={{ textAlign: 'right', color: 'var(--success-text)' }}>O.T. PAY</th>
                      <th style={{ textAlign: 'right', background: 'var(--primary-50)', color: 'var(--primary-800)' }}>NET SALARY</th>
                      <th style={{ textAlign: 'center', width: '70px' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, idx) => {
                      const isWO = r.status_code === 'WO';
                      const isWOP = r.status_code === 'WOP';
                      const isAbsent = r.status_code === 'A';
                      const isLate = r.is_late;

                      let rowBg = '#ffffff';
                      if (isWO) rowBg = '#f0f9ff';
                      if (isWOP) rowBg = '#f0fdfa';
                      if (isAbsent) rowBg = '#fff1f2';

                      return (
                        <tr 
                          key={r.attendance_date_iso || idx}
                          style={{ backgroundColor: rowBg }}
                        >
                          <td style={{ fontWeight: '600', color: 'var(--slate-900)' }}>
                            {r.attendance_date || r.attendance_date_iso}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className="badge"
                              style={{
                                backgroundColor: isAbsent ? 'var(--danger-bg)' : (isWO ? 'var(--info-bg)' : (isWOP ? 'var(--teal-50)' : 'var(--success-bg)')),
                                color: isAbsent ? 'var(--danger-text)' : (isWO ? 'var(--info-text)' : (isWOP ? 'var(--teal-700)' : 'var(--success-text)')),
                                border: `1px solid ${isAbsent ? 'var(--danger-border)' : (isWO ? 'var(--info-border)' : (isWOP ? '#a7f3d0' : 'var(--success-border)'))}`
                              }}
                            >
                              {r.status_code}
                            </span>
                          </td>
                          <td>
                            <span 
                              className={`badge ${
                                r.calc_mode === 'Normal' ? 'badge-success' :
                                r.calc_mode === 'Both late' ? 'badge-danger' :
                                r.calc_mode === 'Late IN only' ? 'badge-warning' :
                                r.calc_mode === 'Late OUT only' ? 'badge-info' :
                                'badge-secondary'
                              }`}
                              style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem' }}
                              title={
                                r.calc_mode === 'Normal' ? 'Normal: A.OUT - Scheduled IN' :
                                r.calc_mode === 'Both late' ? 'Both late: Scheduled OUT + 10m - A.IN' :
                                r.calc_mode === 'Late IN only' ? 'Late IN only: A.OUT - A.IN' :
                                r.calc_mode === 'Late OUT only' ? 'Late OUT only: Scheduled OUT + 10m - Scheduled IN' :
                                r.calc_mode
                              }
                            >
                              {r.calc_mode || 'Normal'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--slate-600)' }}>{r.scheduled_in_time}</td>
                          <td style={{ color: 'var(--slate-600)' }}>{r.scheduled_out_time}</td>
                          <td style={{ fontWeight: '600', color: 'var(--slate-700)' }}>{r.scheduled_work_formatted}</td>
                          <td style={{ fontWeight: isLate ? '700' : 'normal', color: isLate ? 'var(--warning-text)' : 'var(--slate-900)', background: isLate ? 'var(--warning-bg)' : 'transparent' }}>
                            {r.actual_in_time || '—'}
                          </td>
                          <td style={{ color: 'var(--slate-900)' }}>{r.actual_out_time || '—'}</td>
                          <td style={{ color: 'var(--slate-600)' }}>{r.actual_duration_formatted}</td>
                          <td style={{ color: 'var(--slate-700)' }}>{r.break_out || '—'}</td>
                          <td style={{ color: 'var(--slate-700)' }}>{r.break_in || '—'}</td>
                          <td style={{ color: r.effective_break_minutes > 0 ? 'var(--primary-700)' : 'var(--slate-400)', fontWeight: r.effective_break_minutes > 0 ? '600' : 'normal' }} title={`Actual: ${r.actual_break_formatted}, Master: ${r.scheduled_break_formatted}`}>
                            {r.effective_break_minutes > 0 ? r.effective_break_formatted : '—'}
                          </td>
                          <td style={{ fontWeight: '700', color: 'var(--slate-900)' }}>{r.actual_work_formatted}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontWeight: '700', color: r.work_diff_minutes > 0 ? 'var(--success-text)' : (r.work_diff_minutes < 0 ? 'var(--danger-text)' : 'var(--slate-500)') }}>
                              {r.work_diff_formatted}
                            </span>
                          </td>
                          <td style={{ color: isLate ? 'var(--warning-text)' : 'var(--slate-400)', fontWeight: isLate ? '700' : 'normal' }}>
                            {isLate ? r.late_formatted : '—'}
                          </td>
                          <td style={{ color: r.overtime_minutes > 0 ? 'var(--success-text)' : 'var(--slate-400)', fontWeight: r.overtime_minutes > 0 ? '700' : 'normal' }}>
                            {r.overtime_minutes > 0 ? r.overtime_formatted : '—'}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--slate-500)' }}>₹{r.hourly_rate}</td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>₹{r.daily_salary_earned}</td>
                          <td style={{ textAlign: 'right', color: r.late_salary_deduction > 0 ? 'var(--danger-text)' : 'var(--slate-400)' }}>
                            {r.late_salary_deduction > 0 ? `-₹${r.late_salary_deduction}` : '—'}
                          </td>
                          <td style={{ textAlign: 'right', color: r.overtime_pay > 0 ? 'var(--success-text)' : 'var(--slate-400)' }}>
                            {r.overtime_pay > 0 ? `+₹${r.overtime_pay}` : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--primary-700)', background: 'var(--primary-50)' }}>
                            ₹{r.net_daily_salary}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRecordForEdit(r);
                                setIsDayEditModalOpen(true);
                              }}
                              className="btn btn-outline-primary btn-sm"
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.725rem', gap: '0.25rem' }}
                              title="Edit Attendance / Punches / Deductions"
                            >
                              <Edit3 size={12} />
                              <span>Edit</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot style={{ position: 'sticky', bottom: 0, background: 'var(--slate-100)', borderTop: '2px solid var(--slate-300)', fontWeight: '700', zIndex: 10 }}>
                    <tr>
                      <td>TOTAL</td>
                      <td style={{ textAlign: 'center' }}>{summary?.presentDays}P/{summary?.absentDays}A</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>{summary?.totalExpectedWorkFormatted || '00:00'}</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td style={{ color: 'var(--primary-700)' }}>{summary?.totalActualBreakFormatted || '00:00'}</td>
                      <td style={{ color: 'var(--primary-700)' }}>{summary?.totalActualWorkFormatted || '00:00'}</td>
                      <td style={{ textAlign: 'center', color: Number(summary?.totalWorkDiffHours) >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                        {summary?.totalWorkDiffFormatted}
                      </td>
                      <td style={{ color: 'var(--warning-text)' }}>{summary?.totalLateFormatted}</td>
                      <td style={{ color: 'var(--success-text)' }}>{summary?.totalOvertimeFormatted}</td>
                      <td style={{ textAlign: 'right' }}>—</td>
                      <td style={{ textAlign: 'right' }}>₹{summary?.grossEarnedSalary}</td>
                      <td style={{ textAlign: 'right', color: 'var(--danger-text)' }}>-₹{summary?.totalLateDeductions}</td>
                      <td style={{ textAlign: 'right', color: 'var(--success-text)' }}>+₹{summary?.totalOvertimePay}</td>
                      <td style={{ textAlign: 'right', color: 'var(--primary-700)', fontSize: '0.95rem', background: 'var(--primary-100)' }}>₹{summary?.netPayableSalary}</td>
                      <td style={{ textAlign: 'center' }}>—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 4. Historical Salary Scales Table */}
          {activeSubTab === 'salary-history' && currentEmp?.salary_history && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="card-header">
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: 'var(--slate-900)' }}>
                  Historical Salary Scale & Rate Revisions (From Excel Columns Z, AA, AB, AC, AD)
                </h3>
              </div>
              <div className="table-responsive-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>MONTH</th>
                      <th style={{ textAlign: 'right' }}>PER DAY RATE (₹)</th>
                      <th style={{ textAlign: 'right' }}>PER HOUR RATE (₹)</th>
                      <th style={{ textAlign: 'right' }}>BASE SALARY (₹)</th>
                      <th style={{ textAlign: 'right' }}>ACTUAL SALARY (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentEmp.salary_history.map((h, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: '600', color: 'var(--slate-900)' }}>{h.month}</td>
                        <td style={{ textAlign: 'right', color: 'var(--slate-700)' }}>₹{h.perDay}</td>
                        <td style={{ textAlign: 'right', color: 'var(--slate-700)' }}>₹{h.perHour}</td>
                        <td style={{ textAlign: 'right', fontWeight: '600' }}>₹{h.baseSalary?.toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--primary-700)' }}>₹{h.actualSalary?.toLocaleString()}</td>
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
          onUpdated={async () => {
            const res = await attendanceApi.getEmployeeSheet(selectedEmployeeCode, { month: selectedMonth });
            setSheetData(res.data);
          }}
        />
      )}

      {/* Edit Day Attendance Record Modal */}
      {isDayEditModalOpen && selectedRecordForEdit && (
        <EditDayAttendanceModal
          isOpen={isDayEditModalOpen}
          record={selectedRecordForEdit}
          employee={currentEmp}
          onClose={() => {
            setIsDayEditModalOpen(false);
            setSelectedRecordForEdit(null);
          }}
          onUpdated={async () => {
            const res = await attendanceApi.getEmployeeSheet(selectedEmployeeCode, { month: selectedMonth });
            setSheetData(res.data);
          }}
        />
      )}
    </div>
  );
};
