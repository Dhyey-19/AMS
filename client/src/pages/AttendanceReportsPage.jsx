import React, { useState, useEffect, useCallback } from 'react';
import { attendanceApi, employeeApi } from '../services/api';
import { AttendanceStatusBadge, DepartmentBadge } from '../components/common/Badge';
import { StatCard } from '../components/common/StatCard';
import { 
  Calendar, 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  Download, 
  Filter, 
  Building2, 
  FileSpreadsheet,
  TrendingUp,
  Percent,
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const AttendanceReportsPage = () => {
  const [activeReportTab, setActiveReportTab] = useState('monthly'); // 'monthly', 'daily', 'employee', 'range'
  const [months, setMonths] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);

  // Monthly Report Filters & State
  const [selectedMonth, setSelectedMonth] = useState('');
  const [monthlyDepartment, setMonthlyDepartment] = useState('All');
  const [monthlyReportData, setMonthlyReportData] = useState(null);
  const [monthlySearch, setMonthlySearch] = useState('');

  // Daily Report Filters & State
  const [dailyDate, setDailyDate] = useState('');
  const [dailyDepartment, setDailyDepartment] = useState('All');
  const [dailyReportData, setDailyReportData] = useState(null);
  const [dailySearch, setDailySearch] = useState('');

  // Employee-wise Report Filters & State
  const [selectedEmployeeCode, setSelectedEmployeeCode] = useState('');
  const [empStartDate, setEmpStartDate] = useState('');
  const [empEndDate, setEmpEndDate] = useState('');
  const [employeeReportData, setEmployeeReportData] = useState(null);

  // Range Report Filters & State
  const [rangeStartDate, setRangeStartDate] = useState('');
  const [rangeEndDate, setRangeEndDate] = useState('');
  const [rangeDepartment, setRangeDepartment] = useState('All');
  const [rangeReportData, setRangeReportData] = useState(null);

  const [loading, setLoading] = useState(false);

  // Fetch initial lookups (months, departments, employees)
  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [monthsRes, deptsRes, empsRes] = await Promise.all([
          attendanceApi.getMonths(),
          employeeApi.getDepartments(),
          employeeApi.getAll({ limit: 200, sortBy: 'employee_code', sortOrder: 'asc' })
        ]);
        
        const availMonths = monthsRes.data || [];
        setMonths(availMonths);
        if (availMonths.length > 0) {
          setSelectedMonth(availMonths[0]);
        }

        setDepartments(deptsRes.data || []);
        
        const emps = empsRes.data || [];
        setEmployeesList(emps);
        if (emps.length > 0) {
          setSelectedEmployeeCode(emps[0].employee_code);
        }
      } catch (err) {
        console.error('Failed to load report lookups:', err);
      }
    };
    fetchLookups();
  }, []);

  // Fetch Monthly Report
  const fetchMonthlyReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await attendanceApi.getMonthlyReport({
        month: selectedMonth,
        department: monthlyDepartment
      });
      setMonthlyReportData(res.data);
    } catch (err) {
      console.error('Failed to load monthly report:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, monthlyDepartment]);

  // Fetch Daily Report
  const fetchDailyReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await attendanceApi.getDailyReport({
        date: dailyDate,
        department: dailyDepartment
      });
      setDailyReportData(res.data);
      if (!dailyDate && res.data?.date) {
        setDailyDate(res.data.date);
      }
    } catch (err) {
      console.error('Failed to load daily report:', err);
    } finally {
      setLoading(false);
    }
  }, [dailyDate, dailyDepartment]);

  // Fetch Employee Report
  const fetchEmployeeReport = useCallback(async () => {
    if (!selectedEmployeeCode) return;
    try {
      setLoading(true);
      const res = await attendanceApi.getEmployeeReport(selectedEmployeeCode, {
        startDate: empStartDate,
        endDate: empEndDate
      });
      setEmployeeReportData(res.data);
    } catch (err) {
      console.error('Failed to load employee report:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedEmployeeCode, empStartDate, empEndDate]);

  // Fetch Range Report
  const fetchRangeReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await attendanceApi.getRangeReport({
        startDate: rangeStartDate,
        endDate: rangeEndDate,
        department: rangeDepartment
      });
      setRangeReportData(res.data);
    } catch (err) {
      console.error('Failed to load range report:', err);
    } finally {
      setLoading(false);
    }
  }, [rangeStartDate, rangeEndDate, rangeDepartment]);

  useEffect(() => {
    if (activeReportTab === 'monthly') {
      fetchMonthlyReport();
    } else if (activeReportTab === 'daily') {
      fetchDailyReport();
    } else if (activeReportTab === 'employee') {
      fetchEmployeeReport();
    } else if (activeReportTab === 'range') {
      fetchRangeReport();
    }
  }, [activeReportTab, fetchMonthlyReport, fetchDailyReport, fetchEmployeeReport, fetchRangeReport]);

  // Export helper (CSV download)
  const downloadCSV = (filename, headers, rows) => {
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Monthly Report
  const exportMonthlyCSV = () => {
    if (!monthlyReportData?.employees) return;
    const headers = ['EmployeeCode', 'EmployeeName', 'Department', 'Designation', 'TotalDays', 'PresentDays', 'AbsentDays', 'WeeklyOffs', 'LateDays', 'TotalHours', 'AttendancePercentage'];
    const rows = monthlyReportData.employees.map(e => [
      `"${e.employee_code}"`, `"${e.employee_name}"`, `"${e.department}"`, `"${e.designation}"`,
      e.totalDays, e.presentDays, e.absentDays, e.weeklyOffDays, e.lateDays, `"${e.totalHours}"`, `"${e.attendancePercentage}%"`
    ]);
    downloadCSV(`monthly_attendance_${selectedMonth || 'summary'}`, headers, rows);
  };

  // Export Daily Report
  const exportDailyCSV = () => {
    if (!dailyReportData?.records) return;
    const headers = ['Date', 'EmployeeCode', 'EmployeeName', 'Department', 'InTime', 'OutTime', 'Duration', 'LateBy', 'Status'];
    const rows = dailyReportData.records.map(r => [
      `"${r.attendance_date_iso}"`, `"${r.employee_code}"`, `"${r.employee_name}"`, `"${r.department}"`,
      `"${r.in_time || ''}"`, `"${r.out_time || ''}"`, `"${r.total_duration || ''}"`, `"${r.late_by || ''}"`, `"${r.status_code}"`
    ]);
    downloadCSV(`daily_attendance_${dailyDate || 'report'}`, headers, rows);
  };

  // Export Employee Report
  const exportEmployeeCSV = () => {
    if (!employeeReportData?.records) return;
    const headers = ['Date', 'EmployeeCode', 'EmployeeName', 'InTime', 'OutTime', 'Duration', 'LateBy', 'Status', 'PunchRecords'];
    const rows = employeeReportData.records.map(r => [
      `"${r.attendance_date_iso}"`, `"${r.employee_code}"`, `"${r.employee_name}"`,
      `"${r.in_time || ''}"`, `"${r.out_time || ''}"`, `"${r.total_duration || ''}"`, `"${r.late_by || ''}"`, `"${r.status_code}"`, `"${(r.punch_records || '').replace(/"/g, '""')}"`
    ]);
    downloadCSV(`employee_${selectedEmployeeCode}_attendance`, headers, rows);
  };

  // Filtered monthly employees
  const filteredMonthlyEmployees = (monthlyReportData?.employees || []).filter(emp => {
    if (!monthlySearch) return true;
    const term = monthlySearch.toLowerCase();
    return (
      emp.employee_name?.toLowerCase().includes(term) ||
      emp.employee_code?.toString().includes(term) ||
      emp.department?.toLowerCase().includes(term) ||
      emp.designation?.toLowerCase().includes(term)
    );
  });

  // Filtered daily records
  const filteredDailyRecords = (dailyReportData?.records || []).filter(r => {
    if (!dailySearch) return true;
    const term = dailySearch.toLowerCase();
    return (
      r.employee_name?.toLowerCase().includes(term) ||
      r.employee_code?.toString().includes(term) ||
      r.department?.toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Report Navigation Sub-Tabs */}
      <div 
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '0.75rem',
          overflowX: 'auto'
        }}
      >
        <button
          className={`btn ${activeReportTab === 'monthly' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveReportTab('monthly')}
        >
          <Calendar size={16} />
          Monthly Summary
        </button>
        <button
          className={`btn ${activeReportTab === 'daily' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveReportTab('daily')}
        >
          <Clock size={16} />
          Daily Roll-Call
        </button>
        <button
          className={`btn ${activeReportTab === 'employee' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveReportTab('employee')}
        >
          <Users size={16} />
          Employee-Wise History
        </button>
        <button
          className={`btn ${activeReportTab === 'range' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveReportTab('range')}
        >
          <TrendingUp size={16} />
          Date-Range Analytics
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MONTHLY ATTENDANCE SUMMARY */}
      {/* ========================================================================= */}
      {activeReportTab === 'monthly' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
          {/* Controls Bar */}
          <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#475569' }}>Month:</span>
                  <select
                    className="form-select"
                    style={{ width: 'auto', minWidth: '150px' }}
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                  >
                    {months.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    {months.length === 0 && <option value="">No months available</option>}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#475569' }}>Department:</span>
                  <select
                    className="form-select"
                    style={{ width: 'auto', minWidth: '160px' }}
                    value={monthlyDepartment}
                    onChange={(e) => setMonthlyDepartment(e.target.value)}
                  >
                    <option value="All">All Departments</option>
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-secondary btn-sm" onClick={exportMonthlyCSV}>
                  <Download size={15} />
                  Export CSV / Excel
                </button>
              </div>
            </div>
          </div>

          {/* Monthly KPI Overview */}
          {monthlyReportData?.overview && (
            <div className="kpi-grid">
              <StatCard
                icon={Calendar}
                color="blue"
                label="Total Recorded Shifts"
                value={monthlyReportData.overview.totalLogs}
                subtext={`Across ${monthlyReportData.overview.uniqueEmployees} staff members`}
              />
              <StatCard
                icon={UserCheck}
                color="green"
                label="Present Shifts"
                value={monthlyReportData.overview.totalPresent}
                subtext={`Total attendance recorded`}
              />
              <StatCard
                icon={UserX}
                color="rose"
                label="Absent Shifts"
                value={monthlyReportData.overview.totalAbsent}
                subtext={`Total absences`}
              />
              <StatCard
                icon={Clock}
                color="purple"
                label="Total Working Hours"
                value={`${monthlyReportData.overview.totalHours} hrs`}
                subtext={`Late shifts: ${monthlyReportData.overview.totalLate}`}
              />
            </div>
          )}

          {/* Monthly Roster Table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <Users size={18} color="#0284c7" />
                <h3 style={{ fontSize: '1.0625rem' }}>
                  Employee Monthly Attendance & Performance Matrix ({selectedMonth})
                </h3>
              </div>

              <div className="table-search-box" style={{ maxWidth: '260px' }}>
                <Search className="search-input-icon" size={16} />
                <input
                  type="text"
                  className="table-search-input"
                  placeholder="Filter staff..."
                  value={monthlySearch}
                  onChange={(e) => setMonthlySearch(e.target.value)}
                  style={{ padding: '0.4rem 0.75rem 0.4rem 2.2rem', fontSize: '0.8125rem' }}
                />
              </div>
            </div>

            <div className="table-responsive-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Employee Name</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th style={{ textAlign: 'center' }}>Total Days</th>
                    <th style={{ textAlign: 'center', color: '#059669' }}>Present</th>
                    <th style={{ textAlign: 'center', color: '#e11d48' }}>Absent</th>
                    <th style={{ textAlign: 'center', color: '#64748b' }}>Weekly Off</th>
                    <th style={{ textAlign: 'center', color: '#d97706' }}>Late Days</th>
                    <th style={{ textAlign: 'right' }}>Total Hours</th>
                    <th style={{ textAlign: 'right' }}>Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="11" style={{ textAlign: 'center', padding: '3rem' }}>
                        <div style={{ color: '#0284c7', fontWeight: '600' }} className="animate-pulse">
                          Generating monthly report...
                        </div>
                      </td>
                    </tr>
                  ) : filteredMonthlyEmployees.length === 0 ? (
                    <tr>
                      <td colSpan="11" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                        No records found for {selectedMonth}.
                      </td>
                    </tr>
                  ) : (
                    filteredMonthlyEmployees.map((emp) => {
                      const pct = emp.attendancePercentage;
                      const badgeColor = pct >= 80 ? '#ecfdf5' : pct >= 60 ? '#fef3c7' : '#fff1f2';
                      const textColor = pct >= 80 ? '#065f46' : pct >= 60 ? '#92400e' : '#9f1239';
                      const borderColor = pct >= 80 ? '#a7f3d0' : pct >= 60 ? '#fde68a' : '#fecdd3';

                      return (
                        <tr key={emp.employee_code}>
                          <td><span className="emp-code-pill">{emp.employee_code}</span></td>
                          <td><div style={{ fontWeight: '600', color: '#0f172a' }}>{emp.employee_name}</div></td>
                          <td><DepartmentBadge department={emp.department} /></td>
                          <td><span style={{ fontSize: '0.8125rem', color: '#475569' }}>{emp.designation || '-'}</span></td>
                          <td style={{ textAlign: 'center', fontWeight: '600' }}>{emp.totalDays}</td>
                          <td style={{ textAlign: 'center', fontWeight: '700', color: '#059669' }}>{emp.presentDays}</td>
                          <td style={{ textAlign: 'center', fontWeight: '700', color: '#e11d48' }}>{emp.absentDays}</td>
                          <td style={{ textAlign: 'center', color: '#64748b' }}>{emp.weeklyOffDays}</td>
                          <td style={{ textAlign: 'center', color: emp.lateDays > 0 ? '#d97706' : '#94a3b8', fontWeight: emp.lateDays > 0 ? '700' : 'normal' }}>
                            {emp.lateDays}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>{emp.totalHours}h</td>
                          <td style={{ textAlign: 'right' }}>
                            <span 
                              className="badge" 
                              style={{ 
                                backgroundColor: badgeColor, 
                                color: textColor, 
                                border: `1px solid ${borderColor}`,
                                padding: '3px 8px',
                                fontSize: '0.8125rem'
                              }}
                            >
                              {pct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DAILY ATTENDANCE ROLL-CALL */}
      {/* ========================================================================= */}
      {activeReportTab === 'daily' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
          {/* Daily Controls */}
          <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#475569' }}>Date:</span>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: 'auto' }}
                    value={dailyDate}
                    onChange={(e) => setDailyDate(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#475569' }}>Department:</span>
                  <select
                    className="form-select"
                    style={{ width: 'auto', minWidth: '160px' }}
                    value={dailyDepartment}
                    onChange={(e) => setDailyDepartment(e.target.value)}
                  >
                    <option value="All">All Departments</option>
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button className="btn btn-secondary btn-sm" onClick={exportDailyCSV}>
                <Download size={15} />
                Export Daily CSV
              </button>
            </div>
          </div>

          {/* Daily KPI Summary */}
          {dailyReportData?.summary && (
            <div className="kpi-grid">
              <StatCard
                icon={Users}
                color="blue"
                label="Staff Scheduled"
                value={dailyReportData.summary.totalShifts}
                subtext={`Attendance Rate: ${dailyReportData.summary.attendanceRate}%`}
              />
              <StatCard
                icon={UserCheck}
                color="green"
                label="Present on Duty"
                value={dailyReportData.summary.presentCount}
                subtext={`Working hours: ${dailyReportData.summary.totalWorkingHours}h`}
              />
              <StatCard
                icon={UserX}
                color="rose"
                label="Absent Staff"
                value={dailyReportData.summary.absentCount}
                subtext={`Weekly Off: ${dailyReportData.summary.weeklyOffCount}`}
              />
              <StatCard
                icon={Clock}
                color="purple"
                label="Late Arrivals"
                value={dailyReportData.summary.lateCount}
                subtext={`Total Late Time: ${dailyReportData.summary.totalLateHours}h`}
              />
            </div>
          )}

          {/* Daily Records Table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <Clock size={18} color="#0284c7" />
                <h3 style={{ fontSize: '1.0625rem' }}>
                  Daily Attendance Log & Timings for {dailyDate || 'Selected Date'}
                </h3>
              </div>

              <div className="table-search-box" style={{ maxWidth: '260px' }}>
                <Search className="search-input-icon" size={16} />
                <input
                  type="text"
                  className="table-search-input"
                  placeholder="Search staff..."
                  value={dailySearch}
                  onChange={(e) => setDailySearch(e.target.value)}
                  style={{ padding: '0.4rem 0.75rem 0.4rem 2.2rem', fontSize: '0.8125rem' }}
                />
              </div>
            </div>

            <div className="table-responsive-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Employee Name</th>
                    <th>Department</th>
                    <th>Shift</th>
                    <th>In Time</th>
                    <th>Out Time</th>
                    <th>Total Hours</th>
                    <th>Late By</th>
                    <th>Early Departure</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: '3rem' }}>
                        <div style={{ color: '#0284c7', fontWeight: '600' }} className="animate-pulse">
                          Loading daily records...
                        </div>
                      </td>
                    </tr>
                  ) : filteredDailyRecords.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                        No records found for date {dailyDate}.
                      </td>
                    </tr>
                  ) : (
                    filteredDailyRecords.map((r) => (
                      <tr key={r.employee_code}>
                        <td><span className="emp-code-pill">{r.employee_code}</span></td>
                        <td><div style={{ fontWeight: '600', color: '#0f172a' }}>{r.employee_name}</div></td>
                        <td><DepartmentBadge department={r.department} /></td>
                        <td><span style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.begin_time && r.begin_time !== '00:00' ? `${r.begin_time} - ${r.end_time}` : (r.shift_name || '-')}</span></td>
                        <td><span style={{ fontWeight: r.in_time ? '600' : 'normal', color: r.in_time ? '#0f172a' : '#94a3b8' }}>{r.in_time || '--:--'}</span></td>
                        <td><span style={{ color: r.out_time ? '#0f172a' : '#94a3b8' }}>{r.out_time || '--:--'}</span></td>
                        <td><span style={{ fontWeight: '600', color: r.total_duration !== '00:00' ? '#059669' : '#94a3b8' }}>{r.total_duration}</span></td>
                        <td><span style={{ color: r.late_by !== '00:00' ? '#e11d48' : '#64748b', fontWeight: r.late_by !== '00:00' ? '600' : 'normal' }}>{r.late_by}</span></td>
                        <td><span style={{ color: r.early_by !== '00:00' ? '#d97706' : '#64748b' }}>{r.early_by}</span></td>
                        <td><AttendanceStatusBadge status={r.status_code} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: EMPLOYEE-WISE ATTENDANCE HISTORY */}
      {/* ========================================================================= */}
      {activeReportTab === 'employee' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
          {/* Employee Selector Bar */}
          <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#475569' }}>Select Employee:</span>
                  <select
                    className="form-select"
                    style={{ width: 'auto', minWidth: '240px' }}
                    value={selectedEmployeeCode}
                    onChange={(e) => setSelectedEmployeeCode(e.target.value)}
                  >
                    {employeesList.map(e => (
                      <option key={e.employee_code} value={e.employee_code}>
                        {e.employee_code} - {e.employee_name} ({e.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>From:</span>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: 'auto', padding: '0.4rem 0.625rem', fontSize: '0.8125rem' }}
                    value={empStartDate}
                    onChange={(e) => setEmpStartDate(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>To:</span>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: 'auto', padding: '0.4rem 0.625rem', fontSize: '0.8125rem' }}
                    value={empEndDate}
                    onChange={(e) => setEmpEndDate(e.target.value)}
                  />
                </div>
              </div>

              <button className="btn btn-secondary btn-sm" onClick={exportEmployeeCSV}>
                <Download size={15} />
                Export Staff History
              </button>
            </div>
          </div>

          {/* Employee KPI Summary */}
          {employeeReportData?.summary && (
            <div className="kpi-grid">
              <StatCard
                icon={Percent}
                color="green"
                label="Attendance Rate"
                value={`${employeeReportData.summary.attendancePercentage}%`}
                subtext={`Present: ${employeeReportData.summary.presentDays || 0} / ${employeeReportData.summary.workingDays || 0} work days`}
              />
              <StatCard
                icon={Clock}
                color="blue"
                label="Total Logged Hours"
                value={`${employeeReportData.summary.totalHours} hrs`}
                subtext={`Overtime: ${employeeReportData.summary.overtimeHours}h`}
              />
              <StatCard
                icon={UserX}
                color="rose"
                label="Absences"
                value={employeeReportData.summary.absentDays || 0}
                subtext={`Weekly Offs: ${employeeReportData.summary.weeklyOffDays || 0}`}
              />
              <StatCard
                icon={AlertCircle}
                color="purple"
                label="Late Arrivals"
                value={employeeReportData.summary.lateDays || 0}
                subtext={`Total Late Time: ${employeeReportData.summary.lateHours}h`}
              />
            </div>
          )}

          {/* Employee Date-by-Date Records */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-header">
              <h3 style={{ fontSize: '1.0625rem' }}>
                Attendance Timeline & Biometric Punches
              </h3>
            </div>

            <div className="table-responsive-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Shift</th>
                    <th>In Time</th>
                    <th>Out Time</th>
                    <th>Duration</th>
                    <th>Late By</th>
                    <th>Status</th>
                    <th>Biometric Punch Records</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>
                        <div style={{ color: '#0284c7', fontWeight: '600' }} className="animate-pulse">
                          Loading employee history...
                        </div>
                      </td>
                    </tr>
                  ) : !employeeReportData?.records || employeeReportData.records.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                        No records found for this employee.
                      </td>
                    </tr>
                  ) : (
                    employeeReportData.records.map((r) => (
                      <tr key={r.attendance_date_iso}>
                        <td style={{ fontWeight: '600' }}>{r.attendance_date_iso}</td>
                        <td><span style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.begin_time && r.begin_time !== '00:00' ? `${r.begin_time} - ${r.end_time}` : (r.shift_name || '-')}</span></td>
                        <td><span style={{ fontWeight: r.in_time ? '600' : 'normal' }}>{r.in_time || '--:--'}</span></td>
                        <td><span>{r.out_time || '--:--'}</span></td>
                        <td><span style={{ fontWeight: '600', color: r.total_duration !== '00:00' ? '#059669' : '#94a3b8' }}>{r.total_duration}</span></td>
                        <td><span style={{ color: r.late_by !== '00:00' ? '#e11d48' : '#94a3b8' }}>{r.late_by}</span></td>
                        <td><AttendanceStatusBadge status={r.status_code} /></td>
                        <td style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                          {r.punch_records || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DATE-RANGE ANALYTICS */}
      {/* ========================================================================= */}
      {activeReportTab === 'range' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
          {/* Range Controls */}
          <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#475569' }}>Start Date:</span>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: 'auto' }}
                    value={rangeStartDate}
                    onChange={(e) => setRangeStartDate(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#475569' }}>End Date:</span>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: 'auto' }}
                    value={rangeEndDate}
                    onChange={(e) => setRangeEndDate(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#475569' }}>Department:</span>
                  <select
                    className="form-select"
                    style={{ width: 'auto', minWidth: '160px' }}
                    value={rangeDepartment}
                    onChange={(e) => setRangeDepartment(e.target.value)}
                  >
                    <option value="All">All Departments</option>
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button className="btn btn-secondary btn-sm" onClick={fetchRangeReport}>
                <Filter size={15} />
                Apply Filter
              </button>
            </div>
          </div>

          {/* Range KPI Summary */}
          {rangeReportData?.summary && (
            <div className="kpi-grid">
              <StatCard
                icon={Users}
                color="blue"
                label="Total Shifts Logged"
                value={rangeReportData.summary.totalShifts}
                subtext={`Active Staff: ${rangeReportData.summary.activeStaffCount}`}
              />
              <StatCard
                icon={UserCheck}
                color="green"
                label="Total Present"
                value={rangeReportData.summary.presentCount}
                subtext={`Rate: ${rangeReportData.summary.attendanceRate}%`}
              />
              <StatCard
                icon={UserX}
                color="rose"
                label="Total Absent"
                value={rangeReportData.summary.absentCount}
                subtext={`Weekly Offs: ${rangeReportData.summary.weeklyOffCount}`}
              />
              <StatCard
                icon={Clock}
                color="purple"
                label="Total Hours"
                value={`${rangeReportData.summary.totalWorkingHours}h`}
                subtext={`Late Time: ${rangeReportData.summary.totalLateHours}h`}
              />
            </div>
          )}

          {/* Department Breakdown Table */}
          {rangeReportData?.departmentBreakdown && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <Building2 size={18} color="#0284c7" />
                  <h3 style={{ fontSize: '1.0625rem' }}>Department-Wise Attendance Breakdown</h3>
                </div>
              </div>

              <div className="table-responsive-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th style={{ textAlign: 'center' }}>Total Shifts</th>
                      <th style={{ textAlign: 'center', color: '#059669' }}>Present</th>
                      <th style={{ textAlign: 'center', color: '#e11d48' }}>Absent</th>
                      <th style={{ textAlign: 'center', color: '#d97706' }}>Late Shifts</th>
                      <th style={{ textAlign: 'right' }}>Total Hours</th>
                      <th style={{ textAlign: 'right' }}>Attendance Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rangeReportData.departmentBreakdown.map(dept => {
                      const rate = dept.totalShifts > 0 ? Math.round((dept.presentCount / dept.totalShifts) * 100) : 0;
                      return (
                        <tr key={dept.department}>
                          <td><div style={{ fontWeight: '600' }}>{dept.department}</div></td>
                          <td style={{ textAlign: 'center', fontWeight: '600' }}>{dept.totalShifts}</td>
                          <td style={{ textAlign: 'center', fontWeight: '700', color: '#059669' }}>{dept.presentCount}</td>
                          <td style={{ textAlign: 'center', fontWeight: '700', color: '#e11d48' }}>{dept.absentCount}</td>
                          <td style={{ textAlign: 'center', color: dept.lateCount > 0 ? '#d97706' : '#94a3b8' }}>{dept.lateCount}</td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>{((dept.totalWorkingMinutes || 0) / 60).toFixed(1)}h</td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: '#0284c7' }}>{rate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
