import React from 'react';
import { Modal } from '../common/Modal';
import { StatusBadge, DepartmentBadge } from '../common/Badge';
import { User, Briefcase, Calendar, Shield, CreditCard, Clock, DollarSign, ShieldAlert, FileSpreadsheet, Edit3, History } from 'lucide-react';

export const EmployeeDetailsModal = ({ isOpen, onClose, employee, onOpenAttendanceSheet, onEditMaster }) => {
  if (!employee) return null;

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === '1900-01-01' || dateStr === '3000-01-01' || dateStr === '2095-04-30') {
      return dateStr === '3000-01-01' ? 'Current (Active)' : 'Not Specified';
    }
    return dateStr;
  };

  const formatHoursToHHMM = (hrs) => {
    if (hrs === null || hrs === undefined || hrs === '') return '12:00';
    if (typeof hrs === 'string' && hrs.includes(':')) {
      const parts = hrs.split(':');
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    const totalMins = Math.round(parseFloat(hrs) * 60);
    const h = Math.floor(totalMins / 60);
    const m = Math.round(totalMins % 60);
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Employee Master Profile - ${employee.employee_name}`}
      size="lg"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {onEditMaster && (
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  onClose();
                  onEditMaster(employee);
                }}
              >
                <Edit3 size={15} /> Edit Rules & W.E.F.
              </button>
            )}
            {onOpenAttendanceSheet && (
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  onClose();
                  onOpenAttendanceSheet(employee.employee_code);
                }}
              >
                <FileSpreadsheet size={15} /> View Attendance Sheet
              </button>
            )}
          </div>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Profile Header Card */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            padding: '1.25rem',
            backgroundColor: '#f0f9ff',
            borderRadius: '12px',
            border: '1px solid #bae6fd'
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.35rem',
              fontWeight: '700'
            }}
          >
            {employee.employee_name?.charAt(0) || 'E'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                {employee.employee_name}
              </h3>
              <StatusBadge status={employee.status} />
            </div>
            <div style={{ fontSize: '0.875rem', color: '#0369a1', fontWeight: '600', marginTop: '0.25rem' }}>
              {employee.designation || 'Staff Member'} &bull; {employee.department || 'Hospital Department'}
            </div>
          </div>
        </div>

        {/* Section 1: Working Schedule & Shift Rules */}
        <div>
          <h4 style={{ fontSize: '0.9375rem', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Clock size={16} color="#0284c7" />
            Working Schedule & Shift Tolerances
          </h4>
          <div className="detail-info-grid">
            <div className="detail-item">
              <span className="detail-item-label">Standard In Time</span>
              <span className="detail-item-value" style={{ fontWeight: '600', color: '#0f172a' }}>{employee.standard_in_time || '08:00'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Standard Out Time</span>
              <span className="detail-item-value" style={{ fontWeight: '600', color: '#0f172a' }}>{employee.standard_out_time || '20:00'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Standard Daily Hours</span>
              <span className="detail-item-value" style={{ fontWeight: '700', color: '#0284c7' }}>{formatHoursToHHMM(employee.standard_work_hours || 12)} hrs</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Standard Break</span>
              <span className="detail-item-value" style={{ fontWeight: '600', color: 'var(--slate-800)' }}>{formatBreakToHHMM(employee.standard_break_time || employee.standard_break_minutes || 0)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Late Grace Window</span>
              <span className="detail-item-value">{employee.late_grace_minutes || 11} mins</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Late Penalty Factor</span>
              <span className="detail-item-value">{employee.late_deduction_multiplier ?? 0.5}x</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Overtime Allowed</span>
              <span className="detail-item-value">{employee.overtime_allowed !== 0 ? 'Yes (Active)' : 'No (Disabled)'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Overtime Rate Factor</span>
              <span className="detail-item-value">{employee.overtime_multiplier ?? 2.0}x</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">WOP (Weekly Off Present)</span>
              <span className="detail-item-value" style={{ fontWeight: '700', color: '#0284c7' }}>{employee.wop || 0} days</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">YPL (Yearly Paid Leave)</span>
              <span className="detail-item-value" style={{ fontWeight: '700', color: '#059669' }}>{employee.ypl || 0} days</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Min Overtime Threshold</span>
              <span className="detail-item-value">{employee.min_overtime_minutes || 0} mins</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Min Overtime Deduction</span>
              <span className="detail-item-value">{employee.min_overtime_deduction_minutes || 0} mins</span>
            </div>
          </div>
        </div>

        {/* Section 2: Compensation & Salary */}
        <div>
          <h4 style={{ fontSize: '0.9375rem', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <DollarSign size={16} color="#15803d" />
            Salary & Incentive Specifications
          </h4>
          <div className="detail-info-grid">
            <div className="detail-item">
              <span className="detail-item-label">Base Monthly Salary</span>
              <span className="detail-item-value" style={{ fontWeight: '700', color: '#15803d', fontSize: '1rem' }}>
                {employee.salary ? `₹${Number(employee.salary).toLocaleString()}` : 'Not Specified'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Monthly Incentive</span>
              <span className="detail-item-value" style={{ fontWeight: '600', color: '#0284c7' }}>
                {employee.incentive ? `₹${Number(employee.incentive).toLocaleString()}` : '₹0'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Payment Mode</span>
              <span className="detail-item-value">{employee.payment_mode || 'Bank'}</span>
            </div>
          </div>
        </div>

        {/* Section 2.5: W.E.F. History Timeline */}
        {employee.wef_history && employee.wef_history.length > 0 && (
          <div>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: '700', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <History size={16} color="#0284c7" />
              With Effect From (W.E.F.) Timeline ({employee.wef_history.length} Revision{employee.wef_history.length === 1 ? '' : 's'})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {employee.wef_history.map((rev, idx) => (
                <div 
                  key={rev.id || idx}
                  style={{
                    padding: '0.6rem 0.85rem',
                    background: idx === 0 ? '#f0f9ff' : '#f8fafc',
                    border: idx === 0 ? '1px solid #bae6fd' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    fontSize: '0.8125rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: '700', color: '#0369a1', background: '#e0f2fe', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                      W.E.F. {rev.effective_date}
                    </span>
                    {idx === 0 && (
                      <span style={{ fontSize: '0.7rem', fontWeight: '700', background: '#dcfce7', color: '#15803d', padding: '0.1rem 0.35rem', borderRadius: '999px' }}>
                        Active
                      </span>
                    )}
                    {rev.remarks && <span style={{ color: '#64748b', fontStyle: 'italic' }}>({rev.remarks})</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', color: '#334155' }}>
                    <span>Salary: <strong style={{ color: '#15803d' }}>₹{rev.salary ? rev.salary.toLocaleString() : '0'}</strong></span>
                    <span>Shift: <strong>{rev.standard_in_time || '08:00'}-{rev.standard_out_time || '20:00'}</strong></span>
                    <span>Break: <strong>{formatBreakToHHMM(rev.standard_break_minutes || 0)}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 3: Special Rules / Bond Conditions */}
        {employee.special_rules && (
          <div>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: '700', color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <ShieldAlert size={16} color="#b45309" />
              Special Rules & Bond Terms (From Excel Sheets)
            </h4>
            <div 
              style={{
                padding: '0.85rem 1rem',
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                color: '#78350f',
                fontSize: '0.875rem',
                lineHeight: '1.5'
              }}
            >
              {employee.special_rules}
            </div>
          </div>
        )}

        {/* Section 4: Employment & Statutory Records */}
        <div>
          <h4 style={{ fontSize: '0.9375rem', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Briefcase size={16} color="#0284c7" />
            Employment & Statutory Records
          </h4>
          <div className="detail-info-grid">
            <div className="detail-item">
              <span className="detail-item-label">Employee Code</span>
              <span className="detail-item-value emp-code-pill">{employee.employee_code}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Device Code</span>
              <span className="detail-item-value">{employee.device_code || '-'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Department</span>
              <span className="detail-item-value">{employee.department || '-'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Designation</span>
              <span className="detail-item-value">{employee.designation || '-'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Date of Joining (DOJ)</span>
              <span className="detail-item-value">{formatDate(employee.doj)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Gender</span>
              <span className="detail-item-value">{employee.gender || 'Not Specified'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">PAN Card No</span>
              <span className="detail-item-value">{employee.pan_no || '-'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">RFID Card</span>
              <span className="detail-item-value">{employee.rfid || '-'}</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
