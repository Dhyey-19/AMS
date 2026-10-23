import React, { useState, useEffect, useRef } from 'react';
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
  Sparkles,
  Users,
  Printer,
  Pin,
  Columns,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Coffee,
  Layers,
  Check,
  X,
  RotateCcw,
  Plus,
  Minus,
  UserCheck,
  UserX,
  Archive
} from 'lucide-react';
import { employeeApi, attendanceApi } from '../services/api';
import { EditEmployeeMasterModal } from '../components/employees/EditEmployeeMasterModal';
import { EditDayAttendanceModal } from '../components/attendance/EditDayAttendanceModal';
import { EmployeeAttendancePdfModal } from '../components/attendance/EmployeeAttendancePdfModal';
import { printEmployeeAttendance } from '../utils/employeeAttendancePdf';
import { calculateDayRule } from '../utils/attendanceCalculator';

const formatHoursToHHMM = (hrs) => {
  if (hrs === null || hrs === undefined || isNaN(hrs)) return '00:00';
  const totalMins = Math.round(Number(hrs) * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const formatBreakToHHMM = (val) => {
  if (val === null || val === undefined || val === '') return '00:00';
  if (typeof val === 'string' && val.includes(':')) {
    const parts = val.split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const num = parseFloat(val);
  if (isNaN(num)) return '00:00';
  if (num <= 12 && String(val).includes('.')) {
    const totalMins = Math.round(num * 60);
    const h = Math.floor(totalMins / 60);
    const m = Math.round(totalMins % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const totalMins = Math.round(num);
  const h = Math.floor(totalMins / 60);
  const m = Math.round(totalMins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const ATTENDANCE_COLUMNS = [
  { id: 'date', label: 'DATE', width: 120, description: 'Attendance Date' },
  { id: 'manual', label: 'MANUAL', width: 75, align: 'center', description: 'Manual Record (Rule Calculated & Fully Editable)' },
  { id: 'status', label: 'P/A', width: 68, align: 'center', description: 'Status (P/A/WO/WOP/HD/L)' },
  { id: 'calc_mode', label: 'CALC MODE', width: 118, description: 'Calculation Mode' },
  { id: 'sched_in', label: 'SCHED IN', width: 88, description: 'Scheduled In Time' },
  { id: 'sched_out', label: 'SCHED OUT', width: 88, description: 'Scheduled Out Time' },
  { id: 'target', label: 'TARGET', width: 82, description: 'Target Shift Duration' },
  { id: 'std_break', label: 'STD BREAK', width: 88, description: 'Standard Break' },
  { id: 'sched_work', label: 'WORK TIME', width: 92, description: 'Scheduled Work Time' },
  { id: 'actual_in', label: 'ACTUAL IN', width: 90, description: 'Actual In Time' },
  { id: 'actual_out', label: 'ACTUAL OUT', width: 90, description: 'Actual Out Time' },
  { id: 'actual_duration', label: 'DURATION', width: 90, description: 'Duration' },
  { id: 'break_out', label: 'BREAK OUT', width: 90, description: 'Break Out' },
  { id: 'break_in', label: 'BREAK IN', width: 90, description: 'Break In' },
  { id: 'effective_break', label: 'EFF. BREAK', width: 90, description: 'Effective Break' },
  { id: 'actual_work', label: 'ACTUAL WORK', width: 95, description: 'Actual Work Time' },
  { id: 'work_diff', label: 'DIFF (+/-)', width: 85, align: 'center', description: 'Work Difference' },
  { id: 'late_by', label: 'LATE BY', width: 85, description: 'Late By' },
  { id: 'overtime', label: 'O.T.', width: 85, description: 'Overtime' },
  { id: 'rate', label: 'RATE', width: 75, align: 'right', description: 'Hourly Rate' },
  { id: 'daily_salary', label: 'SALARY', width: 90, align: 'right', description: 'Daily Salary' },
  { id: 'late_ded', label: 'LATE DED', width: 85, align: 'right', description: 'Late Deduction' },
  { id: 'ot_pay', label: 'O.T. PAY', width: 85, align: 'right', description: 'Overtime Pay' },
  { id: 'leave_ded', label: 'LEAVE DED', width: 85, align: 'right', description: 'Leave Deduction' },
  { id: 'penalty', label: 'PENALTY', width: 85, align: 'right', description: 'Penalty' },
  { id: 'net_salary', label: 'NET SALARY', width: 105, align: 'right', description: 'Net Daily Salary' },
  { id: 'punch_records', label: 'PUNCHES', width: 130, description: 'Punch Records' },
  { id: 'remarks', label: 'REMARKS', width: 130, description: 'Remarks' },
  { id: 'action', label: 'ACTION', width: 80, align: 'center', description: 'Actions' }
];

export const EmployeeAttendancePage = ({ initialEmployeeCode, onNavigateToEmployees }) => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeCode, setSelectedEmployeeCode] = useState(initialEmployeeCode || '');
  const [viewMode, setViewMode] = useState('active'); // 'active' for routine active staff, 'resigned' for resigned archive
  const [selectedMonth, setSelectedMonth] = useState('2026-05');
  const [availableMonths, setAvailableMonths] = useState(['2026-05', '2026-04', '2026-06', '2026-07', '2026-08']);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [sheetData, setSheetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRecordForEdit, setSelectedRecordForEdit] = useState(null);
  const [isDayEditModalOpen, setIsDayEditModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('attendance'); // 'attendance', 'salary-history'
  const [importMessage, setImportMessage] = useState(null);

  // Inline editing state for manual type & save
  const [inlineEditingDate, setInlineEditingDate] = useState(null);
  const [inlineFormData, setInlineFormData] = useState({});
  const [inlineSaving, setInlineSaving] = useState(false);

  // Number of days in selected month (e.g. 30, 31, 28)
  const daysInMonth = React.useMemo(() => {
    if (!selectedMonth) return 30;
    const parts = selectedMonth.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(y) && !isNaN(m)) return new Date(y, m, 0).getDate();
    return 30;
  }, [selectedMonth]);

  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const defaults = ATTENDANCE_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: true }), {});
    try {
      const saved = localStorage.getItem('ams_employee_attendance_visible_columns');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.manual === undefined) parsed.manual = true;
        return { ...defaults, ...parsed };
      }
    } catch (e) {}
    return defaults;
  });

  // Column Manager Dropdown Popover State
  const [isColManagerOpen, setIsColManagerOpen] = useState(false);
  const [colSearchQuery, setColSearchQuery] = useState('');
  const colManagerRef = useRef(null);

  // Freeze Columns State (Defaults to 2 columns: DATE and P/A)
  const [freezeColumnsCount, setFreezeColumnsCount] = useState(() => {
    try {
      const saved = localStorage.getItem('ams_employee_attendance_freeze_cols');
      return saved !== null ? Number(saved) : 2;
    } catch (e) {
      return 2;
    }
  });

  const handleFreezeColumnsChange = (count) => {
    setFreezeColumnsCount(count);
    try {
      localStorage.setItem('ams_employee_attendance_freeze_cols', String(count));
    } catch (e) {}
  };

  // Helper to toggle visibility of an individual column
  const toggleColumnVisibility = (colId) => {
    setVisibleColumns(prev => {
      const next = { ...prev, [colId]: !prev[colId] };
      try { localStorage.setItem('ams_employee_attendance_visible_columns', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  // Helper to show all columns
  const showAllColumns = () => {
    const allVisible = ATTENDANCE_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: true }), {});
    setVisibleColumns(allVisible);
    try { localStorage.setItem('ams_employee_attendance_visible_columns', JSON.stringify(allVisible)); } catch (e) {}
  };

  // Active Visible Columns List
  const activeVisibleColumns = ATTENDANCE_COLUMNS.filter(col => visibleColumns[col.id]);

  const getStickyStyle = (colId, isHeader = false, isFooter = false, rowBg = '#ffffff', extraStyle = {}) => {
    const colIndex = activeVisibleColumns.findIndex(c => c.id === colId);
    if (colIndex === -1 || colIndex >= freezeColumnsCount) {
      return extraStyle;
    }

    let left = 0;
    for (let i = 0; i < colIndex; i++) {
      left += activeVisibleColumns[i].width || 85;
    }

    const width = activeVisibleColumns[colIndex].width || 85;
    const isLastFrozen = colIndex === freezeColumnsCount - 1;

    let bg = rowBg;
    let zIndex = 5;

    if (isHeader) {
      bg = '#f1f5f9';
      zIndex = 25;
    } else if (isFooter) {
      bg = 'var(--slate-100)';
      zIndex = 25;
    }

    return {
      ...extraStyle,
      position: 'sticky',
      left: `${left}px`,
      zIndex,
      backgroundColor: bg,
      minWidth: `${width}px`,
      width: `${width}px`,
      maxWidth: `${width}px`,
      boxShadow: isLastFrozen ? '4px 0 8px -2px rgba(0, 0, 0, 0.14)' : undefined,
      borderRight: isLastFrozen ? '1px solid var(--slate-300)' : undefined
    };
  };

  const inlineInputStyle = {
    width: '100%',
    padding: '2px 4px',
    fontSize: '0.75rem',
    borderRadius: '4px',
    border: '1px solid var(--primary-500)',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box'
  };

  const handleToggleManual = async (r) => {
    if (r.is_manual) {
      if (window.confirm(`Revert record for ${r.attendance_date_iso} to automatic calculations?\n\nDynamic formulas and standard master shift rules will be applied.`)) {
        try {
          setLoading(true);
          await attendanceApi.updateRecord(selectedEmployeeCode, r.attendance_date_iso, { is_manual: 0 });
          const res = await attendanceApi.getEmployeeSheet(selectedEmployeeCode, { month: selectedMonth });
          setSheetData(res.data);
          if (inlineEditingDate === r.attendance_date_iso) {
            setInlineEditingDate(null);
          }
        } catch (err) {
          alert(err.message || 'Failed to revert record');
        } finally {
          setLoading(false);
        }
      }
    } else {
      // User ticked manual on a record!
      // Activate inline editing row and run rule calculation dynamically
      setInlineEditingDate(r.attendance_date_iso);
      const initialForm = {
        is_manual: 1,
        attendance_date: r.attendance_date || r.attendance_date_iso,
        attendance_date_iso: r.attendance_date_iso,
        status_code: r.status_code || 'P',
        calc_mode: r.calc_mode || 'Normal',
        scheduled_in_time: r.scheduled_in_time || currentEmp?.standard_in_time || '08:00',
        scheduled_out_time: r.scheduled_out_time || currentEmp?.standard_out_time || '20:00',
        scheduled_duration_formatted: r.scheduled_duration_formatted || '12:00',
        scheduled_break_formatted: r.scheduled_break_formatted || '00:00',
        scheduled_work_formatted: r.scheduled_work_formatted || '12:00',
        in_time: r.actual_in_time || r.in_time || '',
        out_time: r.actual_out_time || r.out_time || '',
        actual_duration_formatted: r.actual_duration_formatted || r.total_duration || '00:00',
        break_out: r.break_out || '',
        break_in: r.break_in || '',
        effective_break_formatted: r.effective_break_formatted || '00:00',
        actual_work_formatted: r.actual_work_formatted || '00:00',
        work_diff_formatted: r.work_diff_formatted || '00:00',
        late_formatted: r.late_formatted || '00:00',
        overtime_formatted: r.overtime_formatted || '00:00',
        hourly_rate: r.hourly_rate !== undefined && r.hourly_rate !== null ? r.hourly_rate : '',
        daily_salary_earned: r.daily_salary_earned !== undefined && r.daily_salary_earned !== null ? r.daily_salary_earned : '',
        late_salary_deduction: r.late_salary_deduction !== undefined && r.late_salary_deduction !== null ? r.late_salary_deduction : 0,
        overtime_pay: r.overtime_pay !== undefined && r.overtime_pay !== null ? r.overtime_pay : 0,
        leave_deduction: r.leave_deduction || 0,
        penalty_amount: r.penalty_amount || 0,
        net_daily_salary: r.net_daily_salary !== undefined && r.net_daily_salary !== null ? r.net_daily_salary : '',
        punch_records: r.punch_records || '',
        remarks: r.remarks || ''
      };
      const calculated = calculateDayRule(initialForm, currentEmp, daysInMonth, null);
      setInlineFormData(calculated);
    }
  };

  const handleInlineChange = (field, value) => {
    setInlineFormData(prev => {
      const updated = { ...prev, [field]: value };
      return calculateDayRule(updated, currentEmp, daysInMonth, field);
    });
  };

  const handleSaveInline = async (dateIso) => {
    try {
      setInlineSaving(true);
      const payload = {
        is_manual: 1,
        attendance_date: inlineFormData.attendance_date || dateIso,
        status_code: (inlineFormData.status_code || 'P').toUpperCase().trim(),
        calc_mode: inlineFormData.calc_mode || 'Normal',
        scheduled_in_time: inlineFormData.scheduled_in_time || '',
        scheduled_out_time: inlineFormData.scheduled_out_time || '',
        scheduled_duration_formatted: inlineFormData.scheduled_duration_formatted || '',
        scheduled_break_formatted: inlineFormData.scheduled_break_formatted || '',
        scheduled_work_formatted: inlineFormData.scheduled_work_formatted || '',
        in_time: inlineFormData.in_time ? inlineFormData.in_time.trim() : '',
        out_time: inlineFormData.out_time ? inlineFormData.out_time.trim() : '',
        actual_duration_formatted: inlineFormData.actual_duration_formatted || '',
        break_out: inlineFormData.break_out ? inlineFormData.break_out.trim() : '',
        break_in: inlineFormData.break_in ? inlineFormData.break_in.trim() : '',
        effective_break_formatted: inlineFormData.effective_break_formatted || '',
        actual_work_formatted: inlineFormData.actual_work_formatted || '',
        work_diff_formatted: inlineFormData.work_diff_formatted || '',
        late_formatted: inlineFormData.late_formatted || '',
        overtime_formatted: inlineFormData.overtime_formatted || '',
        hourly_rate: inlineFormData.hourly_rate !== '' && inlineFormData.hourly_rate !== undefined ? parseFloat(inlineFormData.hourly_rate) : undefined,
        daily_salary_earned: inlineFormData.daily_salary_earned !== '' && inlineFormData.daily_salary_earned !== undefined ? parseFloat(inlineFormData.daily_salary_earned) : undefined,
        late_salary_deduction: inlineFormData.late_salary_deduction !== '' && inlineFormData.late_salary_deduction !== undefined ? parseFloat(inlineFormData.late_salary_deduction) : 0,
        overtime_pay: inlineFormData.overtime_pay !== '' && inlineFormData.overtime_pay !== undefined ? parseFloat(inlineFormData.overtime_pay) : 0,
        leave_deduction: parseFloat(inlineFormData.leave_deduction) || 0,
        penalty_amount: parseFloat(inlineFormData.penalty_amount) || 0,
        net_daily_salary: inlineFormData.net_daily_salary !== '' && inlineFormData.net_daily_salary !== undefined ? parseFloat(inlineFormData.net_daily_salary) : undefined,
        punch_records: inlineFormData.punch_records ? inlineFormData.punch_records.trim() : '',
        remarks: inlineFormData.remarks ? inlineFormData.remarks.trim() : ''
      };

      await attendanceApi.updateRecord(selectedEmployeeCode, dateIso, payload);
      setInlineEditingDate(null);
      const res = await attendanceApi.getEmployeeSheet(selectedEmployeeCode, { month: selectedMonth });
      setSheetData(res.data);
    } catch (err) {
      alert(err.message || 'Failed to save manual record');
    } finally {
      setInlineSaving(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // 1. Fetch Employee List and Available Months on load
  useEffect(() => {
    const initPage = async () => {
      try {
        const [empRes, monthsRes] = await Promise.all([
          employeeApi.getAll({ limit: 1000, sortBy: 'employee_code', sortOrder: 'asc' }),
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

        // Always default strictly to Active Staff tab
        setViewMode('active');

        const activeList = empList.filter(e => e.status !== 'Resigned');
        const defaultActive = (initialEmployeeCode && activeList.find(e => e.employee_code === initialEmployeeCode)) ||
                              activeList.find(e => e.employee_code === '128') ||
                              activeList[0] ||
                              empList[0];

        if (defaultActive) {
          setSelectedEmployeeCode(defaultActive.employee_code);
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

  const activeEmployees = employees.filter(e => e.status !== 'Resigned');
  const resignedEmployees = employees.filter(e => e.status === 'Resigned');

  const currentPool = viewMode === 'active' ? activeEmployees : resignedEmployees;

  const filteredEmployees = currentPool.filter(e => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      e.employee_name?.toLowerCase().includes(q) ||
      e.employee_code?.toString().includes(q) ||
      (e.department && e.department.toLowerCase().includes(q)) ||
      (e.designation && e.designation.toLowerCase().includes(q))
    );
  });

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
          gap: '1rem',
          borderLeft: viewMode === 'resigned' ? '4px solid #f43f5e' : '4px solid var(--primary-600)'
        }}
      >
        {/* Left: Employee Search & Switcher Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '440px' }} ref={dropdownRef}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: viewMode === 'active' ? 'var(--slate-600)' : '#9f1239', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {viewMode === 'active' ? (
                  <>
                    <UserCheck size={14} style={{ color: 'var(--primary-600)' }} />
                    Active Staff Profile
                  </>
                ) : (
                  <>
                    <UserX size={14} style={{ color: '#dc2626' }} />
                    Resigned Staff Archive
                  </>
                )}
              </label>

              {/* Segmented Option to switch between Routine Active Staff & Resigned Records */}
              <div style={{ display: 'inline-flex', padding: '2px', background: 'var(--slate-100)', borderRadius: '6px', border: '1px solid var(--slate-200)' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (viewMode !== 'active') {
                      setViewMode('active');
                      const firstActive = activeEmployees.find(e => e.employee_code === '128') || activeEmployees[0];
                      if (firstActive) setSelectedEmployeeCode(firstActive.employee_code);
                      setSearchQuery('');
                    }
                  }}
                  title="Routine Active Staff Selection"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.725rem',
                    fontWeight: viewMode === 'active' ? '700' : '500',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    background: viewMode === 'active' ? '#ffffff' : 'transparent',
                    color: viewMode === 'active' ? 'var(--primary-700)' : 'var(--slate-600)',
                    boxShadow: viewMode === 'active' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <UserCheck size={12} style={{ color: viewMode === 'active' ? 'var(--primary-600)' : 'var(--slate-400)' }} />
                  Active Staff ({activeEmployees.length})
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (viewMode !== 'resigned') {
                      setViewMode('resigned');
                      if (resignedEmployees.length > 0) {
                        setSelectedEmployeeCode(resignedEmployees[0].employee_code);
                      }
                      setSearchQuery('');
                    }
                  }}
                  title="Separate Option: View Resigned Employee Records Archive"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.725rem',
                    fontWeight: viewMode === 'resigned' ? '700' : '500',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    background: viewMode === 'resigned' ? '#fee2e2' : 'transparent',
                    color: viewMode === 'resigned' ? '#991b1b' : 'var(--slate-600)',
                    boxShadow: viewMode === 'resigned' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <UserX size={12} style={{ color: viewMode === 'resigned' ? '#dc2626' : 'var(--slate-400)' }} />
                  Resigned Archive ({resignedEmployees.length})
                </button>
              </div>
            </div>

            <div 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.55rem 0.875rem',
                backgroundColor: viewMode === 'resigned' ? '#fffafb' : '#ffffff',
                border: viewMode === 'resigned' ? '1px solid #fecdd3' : '1px solid var(--slate-300)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: isDropdownOpen 
                  ? (viewMode === 'resigned' ? '0 0 0 3px rgba(244, 63, 94, 0.15)' : '0 0 0 3px rgba(2, 132, 199, 0.12)')
                  : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden' }}>
                <div 
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: currentEmp?.status === 'Resigned'
                      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                      : 'linear-gradient(135deg, var(--primary-600) 0%, var(--primary-700) 100%)',
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--slate-900)', lineHeight: '1.2', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {currentEmp?.employee_name || 'Select Employee...'}
                    </span>
                    {currentEmp?.status && (
                      <span 
                        className={`badge ${currentEmp.status === 'Working' ? 'badge-working' : 'badge-resigned'}`}
                        style={{ fontSize: '0.675rem', padding: '0.1rem 0.4rem', lineHeight: '1' }}
                      >
                        <span className="badge-dot" style={{ width: '5px', height: '5px' }}></span>
                        {currentEmp.status}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--slate-500)', marginTop: '0.1rem' }}>
                    Code: #{currentEmp?.employee_code || ''} • {currentEmp?.department || 'General'} • {currentEmp?.designation || 'Staff'}
                    {currentEmp?.status === 'Resigned' && currentEmp?.dor ? ` • Resigned: ${currentEmp.dor}` : ''}
                  </div>
                </div>
              </div>
              <ChevronDown 
                size={16} 
                style={{ 
                  color: 'var(--slate-500)', 
                  flexShrink: 0, 
                  transform: isDropdownOpen ? 'rotate(180deg)' : 'none', 
                  transition: 'transform 0.2s' 
                }} 
              />
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
                  maxHeight: '380px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Search Header */}
                <div style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--border-color-light)', background: viewMode === 'resigned' ? '#fff1f2' : 'var(--slate-50)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', background: '#ffffff', border: viewMode === 'resigned' ? '1px solid #fecdd3' : '1px solid var(--slate-200)', borderRadius: '6px' }}>
                    <Search size={15} style={{ color: viewMode === 'resigned' ? '#f43f5e' : 'var(--slate-400)' }} />
                    <input 
                      type="text"
                      placeholder={viewMode === 'active' ? "Search active employees by name, code, dept..." : "Search resigned records archive..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.8125rem' }}
                      autoFocus
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem', padding: '0 0.2rem', fontSize: '0.7rem', color: viewMode === 'resigned' ? '#9f1239' : 'var(--slate-500)', fontWeight: '600' }}>
                    <span>
                      {viewMode === 'active' ? `Showing Active Staff (${filteredEmployees.length})` : `Showing Resigned Staff Archive (${filteredEmployees.length})`}
                    </span>
                    {searchQuery && (
                      <button 
                        type="button" 
                        onClick={() => setSearchQuery('')}
                        style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Employee List Items */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {filteredEmployees.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--slate-400)', fontSize: '0.8125rem' }}>
                      {viewMode === 'active' 
                        ? 'No active employees match your search.' 
                        : 'No resigned employee records match your search.'}
                    </div>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const isSelected = emp.employee_code === selectedEmployeeCode;
                      const isResigned = emp.status === 'Resigned';
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
                            backgroundColor: isSelected 
                              ? (isResigned ? '#fff1f2' : 'var(--primary-50)') 
                              : 'transparent',
                            borderLeft: isSelected 
                              ? (isResigned ? '3px solid #e11d48' : '3px solid var(--primary-600)') 
                              : '3px solid transparent',
                            cursor: 'pointer',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = isResigned ? '#fffafb' : 'var(--slate-50)'; }}
                          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                            <div 
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                background: isResigned ? '#fee2e2' : '#e0f2fe',
                                color: isResigned ? '#b91c1c' : '#0369a1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: '700',
                                fontSize: '0.775rem',
                                flexShrink: 0
                              }}
                            >
                              {emp.employee_name?.charAt(0) || 'E'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: isSelected ? '700' : '600', fontSize: '0.85rem', color: isSelected ? (isResigned ? '#9f1239' : 'var(--primary-700)') : 'var(--slate-900)' }}>
                                  {emp.employee_name}
                                </span>
                                <span 
                                  className={`badge ${emp.status === 'Working' ? 'badge-working' : 'badge-resigned'}`}
                                  style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem' }}
                                >
                                  <span className="badge-dot" style={{ width: '4px', height: '4px' }}></span>
                                  {emp.status || 'Working'}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.725rem', color: 'var(--slate-500)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                #{emp.employee_code} • {emp.department || 'General'} • {emp.designation || 'Staff'} {emp.dor ? `• DOR: ${emp.dor}` : ''}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 
                              size={15} 
                              style={{ color: isResigned ? '#e11d48' : 'var(--primary-600)', flexShrink: 0, marginLeft: '0.5rem' }} 
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Dropdown Footer: Instant Switch Between Active and Resigned Archive */}
                {viewMode === 'active' ? (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewMode('resigned');
                      if (resignedEmployees.length > 0) {
                        setSelectedEmployeeCode(resignedEmployees[0].employee_code);
                      }
                      setIsDropdownOpen(false);
                      setSearchQuery('');
                    }}
                    style={{
                      padding: '0.65rem 0.875rem',
                      backgroundColor: '#fff1f2',
                      borderTop: '1px solid #fecdd3',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      color: '#9f1239',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffe4e6'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff1f2'}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <UserX size={14} style={{ color: '#e11d48' }} />
                      Need past employee data? View Resigned Archive ({resignedEmployees.length})
                    </span>
                    <span style={{ textDecoration: 'underline', color: '#be123c', fontWeight: '700' }}>Open Archive →</span>
                  </div>
                ) : (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewMode('active');
                      const firstActive = activeEmployees.find(e => e.employee_code === '128') || activeEmployees[0];
                      if (firstActive) setSelectedEmployeeCode(firstActive.employee_code);
                      setIsDropdownOpen(false);
                      setSearchQuery('');
                    }}
                    style={{
                      padding: '0.65rem 0.875rem',
                      backgroundColor: '#f0fdf4',
                      borderTop: '1px solid #bbf7d0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      color: '#166534',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dcfce7'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <UserCheck size={14} style={{ color: '#16a34a' }} />
                      Return to Routine Active Staff Selection ({activeEmployees.length})
                    </span>
                    <span style={{ textDecoration: 'underline', color: '#15803d', fontWeight: '700' }}>Back to Active</span>
                  </div>
                )}
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

          {/* PDF Statement & Print Options */}
          <button
            onClick={() => setIsPdfModalOpen(true)}
            disabled={loading || !sheetData}
            className="btn btn-secondary btn-sm"
            style={{
              borderColor: '#f43f5e',
              color: '#e11d48',
              backgroundColor: '#fff1f2',
              fontWeight: '700'
            }}
            title="Open PDF Preview & Export Options"
          >
            <FileText size={15} color="#e11d48" /> PDF Statement
          </button>

          <button
            onClick={() => printEmployeeAttendance(sheetData)}
            disabled={loading || !sheetData}
            className="btn btn-secondary btn-sm"
            title="Direct 1-Click Print / Save as PDF"
          >
            <Printer size={15} color="var(--slate-600)" /> Print
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

      {/* Resigned Staff Archive Mode Notice Banner */}
      {viewMode === 'resigned' && (
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1.25rem',
            background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
            border: '1px solid #fecdd3',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 1px 3px rgba(225, 29, 72, 0.06)',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <UserX size={18} style={{ color: '#e11d48' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#9f1239' }}>
                Resigned Staff Archive Mode Active
              </div>
              <div style={{ fontSize: '0.775rem', color: '#be123c' }}>
                You are viewing historical attendance and calculation records for past employee <strong>{currentEmp?.employee_name}</strong> (#{currentEmp?.employee_code}{currentEmp?.dor ? ` • Resigned on: ${currentEmp.dor}` : ''}). Routine employee selection remains unaffected.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setViewMode('active');
              const firstActive = activeEmployees.find(e => e.employee_code === '128') || activeEmployees[0];
              if (firstActive) setSelectedEmployeeCode(firstActive.employee_code);
            }}
            className="btn btn-secondary btn-sm"
            style={{ 
              fontSize: '0.775rem', 
              padding: '0.35rem 0.85rem', 
              background: '#ffffff', 
              borderColor: '#fda4af', 
              color: '#9f1239', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <UserCheck size={14} />
            Switch Back to Active Staff
          </button>
        </div>
      )}

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
                  <div><span style={{ color: 'var(--slate-500)' }}>Weekly Off:</span> <strong style={{ color: '#0369a1' }}>{currentEmp?.weekly_off_days || 'Sunday'}</strong></div>
                  <div><span style={{ color: 'var(--slate-500)' }}>Master Break:</span> <strong style={{ color: 'var(--primary-700)' }}>{formatBreakToHHMM(currentEmp?.standard_break_time || currentEmp?.standard_break_minutes || 0)}</strong></div>
                  <div><span style={{ color: 'var(--slate-500)' }}>Grace Window:</span> <strong>{currentEmp?.late_grace_minutes || 11}m</strong></div>
                  <div><span style={{ color: 'var(--slate-500)' }}>WOP Days:</span> <strong style={{ color: '#0284c7' }}>{currentEmp?.wop || 0}d{currentEmp?.wop_work_hours ? ` (${formatHoursToHHMM(currentEmp.wop_work_hours)}h)` : ''}</strong></div>
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

            {/* Multi-W.E.F. Active Notification */}
            {summary?.isMultiWefMonth && (
              <div 
                style={{
                  marginTop: '0.85rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  color: '#1e40af',
                  fontSize: '0.8125rem'
                }}
              >
                <Calendar size={16} color="#2563eb" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Mid-Month W.E.F. Multi-Rate Schedule Active:</strong> This month applies dynamic rate & shift schedule changes across W.E.F. revisions ({summary.wefDatesUsed?.join(', ')}). Daily rates and earnings dynamically reflect each date's active configuration.
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
                {Boolean(summary?.sandwichAbsentDays > 0) && (
                  <span style={{ color: '#b91c1c', fontWeight: '700' }}> | Sandwich: {summary.sandwichAbsentDays}</span>
                )}
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
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                  {/* Freeze Column Controls */}
                  <div className="freeze-control-badge" title="Freeze columns while scrolling horizontally">
                    <Pin size={13} style={{ transform: 'rotate(45deg)', color: 'var(--primary-600)' }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--slate-600)' }}>Freeze:</span>
                    <select
                      id="employee-attendance-freeze-select"
                      value={freezeColumnsCount}
                      onChange={(e) => handleFreezeColumnsChange(Number(e.target.value))}
                      className="freeze-select"
                      aria-label="Freeze Columns"
                    >
                      <option value={0}>None (0)</option>
                      <option value={1}>1 (Date)</option>
                      <option value={2}>2 (Date, P/A) — Default</option>
                      <option value={3}>3 Columns</option>
                      <option value={4}>4 Columns</option>
                      <option value={5}>5 Columns</option>
                      <option value={6}>6 Columns</option>
                    </select>
                  </div>

                  {/* Manage Columns Popover Toggle */}
                  <div style={{ position: 'relative' }} ref={colManagerRef}>
                    <button
                      type="button"
                      onClick={() => setIsColManagerOpen(prev => !prev)}
                      className={`btn btn-sm ${isColManagerOpen ? 'btn-primary' : 'btn-outline-primary'}`}
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', gap: '0.35rem' }}
                      title="Hide or Show Columns"
                    >
                      <SlidersHorizontal size={13} />
                      <span>Columns ({activeVisibleColumns.length}/{ATTENDANCE_COLUMNS.length})</span>
                      <ChevronDown size={12} style={{ transform: isColManagerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                    </button>

                    {/* Popover Drawer */}
                    {isColManagerOpen && (
                      <div className="col-manager-dropdown" style={{ width: '280px' }}>
                        <div className="col-manager-header">
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '0.825rem', color: 'var(--slate-900)' }}>
                              Column Visibility
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>
                              Toggle columns to show/hide
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={showAllColumns}
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem', gap: '0.25rem' }}
                            title="Show all columns"
                          >
                            <RotateCcw size={11} />
                            <span>Show All</span>
                          </button>
                        </div>

                        <div className="col-manager-search">
                          <div style={{ position: 'relative' }}>
                            <Search size={13} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
                            <input
                              type="text"
                              placeholder="Search columns..."
                              value={colSearchQuery}
                              onChange={(e) => setColSearchQuery(e.target.value)}
                              className="col-manager-search-input"
                            />
                          </div>
                        </div>

                        <div className="col-manager-list" style={{ maxHeight: '300px' }}>
                          {ATTENDANCE_COLUMNS.filter(c => 
                            !colSearchQuery || c.label.toLowerCase().includes(colSearchQuery.toLowerCase()) || c.description?.toLowerCase().includes(colSearchQuery.toLowerCase())
                          ).map(col => {
                            const isChecked = !!visibleColumns[col.id];
                            return (
                              <label
                                key={col.id}
                                className="col-item-row"
                                style={{ padding: '0.4rem 0.85rem' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleColumnVisibility(col.id)}
                                  />
                                  <span style={{ fontWeight: isChecked ? '600' : 'normal' }}>{col.label}</span>
                                </div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--slate-400)' }}>{col.description}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="table-responsive-wrapper" style={{ border: 'none', borderRadius: 0, maxHeight: '650px', overflowY: 'auto' }}>
                <table className={`data-table ${freezeColumnsCount > 0 ? 'has-frozen-columns' : ''}`}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                      {activeVisibleColumns.map(col => (
                        <th
                          key={col.id}
                          style={getStickyStyle(col.id, true, false, undefined, {
                            textAlign: col.align || 'left',
                            width: `${col.width}px`
                          })}
                          title={col.description}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, idx) => {
                      const isInlineEditing = inlineEditingDate === r.attendance_date_iso;
                      const isWO = r.status_code === 'WO';
                      const isWOP = r.status_code === 'WOP';
                      const isAbsent = r.status_code === 'A';
                      const isWopShortfall = r.is_wop_shortfall;
                      const isLate = r.is_late;
                      const isManual = !!r.is_manual;

                      let rowBg = '#ffffff';
                      if (isWO) rowBg = '#f0f9ff';
                      if (isWOP) rowBg = '#f0fdfa';
                      if (isAbsent || isWopShortfall || r.is_sandwich_absent) rowBg = '#fff1f2';
                      if (isManual) rowBg = '#fffdf7';
                      if (isInlineEditing) rowBg = '#fefce8';

                      return (
                        <tr 
                          key={r.attendance_date_iso || idx}
                          style={{ 
                            backgroundColor: rowBg,
                            borderLeft: isInlineEditing ? '4px solid #f59e0b' : (isManual ? '3px solid #f59e0b' : 'none')
                          }}
                        >
                          {visibleColumns.date && (
                            <td style={getStickyStyle('date', false, false, rowBg, { fontWeight: '600', color: 'var(--slate-900)' })}>
                              {isInlineEditing ? (
                                <input
                                  style={{ ...inlineInputStyle, width: '100px', fontWeight: '600' }}
                                  value={inlineFormData.attendance_date || inlineFormData.attendance_date_iso || ''}
                                  onChange={e => handleInlineChange('attendance_date', e.target.value)}
                                  placeholder="YYYY-MM-DD"
                                />
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span>{r.attendance_date || r.attendance_date_iso}</span>
                                  {isManual && (
                                    <span 
                                      style={{ 
                                        fontSize: '0.625rem', 
                                        fontWeight: '700', 
                                        color: '#b45309', 
                                        backgroundColor: '#fef3c7', 
                                        border: '1px solid #fde68a', 
                                        padding: '1px 4px', 
                                        borderRadius: '3px' 
                                      }}
                                      title="Manual record (Calculated as per rule)"
                                    >
                                      Manual
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                          {visibleColumns.manual && (
                            <td style={getStickyStyle('manual', false, false, rowBg, { textAlign: 'center' })}>
                              <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', margin: 0 }}>
                                <input 
                                  type="checkbox"
                                  checked={isInlineEditing || isManual}
                                  onChange={() => handleToggleManual(r)}
                                  title={isManual ? 'Manual record active (Click to revert to standard auto shift)' : 'Click to enable manual entry (All columns editable, rules calculated dynamically)'}
                                  style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#d97706' }}
                                />
                              </label>
                            </td>
                          )}
                          {visibleColumns.status && (
                            <td style={getStickyStyle('status', false, false, rowBg, { textAlign: 'center' })}>
                              {isInlineEditing ? (
                                <input
                                  style={{ ...inlineInputStyle, width: '56px', textAlign: 'center', fontWeight: '700' }}
                                  value={inlineFormData.status_code || ''}
                                  onChange={e => handleInlineChange('status_code', e.target.value.toUpperCase())}
                                  placeholder="P"
                                />
                              ) : r.is_sandwich_absent ? (
                                <span
                                  className="badge"
                                  style={{
                                    backgroundColor: '#fee2e2',
                                    color: '#991b1b',
                                    border: '1px solid #f87171',
                                    fontWeight: '700'
                                  }}
                                  title={r.sandwich_note || 'Sandwich Leave Rule: Absent on both sides of holiday. Treated as Absent (No Salary).'}
                                >
                                  Sandwich (A)
                                </span>
                              ) : isWopShortfall ? (
                                <span
                                  className="badge"
                                  style={{
                                    backgroundColor: '#fee2e2',
                                    color: '#b91c1c',
                                    border: '1px solid #fca5a5',
                                    fontWeight: '700'
                                  }}
                                  title={r.wop_shortfall_note || 'Compulsory WOP shortfall: Weekly Off treated as Absent'}
                                >
                                  WO (A)
                                </span>
                              ) : (
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
                              )}
                            </td>
                          )}
                          {visibleColumns.calc_mode && (
                            <td style={getStickyStyle('calc_mode', false, false, rowBg)}>
                              {isInlineEditing ? (
                                <input
                                  style={{ ...inlineInputStyle, width: '100px' }}
                                  value={inlineFormData.calc_mode || ''}
                                  onChange={e => handleInlineChange('calc_mode', e.target.value)}
                                  placeholder="Normal"
                                />
                              ) : (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                  <span 
                                    className={`badge ${
                                      r.calc_mode === 'Normal' ? 'badge-success' :
                                      r.calc_mode === 'Both late' ? 'badge-danger' :
                                      r.calc_mode === 'Late IN only' ? 'badge-warning' :
                                      r.calc_mode === 'Late OUT only' ? 'badge-info' :
                                      'badge-secondary'
                                    }`}
                                    style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem' }}
                                    title={r.calc_mode}
                                  >
                                    {r.calc_mode || 'Normal'}
                                  </span>
                                  {Boolean(r.is_night_shift) && (
                                    <span 
                                      className="badge"
                                      style={{ 
                                        fontSize: '0.68rem', 
                                        padding: '0.18rem 0.42rem',
                                        backgroundColor: '#312e81',
                                        color: '#c7d2fe',
                                        border: '1px solid #4338ca',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '2px',
                                        fontWeight: '600'
                                      }}
                                      title="Night Duty (Overnight Shift)"
                                    >
                                      🌙 Night
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                          {visibleColumns.sched_in && (
                            <td style={getStickyStyle('sched_in', false, false, rowBg, { color: 'var(--slate-600)' })}>
                              {isInlineEditing ? (
                                <input
                                  style={inlineInputStyle}
                                  value={inlineFormData.scheduled_in_time || ''}
                                  onChange={e => handleInlineChange('scheduled_in_time', e.target.value)}
                                  placeholder="08:00"
                                />
                              ) : (
                                r.scheduled_in_time
                              )}
                            </td>
                          )}
                          {visibleColumns.sched_out && (
                            <td style={getStickyStyle('sched_out', false, false, rowBg, { color: 'var(--slate-600)' })}>
                              {isInlineEditing ? (
                                <input
                                  style={inlineInputStyle}
                                  value={inlineFormData.scheduled_out_time || ''}
                                  onChange={e => handleInlineChange('scheduled_out_time', e.target.value)}
                                  placeholder="20:00"
                                />
                              ) : (
                                r.scheduled_out_time
                              )}
                            </td>
                          )}
                          {visibleColumns.target && (
                            <td style={getStickyStyle('target', false, false, rowBg, { color: 'var(--slate-600)' })}>
                              {isInlineEditing ? (
                                <input
                                  style={inlineInputStyle}
                                  value={inlineFormData.scheduled_duration_formatted || ''}
                                  onChange={e => handleInlineChange('scheduled_duration_formatted', e.target.value)}
                                  placeholder="12:00"
                                />
                              ) : (
                                r.scheduled_duration_formatted || '12:00'
                              )}
                            </td>
                          )}
                          {visibleColumns.std_break && (
                            <td style={getStickyStyle('std_break', false, false, rowBg, { color: 'var(--slate-600)' })}>
                              {isInlineEditing ? (
                                <input
                                  style={inlineInputStyle}
                                  value={inlineFormData.scheduled_break_formatted || ''}
                                  onChange={e => handleInlineChange('scheduled_break_formatted', e.target.value)}
                                  placeholder="00:00"
                                />
                              ) : (
                                r.scheduled_break_formatted || '00:00'
                              )}
                            </td>
                          )}
                          {visibleColumns.sched_work && (
                            <td style={getStickyStyle('sched_work', false, false, rowBg, { fontWeight: '600', color: 'var(--slate-700)' })}>
                              {isInlineEditing ? (
                                <input
                                  style={inlineInputStyle}
                                  value={inlineFormData.scheduled_work_formatted || ''}
                                  onChange={e => handleInlineChange('scheduled_work_formatted', e.target.value)}
                                  placeholder="12:00"
                                />
                              ) : (
                                r.scheduled_work_formatted
                              )}
                            </td>
                          )}
                          {visibleColumns.actual_in && (
                            <td style={getStickyStyle('actual_in', false, false, rowBg, { fontWeight: isLate ? '700' : 'normal', color: isLate ? 'var(--warning-text)' : 'var(--slate-900)', background: isLate ? 'var(--warning-bg)' : 'transparent' })}>
                              {isInlineEditing ? (
                                <input
                                  style={inlineInputStyle}
                                  value={inlineFormData.in_time || ''}
                                  onChange={e => handleInlineChange('in_time', e.target.value)}
                                  placeholder="08:00"
                                />
                              ) : (
                                r.actual_in_time || '—'
                              )}
                            </td>
                          )}
                          {visibleColumns.actual_out && (
                            <td style={getStickyStyle('actual_out', false, false, rowBg, { color: 'var(--slate-900)' })}>
                              {isInlineEditing ? (
                                <input
                                  style={inlineInputStyle}
                                  value={inlineFormData.out_time || ''}
                                  onChange={e => handleInlineChange('out_time', e.target.value)}
                                  placeholder="20:00"
                                />
                              ) : (
                                r.actual_out_time || '—'
                              )}
                            </td>
                          )}
                          {visibleColumns.actual_duration && (
                            <td style={getStickyStyle('actual_duration', false, false, rowBg, { color: 'var(--slate-700)', fontWeight: '600' })}>
                              {isInlineEditing ? (
                                <input
                                  style={inlineInputStyle}
                                  value={inlineFormData.actual_duration_formatted || ''}
                                  onChange={e => handleInlineChange('actual_duration_formatted', e.target.value)}
                                  placeholder="12:00"
                                />
                              ) : (
                                r.actual_duration_formatted
                              )}
                            </td>
                          )}
                          {visibleColumns.break_out && (
                            <td style={getStickyStyle('break_out', false, false, rowBg, { color: 'var(--slate-700)' })}>
                              {isInlineEditing ? (
                                <input
                                  style={inlineInputStyle}
                                  value={inlineFormData.break_out || ''}
                                  onChange={e => handleInlineChange('break_out', e.target.value)}
                                  placeholder="13:00"
                                />
                              ) : (
                                r.break_out || '—'
                              )}
                            </td>
                          )}
                          {visibleColumns.break_in && (
                            <td style={getStickyStyle('break_in', false, false, rowBg, { color: 'var(--slate-700)' })}>
                              {isInlineEditing ? (
                                <input
                                  style={inlineInputStyle}
                                  value={inlineFormData.break_in || ''}
                                  onChange={e => handleInlineChange('break_in', e.target.value)}
                                  placeholder="13:30"
                                />
                              ) : (
                                r.break_in || '—'
                              )}
                            </td>
                          )}
                          {visibleColumns.effective_break && (
                            <td style={getStickyStyle('effective_break', false, false, rowBg, { color: r.effective_break_minutes > 0 ? 'var(--primary-700)' : 'var(--slate-400)', fontWeight: r.effective_break_minutes > 0 ? '600' : 'normal' })}>
                              {isInlineEditing ? (
                                <input
                                  style={inlineInputStyle}
                                  value={inlineFormData.effective_break_formatted || ''}
                                  onChange={e => handleInlineChange('effective_break_formatted', e.target.value)}
                                  placeholder="00:00"
                                />
                              ) : (
                                r.effective_break_minutes > 0 ? r.effective_break_formatted : '—'
                              )}
                            </td>
                          )}
                          {visibleColumns.actual_work && (
                            <td style={getStickyStyle('actual_work', false, false, rowBg, { fontWeight: '700', color: 'var(--slate-900)' })}>
                              {isInlineEditing ? (
                                <input
                                  style={{ ...inlineInputStyle, fontWeight: '700' }}
                                  value={inlineFormData.actual_work_formatted || ''}
                                  onChange={e => handleInlineChange('actual_work_formatted', e.target.value)}
                                  placeholder="12:00"
                                />
                              ) : (
                                r.actual_work_formatted
                              )}
                            </td>
                          )}
                          {visibleColumns.work_diff && (
                            <td style={getStickyStyle('work_diff', false, false, rowBg, { textAlign: 'center' })}>
                              {isInlineEditing ? (
                                <input
                                  style={{ ...inlineInputStyle, textAlign: 'center' }}
                                  value={inlineFormData.work_diff_formatted || ''}
                                  onChange={e => handleInlineChange('work_diff_formatted', e.target.value)}
                                  placeholder="+00:00"
                                />
                              ) : (
                                <span style={{ fontWeight: '700', color: r.work_diff_minutes > 0 ? 'var(--success-text)' : (r.work_diff_minutes < 0 ? 'var(--danger-text)' : 'var(--slate-500)') }}>
                                  {r.work_diff_formatted}
                                </span>
                              )}
                            </td>
                          )}
                          {visibleColumns.late_by && (
                            <td style={getStickyStyle('late_by', false, false, rowBg, { color: isLate ? 'var(--warning-text)' : 'var(--slate-400)', fontWeight: isLate ? '700' : 'normal' })}>
                              {isInlineEditing ? (
                                <input
                                  style={inlineInputStyle}
                                  value={inlineFormData.late_formatted || ''}
                                  onChange={e => handleInlineChange('late_formatted', e.target.value)}
                                  placeholder="00:00"
                                />
                              ) : (
                                isLate ? r.late_formatted : '—'
                              )}
                            </td>
                          )}
                          {visibleColumns.overtime && (
                            <td style={getStickyStyle('overtime', false, false, rowBg, { color: r.overtime_minutes > 0 ? 'var(--success-text)' : 'var(--slate-400)', fontWeight: r.overtime_minutes > 0 ? '700' : 'normal' })}>
                              {isInlineEditing ? (
                                <input
                                  style={inlineInputStyle}
                                  value={inlineFormData.overtime_formatted || ''}
                                  onChange={e => handleInlineChange('overtime_formatted', e.target.value)}
                                  placeholder="00:00"
                                />
                              ) : (
                                r.overtime_minutes > 0 ? r.overtime_formatted : '—'
                              )}
                            </td>
                          )}
                          {visibleColumns.rate && (
                            <td style={getStickyStyle('rate', false, false, rowBg, { textAlign: 'right', color: 'var(--slate-500)' })}>
                              {isInlineEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  style={inlineInputStyle}
                                  value={inlineFormData.hourly_rate ?? ''}
                                  onChange={e => handleInlineChange('hourly_rate', e.target.value)}
                                  placeholder="83.33"
                                />
                              ) : (
                                `₹${r.hourly_rate}`
                              )}
                            </td>
                          )}
                          {visibleColumns.daily_salary && (
                            <td style={getStickyStyle('daily_salary', false, false, rowBg, { textAlign: 'right', fontWeight: '600' })}>
                              {isInlineEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  style={{ ...inlineInputStyle, fontWeight: '700' }}
                                  value={inlineFormData.daily_salary_earned ?? ''}
                                  onChange={e => handleInlineChange('daily_salary_earned', e.target.value)}
                                  placeholder="1000.00"
                                />
                              ) : (
                                `₹${r.daily_salary_earned}`
                              )}
                            </td>
                          )}
                          {visibleColumns.late_ded && (
                            <td style={getStickyStyle('late_ded', false, false, rowBg, { textAlign: 'right', color: r.late_salary_deduction > 0 ? 'var(--danger-text)' : 'var(--slate-400)' })}>
                              {isInlineEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  style={{ ...inlineInputStyle, color: 'var(--danger-text)' }}
                                  value={inlineFormData.late_salary_deduction ?? ''}
                                  onChange={e => handleInlineChange('late_salary_deduction', e.target.value)}
                                  placeholder="0.00"
                                />
                              ) : (
                                r.late_salary_deduction > 0 ? `-₹${r.late_salary_deduction}` : '—'
                              )}
                            </td>
                          )}
                          {visibleColumns.ot_pay && (
                            <td style={getStickyStyle('ot_pay', false, false, rowBg, { textAlign: 'right', color: r.overtime_pay > 0 ? 'var(--success-text)' : 'var(--slate-400)' })}>
                              {isInlineEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  style={{ ...inlineInputStyle, color: 'var(--success-text)' }}
                                  value={inlineFormData.overtime_pay ?? ''}
                                  onChange={e => handleInlineChange('overtime_pay', e.target.value)}
                                  placeholder="0.00"
                                />
                              ) : (
                                r.overtime_pay > 0 ? `+₹${r.overtime_pay}` : '—'
                              )}
                            </td>
                          )}
                          {visibleColumns.leave_ded && (
                            <td style={getStickyStyle('leave_ded', false, false, rowBg, { textAlign: 'right', color: r.leave_deduction > 0 ? 'var(--danger-text)' : 'var(--slate-400)' })}>
                              {isInlineEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  style={{ ...inlineInputStyle, color: 'var(--danger-text)' }}
                                  value={inlineFormData.leave_deduction ?? ''}
                                  onChange={e => handleInlineChange('leave_deduction', e.target.value)}
                                  placeholder="0.00"
                                />
                              ) : (
                                r.leave_deduction > 0 ? `-₹${r.leave_deduction}` : '—'
                              )}
                            </td>
                          )}
                          {visibleColumns.penalty && (
                            <td style={getStickyStyle('penalty', false, false, rowBg, { textAlign: 'right', color: r.penalty_amount > 0 ? 'var(--danger-text)' : 'var(--slate-400)' })}>
                              {isInlineEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  style={{ ...inlineInputStyle, color: 'var(--danger-text)' }}
                                  value={inlineFormData.penalty_amount ?? ''}
                                  onChange={e => handleInlineChange('penalty_amount', e.target.value)}
                                  placeholder="0.00"
                                />
                              ) : (
                                r.penalty_amount > 0 ? `-₹${r.penalty_amount}` : '—'
                              )}
                            </td>
                          )}
                          {visibleColumns.net_salary && (
                            <td style={getStickyStyle('net_salary', false, false, rowBg, { textAlign: 'right', fontWeight: '700', color: 'var(--primary-700)', background: 'var(--primary-50)' })}>
                              {isInlineEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  style={{ ...inlineInputStyle, fontWeight: '800', color: 'var(--primary-700)', backgroundColor: '#ecfdf5', border: '1.5px solid #10b981' }}
                                  value={inlineFormData.net_daily_salary ?? ''}
                                  onChange={e => handleInlineChange('net_daily_salary', e.target.value)}
                                  placeholder="1000.00"
                                />
                              ) : (
                                `₹${r.net_daily_salary}`
                              )}
                            </td>
                          )}
                          {visibleColumns.punch_records && (
                            <td style={getStickyStyle('punch_records', false, false, rowBg)}>
                              {isInlineEditing ? (
                                <input
                                  style={{ ...inlineInputStyle, width: '120px' }}
                                  value={inlineFormData.punch_records || ''}
                                  onChange={e => handleInlineChange('punch_records', e.target.value)}
                                  placeholder="08:00, 20:00"
                                />
                              ) : (
                                <span style={{ fontSize: '0.725rem', color: 'var(--slate-600)' }} title={r.punch_records}>
                                  {r.punch_records || '—'}
                                </span>
                              )}
                            </td>
                          )}
                          {visibleColumns.remarks && (
                            <td style={getStickyStyle('remarks', false, false, rowBg)}>
                              {isInlineEditing ? (
                                <input
                                  style={{ ...inlineInputStyle, width: '120px' }}
                                  value={inlineFormData.remarks || ''}
                                  onChange={e => handleInlineChange('remarks', e.target.value)}
                                  placeholder="Remarks"
                                />
                              ) : (
                                <span style={{ fontSize: '0.725rem', color: 'var(--slate-600)' }} title={r.remarks}>
                                  {r.remarks || '—'}
                                </span>
                              )}
                            </td>
                          )}
                          {visibleColumns.action && (
                            <td style={getStickyStyle('action', false, false, rowBg, { textAlign: 'center' })}>
                              {isInlineEditing ? (
                                <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveInline(r.attendance_date_iso)}
                                    className="btn btn-sm btn-success"
                                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                                    title="Save manual record (Rule calculated)"
                                    disabled={inlineSaving}
                                  >
                                    <Check size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedRecordForEdit({ ...r, ...inlineFormData, is_manual: 1 });
                                      setIsDayEditModalOpen(true);
                                    }}
                                    className="btn btn-sm btn-outline-primary"
                                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                                    title="Open full edit modal"
                                  >
                                    <Edit3 size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setInlineEditingDate(null)}
                                    className="btn btn-sm btn-secondary"
                                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                                    title="Cancel inline edit"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
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
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot style={{ position: 'sticky', bottom: 0, background: 'var(--slate-100)', borderTop: '2px solid var(--slate-300)', fontWeight: '700', zIndex: 10 }}>
                    <tr>
                      {visibleColumns.date && (
                        <td style={getStickyStyle('date', false, true, undefined, { fontWeight: '700' })}>TOTAL</td>
                      )}
                      {visibleColumns.manual && (
                        <td style={getStickyStyle('manual', false, true, undefined, { textAlign: 'center' })}>—</td>
                      )}
                      {visibleColumns.status && (
                        <td style={getStickyStyle('status', false, true, undefined, { textAlign: 'center', fontWeight: '700' })}>{summary?.presentDays}P/{summary?.absentDays}A</td>
                      )}
                      {visibleColumns.calc_mode && <td style={getStickyStyle('calc_mode', false, true)}>—</td>}
                      {visibleColumns.sched_in && <td style={getStickyStyle('sched_in', false, true)}>—</td>}
                      {visibleColumns.sched_out && <td style={getStickyStyle('sched_out', false, true)}>—</td>}
                      {visibleColumns.target && <td style={getStickyStyle('target', false, true)}>—</td>}
                      {visibleColumns.std_break && <td style={getStickyStyle('std_break', false, true)}>—</td>}
                      {visibleColumns.sched_work && (
                        <td style={getStickyStyle('sched_work', false, true)}>{summary?.totalExpectedWorkFormatted || '00:00'}</td>
                      )}
                      {visibleColumns.actual_in && <td>—</td>}
                      {visibleColumns.actual_out && <td>—</td>}
                      {visibleColumns.actual_duration && <td>—</td>}
                      {visibleColumns.break_out && <td>—</td>}
                      {visibleColumns.break_in && <td>—</td>}
                      {visibleColumns.effective_break && (
                        <td style={{ color: 'var(--primary-700)' }}>{summary?.totalActualBreakFormatted || '00:00'}</td>
                      )}
                      {visibleColumns.actual_work && (
                        <td style={{ color: 'var(--primary-700)' }}>{summary?.totalActualWorkFormatted || '00:00'}</td>
                      )}
                      {visibleColumns.work_diff && (
                        <td style={{ textAlign: 'center', color: Number(summary?.totalWorkDiffHours) >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                          {summary?.totalWorkDiffFormatted}
                        </td>
                      )}
                      {visibleColumns.late_by && (
                        <td style={{ color: 'var(--warning-text)' }}>{summary?.totalLateFormatted}</td>
                      )}
                      {visibleColumns.overtime && (
                        <td style={{ color: 'var(--success-text)' }}>{summary?.totalOvertimeFormatted}</td>
                      )}
                      {visibleColumns.rate && <td style={{ textAlign: 'right' }}>—</td>}
                      {visibleColumns.daily_salary && (
                        <td style={{ textAlign: 'right' }}>₹{summary?.grossEarnedSalary}</td>
                      )}
                      {visibleColumns.late_ded && (
                        <td style={{ textAlign: 'right', color: 'var(--danger-text)' }}>-₹{summary?.totalLateDeductions}</td>
                      )}
                      {visibleColumns.ot_pay && (
                        <td style={{ textAlign: 'right', color: 'var(--success-text)' }}>+₹{summary?.totalOvertimePay}</td>
                      )}
                      {visibleColumns.leave_ded && (
                        <td style={{ textAlign: 'right', color: 'var(--danger-text)' }}>
                          {summary?.totalLeaveDeductions > 0 ? `-₹${summary.totalLeaveDeductions}` : '—'}
                        </td>
                      )}
                      {visibleColumns.penalty && (
                        <td style={{ textAlign: 'right', color: 'var(--danger-text)' }}>
                          {summary?.totalPenalties > 0 ? `-₹${summary.totalPenalties}` : '—'}
                        </td>
                      )}
                      {visibleColumns.net_salary && (
                        <td style={{ textAlign: 'right', color: 'var(--primary-700)', fontSize: '0.95rem', background: 'var(--primary-100)' }}>₹{summary?.netPayableSalary}</td>
                      )}
                      {visibleColumns.punch_records && <td>—</td>}
                      {visibleColumns.remarks && <td>—</td>}
                      {visibleColumns.action && <td style={{ textAlign: 'center' }}>—</td>}
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

      {/* PDF Export & Preview Modal */}
      {isPdfModalOpen && sheetData && (
        <EmployeeAttendancePdfModal
          isOpen={isPdfModalOpen}
          sheetData={sheetData}
          onClose={() => setIsPdfModalOpen(false)}
        />
      )}
    </div>
  );
};
