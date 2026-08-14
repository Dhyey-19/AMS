import React from 'react';
import { Modal } from '../common/Modal';
import { StatusBadge, DepartmentBadge } from '../common/Badge';
import { User, Briefcase, Calendar, Shield, CreditCard, Clock, DollarSign, ShieldAlert, FileSpreadsheet, Edit3 } from 'lucide-react';

export const EmployeeDetailsModal = ({ isOpen, onClose, employee, onOpenAttendanceSheet, onEditMaster }) => {
  if (!employee) return null;

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === '1900-01-01' || dateStr === '3000-01-01' || dateStr === '2095-04-30') {
      return dateStr === '3000-01-01' ? 'Current (Active)' : 'Not Specified';
    }
    return dateStr;
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
                <Edit3 size={15} /> Edit Rules
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
              <span className="detail-item-value" style={{ fontWeight: '700', color: '#0284c7' }}>{employee.standard_work_hours || 12} hrs</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Standard Break</span>
              <span className="detail-item-value">{employee.standard_break_minutes || 0} mins</span>
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
          </div>
        </div>

        {/* Section 2: Compensation & Salary */}
        <div>
          <h4 style={{ fontSize: '0.9375rem', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <DollarSign size={16} color="#15803d" />
            Salary & Rate Specifications
          </h4>
          <div className="detail-info-grid">
            <div className="detail-item">
              <span className="detail-item-label">Base Monthly Salary</span>
              <span className="detail-item-value" style={{ fontWeight: '700', color: '#15803d', fontSize: '1rem' }}>
                {employee.salary ? `₹${Number(employee.salary).toLocaleString()}` : 'Not Specified'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Payment Mode</span>
              <span className="detail-item-value">{employee.payment_mode || 'Bank'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Hourly Rate</span>
              <span className="detail-item-value">{employee.hourly_rate ? `₹${employee.hourly_rate}/hr` : 'Auto Computed'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Daily Rate</span>
              <span className="detail-item-value">{employee.daily_rate ? `₹${employee.daily_rate}/day` : 'Auto Computed'}</span>
            </div>
          </div>
        </div>

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
