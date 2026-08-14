import React, { useState, useEffect } from 'react';
import { employeeApi, attendanceApi } from '../services/api';
import { StatCard } from '../components/common/StatCard';
import { StatusBadge, DepartmentBadge } from '../components/common/Badge';
import { EmployeeDetailsModal } from '../components/employees/EmployeeDetailsModal';
import { MasterDataImportModal } from '../components/employees/MasterDataImportModal';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Building2, 
  FileSpreadsheet, 
  ArrowRight, 
  Eye, 
  Activity,
  Calendar,
  Clock,
  TrendingUp
} from 'lucide-react';

export const DashboardPage = ({ 
  onNavigateToImport, 
  onNavigateToEmployees,
  onNavigateToAttendanceImport,
  onNavigateToReports,
  onNavigateToEmployeeAttendance
}) => {
  const [stats, setStats] = useState(null);
  const [recentEmployees, setRecentEmployees] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, employeesRes, monthlyRes] = await Promise.all([
        employeeApi.getStats(),
        employeeApi.getAll({ limit: 6, sortBy: 'employee_code', sortOrder: 'asc' }),
        attendanceApi.getMonthlyReport().catch(() => ({ data: null }))
      ]);
      setStats(statsRes.data);
      setRecentEmployees(employeesRes.data || []);
      setAttendanceSummary(monthlyRes?.data || null);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const overview = stats?.overview || {
    totalEmployees: 0,
    activeWorking: 0,
    resigned: 0,
    totalDepartments: 0
  };

  const departmentStats = stats?.departmentStats || [];
  const maxDeptCount = departmentStats.length > 0 ? Math.max(...departmentStats.map(d => d.total)) : 1;

  return (
    <div className="dashboard-grid">
      {/* Top Hospital KPI Cards */}
      <div className="kpi-grid">
        <StatCard
          icon={Users}
          color="blue"
          label="Total Master Records"
          value={overview.totalEmployees}
          subtext="Total staff in database"
        />
        <StatCard
          icon={UserCheck}
          color="green"
          label="Active Working Staff"
          value={overview.activeWorking}
          subtext={`${overview.totalEmployees > 0 ? Math.round((overview.activeWorking / overview.totalEmployees) * 100) : 0}% active retention`}
        />
        <StatCard
          icon={Calendar}
          color="purple"
          label="Monthly Shifts Logged"
          value={attendanceSummary?.overview?.totalLogs || 0}
          subtext={attendanceSummary?.month ? `Month: ${attendanceSummary.month}` : 'No attendance loaded'}
        />
        <StatCard
          icon={Clock}
          color="rose"
          label="Total Hours Logged"
          value={`${attendanceSummary?.overview?.totalHours || 0}h`}
          subtext={`Present shifts: ${attendanceSummary?.overview?.totalPresent || 0}`}
        />
      </div>

      {/* Main Split: Department Breakdown & Quick Actions */}
      <div className="departments-section">
        {/* Department Visual Breakdown Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <Building2 size={20} color="#0284c7" />
              <h3 style={{ fontSize: '1.0625rem' }}>Staff Distribution by Department</h3>
            </div>
            <span className="badge badge-dept">
              {departmentStats.length} Departments Active
            </span>
          </div>

          <div className="card-body">
            {departmentStats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                <p>No department data available. Import the Master Data file to view breakdown.</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsImportModalOpen(true)}
                  style={{ marginTop: '0.75rem' }}
                >
                  <FileSpreadsheet size={15} />
                  Import MD Master Data
                </button>
              </div>
            ) : (
              <div className="department-list">
                {departmentStats.slice(0, 7).map((dept) => {
                  const percent = Math.round((dept.total / maxDeptCount) * 100);
                  return (
                    <div key={dept.department} className="dept-bar-item">
                      <div className="dept-bar-info">
                        <span className="dept-name">{dept.department}</span>
                        <span className="dept-count-badge">
                          <strong>{dept.total}</strong> staff{' '}
                          <span style={{ color: '#059669', fontSize: '0.75rem' }}>
                            ({dept.working} active)
                          </span>
                        </span>
                      </div>
                      <div className="dept-progress-track">
                        <div
                          className="dept-progress-fill"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions & System Status Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: '1.0625rem' }}>Quick Actions</h3>
            </div>
            <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
              <div className="quick-actions-grid">
                {onNavigateToEmployeeAttendance && (
                  <button
                    className="quick-action-btn"
                    onClick={() => onNavigateToEmployeeAttendance('128')}
                    style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', borderColor: '#bae6fd' }}
                  >
                    <div className="quick-action-icon" style={{ color: '#0284c7' }}>
                      <UserCheck size={18} />
                    </div>
                    <div>
                      <div style={{ color: '#0369a1', fontWeight: '700' }}>Employee Attendance Records</div>
                      <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 'normal' }}>
                        View dynamic calculations, shifts, salary & Excel exports
                      </div>
                    </div>
                  </button>
                )}

                <button
                  className="quick-action-btn"
                  onClick={onNavigateToAttendanceImport}
                >
                  <div className="quick-action-icon" style={{ color: '#059669' }}>
                    <Calendar size={18} />
                  </div>
                  <div>
                    <div>Import Attendance (MD MAY)</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>
                      Upload CSV/Excel or load sample files
                    </div>
                  </div>
                </button>

                <button
                  className="quick-action-btn"
                  onClick={onNavigateToReports}
                >
                  <div className="quick-action-icon" style={{ color: '#7c3aed' }}>
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <div>Attendance Reports & Analytics</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>
                      Daily roll-call, monthly summary & exports
                    </div>
                  </div>
                </button>

                <button
                  className="quick-action-btn"
                  onClick={onNavigateToImport}
                >
                  <div className="quick-action-icon">
                    <FileSpreadsheet size={18} />
                  </div>
                  <div>
                    <div>Import Master Data</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>
                      Upload MD MASTER.csv
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* SQLite Status Card - Clean Light Theme */}
          <div 
            className="card"
            style={{
              background: 'var(--primary-50)',
              border: '1px solid var(--primary-200)',
              padding: '1.25rem 1.5rem',
              color: 'var(--slate-800)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
              <Activity size={20} color="var(--primary-600)" />
              <h4 style={{ color: 'var(--primary-900)', fontSize: '1rem', fontWeight: '700', margin: 0 }}>
                Local Database Active
              </h4>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--slate-600)', lineHeight: '1.5', margin: 0 }}>
              Attendance & Master records stored locally in <code>ams.db</code> with automatic upsert on <code>Employee ID + Date</code>.
            </p>
            <div style={{ marginTop: '0.875rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge badge-dept">
                WAL Engine Active
              </span>
              <span className="badge badge-working">
                Deduplication Ready
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Employees Table Preview */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Users size={20} color="#0284c7" />
            <h3 style={{ fontSize: '1.0625rem' }}>Hospital Staff Roster Overview</h3>
          </div>
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={onNavigateToEmployees}
          >
            <span>View All Staff</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="table-responsive-wrapper" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Employee Name</th>
                <th>Department</th>
                <th>Designation</th>
                <th>DOJ</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {recentEmployees.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem' }}>
                    <p style={{ color: '#94a3b8' }}>No master records loaded yet.</p>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setIsImportModalOpen(true)}
                      style={{ marginTop: '0.5rem' }}
                    >
                      <FileSpreadsheet size={15} />
                      Import MD Master Data
                    </button>
                  </td>
                </tr>
              ) : (
                recentEmployees.map((emp) => (
                  <tr key={emp.employee_code}>
                    <td>
                      <span className="emp-code-pill">{emp.employee_code}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>{emp.employee_name}</div>
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
                        {emp.doj && emp.doj !== '1900-01-01' ? emp.doj : '-'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={emp.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedEmployee(emp)}
                        style={{ padding: '0.35rem 0.65rem' }}
                      >
                        <Eye size={14} />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Details Modal */}
      <EmployeeDetailsModal
        isOpen={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        employee={selectedEmployee}
        onOpenAttendanceSheet={onNavigateToEmployeeAttendance}
      />

      {/* Master Data Import Modal */}
      <MasterDataImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={fetchDashboardData}
      />
    </div>
  );
};
