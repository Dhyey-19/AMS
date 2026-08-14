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
        standard_in_time: employee.standard_in_time || '08:00',
        standard_out_time: employee.standard_out_time || '20:00',
        standard_break_minutes: employee.standard_break_minutes || 0,
        standard_work_hours: employee.standard_work_hours || 12.0,
        rate_type: employee.rate_type || 'hourly',
        hourly_rate: employee.hourly_rate || '',
        daily_rate: employee.daily_rate || '',
        payment_mode: employee.payment_mode || 'Bank',
        late_grace_minutes: employee.late_grace_minutes || 11,
        late_deduction_multiplier: employee.late_deduction_multiplier ?? 0.5,
        overtime_multiplier: employee.overtime_multiplier ?? 2.0,
        overtime_allowed: employee.overtime_allowed !== undefined ? (employee.overtime_allowed ? 1 : 0) : 1,
        min_overtime_minutes: employee.min_overtime_minutes !== undefined && employee.min_overtime_minutes !== null ? employee.min_overtime_minutes : 0,
        min_overtime_deduction_minutes: employee.min_overtime_deduction_minutes !== undefined && employee.min_overtime_deduction_minutes !== null ? employee.min_overtime_deduction_minutes : 0,
        special_rules: employee.special_rules || '',
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
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? 1 : 0) : value
    }));
  };

  const handleAutoRateCalc = () => {
    const sal = parseFloat(formData.salary) || 0;
    const hrs = parseFloat(formData.standard_work_hours) || 8;
    if (sal > 0 && hrs > 0) {
      const daily = sal / 31;
      const hourly = daily / hrs;
      setFormData((prev) => ({
        ...prev,
        daily_rate: Number(daily.toFixed(2)),
        hourly_rate: Number(hourly.toFixed(2))
      }));
    }
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
        standard_break_minutes: parseInt(formData.standard_break_minutes, 10) || 0,
        standard_work_hours: parseFloat(formData.standard_work_hours) || 8.0,
        hourly_rate: formData.hourly_rate !== '' ? parseFloat(formData.hourly_rate) : null,
        daily_rate: formData.daily_rate !== '' ? parseFloat(formData.daily_rate) : null,
        late_grace_minutes: parseInt(formData.late_grace_minutes, 10) || 11,
        late_deduction_multiplier: parseFloat(formData.late_deduction_multiplier) || 0.5,
        overtime_multiplier: parseFloat(formData.overtime_multiplier) || 2.0,
        overtime_allowed: parseInt(formData.overtime_allowed, 10) || 1,
        min_overtime_minutes: parseInt(formData.min_overtime_minutes, 10) || 0,
        min_overtime_deduction_minutes: parseInt(formData.min_overtime_deduction_minutes, 10) || 0
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
                    <label className="form-label">Standard In Time (24h)</label>
                    <input 
                      type="text" 
                      name="standard_in_time"
                      value={formData.standard_in_time}
                      onChange={handleChange}
                      placeholder="e.g. 08:00 or 09:30"
                      className="form-control"
                    />
                    <small style={{ color: 'var(--slate-500)', fontSize: '0.75rem' }}>Format: HH:MM (e.g. 08:00, 09:30)</small>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Standard Out Time (24h)</label>
                    <input 
                      type="text" 
                      name="standard_out_time"
                      value={formData.standard_out_time}
                      onChange={handleChange}
                      placeholder="e.g. 20:00 or 14:00"
                      className="form-control"
                    />
                    <small style={{ color: 'var(--slate-500)', fontSize: '0.75rem' }}>Format: HH:MM (e.g. 20:00, 18:00)</small>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Standard Daily Work Hours</label>
                    <input 
                      type="number" 
                      step="0.1"
                      name="standard_work_hours"
                      value={formData.standard_work_hours}
                      onChange={handleChange}
                      placeholder="e.g. 12, 9, 8.5, 6, 4"
                      className="form-control"
                    />
                    <small style={{ color: 'var(--slate-500)', fontSize: '0.75rem' }}>Expected work hours per duty day</small>
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
                  <button
                    type="button"
                    onClick={handleAutoRateCalc}
                    className="btn btn-outline-primary btn-sm"
                  >
                    <Sparkles size={13} /> Auto-Compute Rates
                  </button>
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
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Rate Type</label>
                    <select
                      name="rate_type"
                      value={formData.rate_type}
                      onChange={handleChange}
                      className="form-control"
                    >
                      <option value="hourly">Hourly Rate Basis</option>
                      <option value="daily">Daily Rate Basis</option>
                      <option value="monthly_30">Monthly Divisor (30 Days)</option>
                      <option value="monthly_31">Monthly Divisor (31 Days)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Hourly Rate (₹/hr)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      name="hourly_rate"
                      value={formData.hourly_rate}
                      onChange={handleChange}
                      placeholder="Auto if blank"
                      className="form-control"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Daily Rate (₹/day)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      name="daily_rate"
                      value={formData.daily_rate}
                      onChange={handleChange}
                      placeholder="Auto if blank"
                      className="form-control"
                    />
                  </div>
                </div>
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
