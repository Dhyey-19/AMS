import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Save, 
  User, 
  Clock, 
  DollarSign, 
  ShieldAlert, 
  FileText, 
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Building,
  Briefcase
} from 'lucide-react';
import { employeeApi } from '../../services/api';

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return null;
  const str = String(timeStr).trim().replace('.', ':');
  const parts = str.split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};

const formatTimeToHHMM = (timeStr) => {
  if (!timeStr) return '';
  const str = String(timeStr).trim().replace('.', ':');
  if (str === '-' || str === '—' || str.toLowerCase() === 'null') return '';
  const parts = str.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  return str;
};

const minutesToHHMM = (totalMins) => {
  if (totalMins === null || totalMins === undefined || isNaN(totalMins) || totalMins < 0) return '00:00';
  const h = Math.floor(totalMins / 60);
  const m = Math.round(totalMins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
  return minutesToHHMM(totalMins);
};

const calculateWorkHoursFromShift = (inTime, outTime, breakMins) => {
  const inM = parseTimeToMinutes(inTime);
  const outM = parseTimeToMinutes(outTime);
  if (inM === null || outM === null) return null;
  const bM = parseInt(breakMins, 10) || 0;
  let durationMins = outM >= inM ? (outM - inM) : (1440 - inM + outM);
  let workMins = Math.max(0, durationMins - bM);
  return minutesToHHMM(workMins);
};

const parseWorkHoursToDecimal = (val) => {
  if (val === null || val === undefined || val === '') return 12.0;
  if (typeof val === 'string' && val.includes(':')) {
    const parts = val.split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return Number((h + m / 60).toFixed(4));
  }
  const num = parseFloat(val);
  return isNaN(num) ? 12.0 : num;
};

export const EditEmployeeMasterModal = ({ employee, isOpen, onClose, onUpdated }) => {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('work'); // 'work', 'salary', 'rules', 'personal'

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (employee) {
      const stdIn = formatTimeToHHMM(employee.standard_in_time || '08:00');
      const stdOut = formatTimeToHHMM(employee.standard_out_time || '20:00');
      const stdBreak = employee.standard_break_minutes !== undefined && employee.standard_break_minutes !== null ? employee.standard_break_minutes : 0;
      
      let workHoursHHMM = formatHoursToHHMM(employee.standard_work_hours);
      if (!employee.standard_work_hours && stdIn && stdOut) {
        const computed = calculateWorkHoursFromShift(stdIn, stdOut, stdBreak);
        if (computed) workHoursHHMM = computed;
      }

      setFormData({
        employee_code: employee.employee_code || '',
        employee_name: employee.employee_name || '',
        department: employee.department || 'General',
        designation: employee.designation || '',
        company: employee.company || 'Global Ivf Hospital',
        location: employee.location || 'Default',
        status: employee.status || 'Working',
        gender: employee.gender || 'Not Specified',
        doj: employee.doj || '',
        salary: employee.salary !== null && employee.salary !== undefined ? employee.salary : '',
        incentive: employee.incentive !== null && employee.incentive !== undefined ? employee.incentive : '',
        standard_in_time: stdIn,
        standard_out_time: stdOut,
        standard_break_minutes: stdBreak,
        standard_work_hours: workHoursHHMM,
        payment_mode: employee.payment_mode || 'Bank',
        late_grace_minutes: employee.late_grace_minutes || 11,
        late_deduction_multiplier: employee.late_deduction_multiplier ?? 0.5,
        overtime_multiplier: employee.overtime_multiplier ?? 2.0,
        overtime_allowed: employee.overtime_allowed !== undefined ? (employee.overtime_allowed ? 1 : 0) : 1,
        min_overtime_minutes: employee.min_overtime_minutes !== undefined && employee.min_overtime_minutes !== null ? employee.min_overtime_minutes : 0,
        min_overtime_deduction_minutes: employee.min_overtime_deduction_minutes !== undefined && employee.min_overtime_deduction_minutes !== null ? employee.min_overtime_deduction_minutes : 0,
        special_rules: employee.special_rules || '',
        wop: employee.wop !== undefined && employee.wop !== null ? employee.wop : 0,
        ypl: employee.ypl !== undefined && employee.ypl !== null ? employee.ypl : 0,
        uid_no: employee.uid_no || '',
        pan_no: employee.pan_no || '',
        rfid: employee.rfid || ''
      });
      setError(null);
      setSuccess(null);
    }
  }, [employee]);

  if (!isOpen || !employee) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? (checked ? 1 : 0) : value;

    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: val
      };

      // When In Time, Out Time, or Break Mins change, auto-calculate standard daily work hours
      if (name === 'standard_in_time' || name === 'standard_out_time' || name === 'standard_break_minutes') {
        const auto = calculateWorkHoursFromShift(
          name === 'standard_in_time' ? val : next.standard_in_time,
          name === 'standard_out_time' ? val : next.standard_out_time,
          name === 'standard_break_minutes' ? val : next.standard_break_minutes
        );
        if (auto) {
          next.standard_work_hours = auto;
        }
      }

      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        ...formData,
        salary: formData.salary !== '' ? parseFloat(formData.salary) : null,
        incentive: formData.incentive !== '' ? parseFloat(formData.incentive) : 0,
        standard_break_minutes: parseInt(formData.standard_break_minutes, 10) || 0,
        standard_work_hours: parseWorkHoursToDecimal(formData.standard_work_hours),
        late_grace_minutes: parseInt(formData.late_grace_minutes, 10) || 11,
        late_deduction_multiplier: parseFloat(formData.late_deduction_multiplier) || 0.5,
        overtime_multiplier: parseFloat(formData.overtime_multiplier) || 2.0,
        overtime_allowed: parseInt(formData.overtime_allowed, 10) || 1,
        min_overtime_minutes: parseInt(formData.min_overtime_minutes, 10) || 0,
        min_overtime_deduction_minutes: parseInt(formData.min_overtime_deduction_minutes, 10) || 0,
        wop: parseFloat(formData.wop) || 0,
        ypl: parseFloat(formData.ypl) || 0
      };

      const res = await employeeApi.update(employee.employee_code, payload);
      setSuccess('Employee master details and rules updated successfully!');
      if (onUpdated) {
        setTimeout(() => {
          onUpdated(res.data);
          onClose();
        }, 800);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update employee details');
    } finally {
      setLoading(false);
    }
  };

  const modalElement = (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="modal-dialog modal-lg" 
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        {/* Modal Header - Light Professional */}
        <div 
          style={{
            padding: '1.25rem 1.5rem',
            background: '#ffffff',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div 
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--primary-600) 0%, var(--primary-700) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '1.1rem'
              }}
            >
              {formData.employee_name?.charAt(0) || 'E'}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '700', color: 'var(--slate-900)' }}>
                Edit Employee Master & Rules
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--slate-500)' }}>
                Employee #{formData.employee_code} • {formData.employee_name}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="modal-close-btn"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation - Light Theme */}
        <div 
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--slate-50)',
            padding: '0.35rem 1rem 0',
            flexShrink: 0,
            overflowX: 'auto'
          }}
        >
          {[
            { id: 'work', label: 'Work & Timings', icon: Clock },
            { id: 'salary', label: 'Salary & Rates', icon: DollarSign },
            { id: 'rules', label: 'Special Rules & Bond', icon: ShieldAlert },
            { id: 'personal', label: 'Profile Details', icon: User }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 0.875rem',
                  fontSize: '0.85rem',
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? 'var(--primary-700)' : 'var(--slate-600)',
                  background: isActive ? '#ffffff' : 'transparent',
                  border: '1px solid transparent',
                  borderBottomColor: isActive ? '#ffffff' : 'transparent',
                  borderTopLeftRadius: '8px',
                  borderTopRightRadius: '8px',
                  cursor: 'pointer',
                  marginBottom: '-1px',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={15} color={isActive ? 'var(--primary-600)' : 'var(--slate-400)'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Notifications */}
        {error && (
          <div 
            style={{
              margin: '1rem 1.5rem 0',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger-text)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem'
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div 
            style={{
              margin: '1rem 1.5rem 0',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'var(--success-bg)',
              border: '1px solid var(--success-border)',
              color: 'var(--success-text)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem'
            }}
          >
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        {/* Form Body - Fully Scrollable */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div 
            className="modal-body"
            style={{
              padding: '1.25rem 1.5rem',
              overflowY: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
          >
            {/* TAB 1: Work & Shift Timings */}
            {activeTab === 'work' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--slate-500)', letterSpacing: '0.04em' }}>
                  Standard Shift Schedule
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Standard In Time (HH:MM)</label>
                    <input 
                      type="time" 
                      name="standard_in_time"
                      value={formData.standard_in_time || ''}
                      onChange={handleChange}
                      className="form-control"
                    />
                    <small style={{ color: 'var(--slate-500)', fontSize: '0.75rem' }}>Time: HH:MM (e.g. 08:00, 09:30)</small>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Standard Out Time (HH:MM)</label>
                    <input 
                      type="time" 
                      name="standard_out_time"
                      value={formData.standard_out_time || ''}
                      onChange={handleChange}
                      className="form-control"
                    />
                    <small style={{ color: 'var(--slate-500)', fontSize: '0.75rem' }}>Time: HH:MM (e.g. 20:00, 18:00)</small>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <label className="form-label" style={{ margin: 0 }}>Standard Daily Work Hours (HH:MM)</label>
                      <button
                        type="button"
                        onClick={() => {
                          const auto = calculateWorkHoursFromShift(formData.standard_in_time, formData.standard_out_time, formData.standard_break_minutes);
                          if (auto) {
                            setFormData(prev => ({ ...prev, standard_work_hours: auto }));
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary-600)',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          padding: 0
                        }}
                        title="Recalculate (Out - In - Break)"
                      >
                        Auto-Calculate
                      </button>
                    </div>
                    <input 
                      type="time" 
                      name="standard_work_hours"
                      value={formData.standard_work_hours || ''}
                      onChange={handleChange}
                      className="form-control"
                      style={{ fontWeight: '700', color: 'var(--primary-700)', fontSize: '0.95rem' }}
                    />
                    <small style={{ color: 'var(--slate-500)', fontSize: '0.75rem' }}>
                      Time: HH:MM • Auto-calculated & Editable
                    </small>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Standard Break Time (Minutes)</label>
                    <input 
                      type="number" 
                      name="standard_break_minutes"
                      value={formData.standard_break_minutes}
                      onChange={handleChange}
                      placeholder="e.g. 0, 30, 60, 120"
                      className="form-control"
                    />
                    <small style={{ color: 'var(--slate-500)', fontSize: '0.75rem' }}>e.g. 0 min, 30 min, 60 min, 120 min</small>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">WOP (Weekly Off Present - Days)</label>
                    <input 
                      type="number" 
                      step="0.5"
                      name="wop"
                      value={formData.wop}
                      onChange={handleChange}
                      placeholder="e.g. 0, 1, 2"
                      className="form-control"
                    />
                    <small style={{ color: 'var(--slate-500)', fontSize: '0.75rem' }}>Days worked on Weekly Off</small>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">YPL (Yearly Paid Leave - Days)</label>
                    <input 
                      type="number" 
                      step="0.5"
                      name="ypl"
                      value={formData.ypl}
                      onChange={handleChange}
                      placeholder="e.g. 12, 15, 18"
                      className="form-control"
                    />
                    <small style={{ color: 'var(--slate-500)', fontSize: '0.75rem' }}>Total yearly paid leaves entitled</small>
                  </div>
                </div>

                <div 
                  style={{
                    padding: '0.85rem 1rem',
                    background: 'var(--primary-50)',
                    border: '1px solid var(--primary-200)',
                    borderRadius: '8px',
                    fontSize: '0.825rem',
                    color: 'var(--primary-800)',
                    lineHeight: '1.4'
                  }}
                >
                  💡 <strong>Dynamic Calculation Note:</strong> AMS uses these individual shift timings to calculate actual work hours, expected hours, deficit/surplus differences, late arrivals, and early departures dynamically.
                </div>
              </div>
            )}

            {/* TAB 2: Salary & Rates */}
            {activeTab === 'salary' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--slate-500)', letterSpacing: '0.04em' }}>
                    Salary Structure & Calculation Basis
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Base Monthly Salary (₹)</label>
                    <input 
                      type="number" 
                      name="salary"
                      value={formData.salary}
                      onChange={handleChange}
                      placeholder="e.g. 12000, 22000, 35000"
                      className="form-control"
                      style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--slate-900)' }}
                    />
                    <small style={{ color: 'var(--slate-500)', fontSize: '0.75rem' }}>Fixed base salary per month</small>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Monthly Incentive (₹)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      name="incentive"
                      value={formData.incentive}
                      onChange={handleChange}
                      placeholder="e.g. 1000, 2500"
                      className="form-control"
                      style={{ fontWeight: '600', color: '#0284c7' }}
                    />
                    <small style={{ color: 'var(--slate-500)', fontSize: '0.75rem' }}>Additional monthly incentive</small>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Payment Mode</label>
                    <select
                      name="payment_mode"
                      value={formData.payment_mode}
                      onChange={handleChange}
                      className="form-control"
                    >
                      <option value="Bank">Bank Transfer</option>
                      <option value="Cheque">Cheque (CHQ)</option>
                      <option value="Cash">Cash</option>
                      <option value="TDS / Cheque">TDS / Cheque</option>
                    </select>
                    <small style={{ color: 'var(--slate-500)', fontSize: '0.75rem' }}>Disbursement channel</small>
                  </div>
                </div>

                {/* Dynamic Rate Formulation Preview */}
                {(() => {
                  const base = parseFloat(formData.salary) || 0;
                  const stdHours = parseWorkHoursToDecimal(formData.standard_work_hours) || 12.0;
                  const estDailyRate30 = base > 0 ? (base / 30).toFixed(2) : '0.00';
                  const estDailyRate31 = base > 0 ? (base / 31).toFixed(2) : '0.00';
                  const estHourlyRate30 = base > 0 && stdHours > 0 ? ((base / 30) / stdHours).toFixed(2) : '0.00';
                  const estHourlyRate31 = base > 0 && stdHours > 0 ? ((base / 31) / stdHours).toFixed(2) : '0.00';

                  return (
                    <div 
                      style={{
                        padding: '1rem',
                        background: '#f8fafc',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Sparkles size={14} color="var(--primary-600)" /> Dynamic Rate Formulation (Auto-Computed per Month)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.8125rem' }}>
                        <div style={{ background: '#ffffff', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <span style={{ color: 'var(--slate-500)', display: 'block', fontSize: '0.75rem' }}>Daily Rate (31-day month)</span>
                          <strong style={{ color: 'var(--primary-700)', fontSize: '1rem' }}>₹{estDailyRate31}</strong> / day
                        </div>
                        <div style={{ background: '#ffffff', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <span style={{ color: 'var(--slate-500)', display: 'block', fontSize: '0.75rem' }}>Hourly Rate (31-day month)</span>
                          <strong style={{ color: 'var(--primary-700)', fontSize: '1rem' }}>₹{estHourlyRate31}</strong> / hr
                        </div>
                        <div style={{ background: '#ffffff', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <span style={{ color: 'var(--slate-500)', display: 'block', fontSize: '0.75rem' }}>Daily Rate (30-day month)</span>
                          <strong style={{ color: 'var(--slate-800)', fontSize: '1rem' }}>₹{estDailyRate30}</strong> / day
                        </div>
                        <div style={{ background: '#ffffff', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <span style={{ color: 'var(--slate-500)', display: 'block', fontSize: '0.75rem' }}>Hourly Rate (30-day month)</span>
                          <strong style={{ color: 'var(--slate-800)', fontSize: '1rem' }}>₹{estHourlyRate30}</strong> / hr
                        </div>
                      </div>
                      <small style={{ color: 'var(--slate-500)', fontSize: '0.725rem', marginTop: '0.25rem' }}>
                        Rates are calculated dynamically: <code>Daily Rate = Salary / Days In Month</code> and <code>Hourly Rate = Daily Rate / Standard Work Hours ({formData.standard_work_hours || '12:00'})</code>.
                      </small>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 3: Special Rules & Bond */}
            {activeTab === 'rules' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--slate-500)', letterSpacing: '0.04em' }}>
                  Late Tolerance, Overtime & Bond Conditions
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Late Grace (Mins)</label>
                    <input 
                      type="number" 
                      name="late_grace_minutes"
                      value={formData.late_grace_minutes}
                      onChange={handleChange}
                      placeholder="Default 11"
                      className="form-control"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Late Multiplier</label>
                    <input 
                      type="number" 
                      step="0.1"
                      name="late_deduction_multiplier"
                      value={formData.late_deduction_multiplier}
                      onChange={handleChange}
                      placeholder="e.g. 0.5, 1.0"
                      className="form-control"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">OT Multiplier</label>
                    <input 
                      type="number" 
                      step="0.1"
                      name="overtime_multiplier"
                      value={formData.overtime_multiplier}
                      onChange={handleChange}
                      placeholder="e.g. 2.0, 1.5"
                      className="form-control"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" title="Minimum overtime duration required to qualify for overtime pay">Min OT (Mins)</label>
                    <input 
                      type="number" 
                      name="min_overtime_minutes"
                      value={formData.min_overtime_minutes}
                      onChange={handleChange}
                      placeholder="e.g. 0, 30, 60"
                      className="form-control"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" title="Deduction in minutes applied to qualified overtime duration">OT Deduct (Mins)</label>
                    <input 
                      type="number" 
                      name="min_overtime_deduction_minutes"
                      value={formData.min_overtime_deduction_minutes}
                      onChange={handleChange}
                      placeholder="e.g. 0, 15, 30"
                      className="form-control"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input 
                    type="checkbox"
                    id="overtime_allowed"
                    name="overtime_allowed"
                    checked={Boolean(formData.overtime_allowed)}
                    onChange={handleChange}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary-600)' }}
                  />
                  <label htmlFor="overtime_allowed" style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--slate-800)', cursor: 'pointer' }}>
                    Allow Overtime compensation for this employee
                  </label>
                </div>

                <div className="form-group" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Special Rules / Bond Terms / Remarks (Gujarati & English)</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 'normal' }}>From Excel sheets</span>
                  </label>
                  <textarea 
                    name="special_rules"
                    value={formData.special_rules}
                    onChange={handleChange}
                    rows={4}
                    placeholder="e.g. એક વરસ નો બોન્ડ કરવો અને ત્રણ માસ માં એક પગાર પૂરો થાય તે રીતે DIPOSIT કપાવી... OVER TIME નથી આપવાનો પંચ ગણી ને હાજરી ગણવી..."
                    className="form-control"
                    style={{
                      padding: '0.75rem',
                      fontSize: '0.875rem',
                      lineHeight: '1.5',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>
            )}

            {/* TAB 4: Profile Details */}
            {activeTab === 'personal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--slate-500)', letterSpacing: '0.04em' }}>
                  Personal & Organizational Information
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Employee Full Name</label>
                    <input 
                      type="text" 
                      name="employee_name"
                      value={formData.employee_name}
                      onChange={handleChange}
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Department</label>
                    <input 
                      type="text" 
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      className="form-control"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Designation</label>
                    <input 
                      type="text" 
                      name="designation"
                      value={formData.designation}
                      onChange={handleChange}
                      className="form-control"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Date of Joining (DOJ)</label>
                    <input 
                      type="date" 
                      name="doj"
                      value={formData.doj}
                      onChange={handleChange}
                      className="form-control"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Status</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      className="form-control"
                    >
                      <option value="Working">Working / Active</option>
                      <option value="Resigned">Resigned</option>
                      <option value="Leave">On Extended Leave</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Gender</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="form-control"
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Not Specified">Not Specified</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">PAN / ID No</label>
                    <input 
                      type="text" 
                      name="pan_no"
                      value={formData.pan_no}
                      onChange={handleChange}
                      className="form-control"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">RFID Card No</label>
                    <input 
                      type="text" 
                      name="rfid"
                      value={formData.rfid}
                      onChange={handleChange}
                      className="form-control"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              <Save size={16} />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalElement, document.body);
};
