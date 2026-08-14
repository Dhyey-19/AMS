import React, { useState, useEffect } from 'react';
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

  // Auto-calculate rates if salary or hours change
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
        overtime_allowed: parseInt(formData.overtime_allowed, 10) || 1
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

  return (
    <div className="modal-backdrop">
      <div 
        className="modal-container"
        style={{
          maxWidth: '750px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div 
          style={{
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div 
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
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
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: '#f8fafc' }}>
                Edit Employee Master & Rules
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                Employee #{formData.employee_code} • {formData.employee_name}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#cbd5e1',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div 
          style={{
            display: 'flex',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            padding: '0.5rem 1rem 0'
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
                  padding: '0.65rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? '600' : '500',
                  color: isActive ? '#0284c7' : '#64748b',
                  background: isActive ? '#ffffff' : 'transparent',
                  border: 'none',
                  borderTopLeftRadius: '8px',
                  borderTopRightRadius: '8px',
                  borderBottom: isActive ? '2px solid #0284c7' : '2px solid transparent',
                  cursor: 'pointer',
                  marginBottom: '-1px'
                }}
              >
                <Icon size={16} />
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
              backgroundColor: '#fff1f2',
              border: '1px solid #fecdd3',
              color: '#9f1239',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem'
            }}
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div 
            style={{
              margin: '1rem 1.5rem 0',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem'
            }}
          >
            <CheckCircle2 size={18} />
            <span>{success}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div 
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
                <div 
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    color: '#64748b',
                    letterSpacing: '0.05em'
                  }}
                >
                  Standard Shift Schedule
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                      Standard In Time (24h)
                    </label>
                    <input 
                      type="text" 
                      name="standard_in_time"
                      value={formData.standard_in_time}
                      onChange={handleChange}
                      placeholder="e.g. 08:00 or 09:30"
                      className="form-control"
                      style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}
                    />
                    <small style={{ color: '#64748b', fontSize: '0.75rem' }}>Format: HH:MM (e.g. 08:00, 09:30)</small>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                      Standard Out Time (24h)
                    </label>
                    <input 
                      type="text" 
                      name="standard_out_time"
                      value={formData.standard_out_time}
                      onChange={handleChange}
                      placeholder="e.g. 20:00 or 14:00"
                      className="form-control"
                      style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}
                    />
                    <small style={{ color: '#64748b', fontSize: '0.75rem' }}>Format: HH:MM (e.g. 20:00, 18:00)</small>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                      Standard Daily Work Hours
                    </label>
                    <input 
                      type="number" 
                      step="0.1"
                      name="standard_work_hours"
                      value={formData.standard_work_hours}
                      onChange={handleChange}
                      placeholder="e.g. 12, 9, 8.5, 6, 4"
                      className="form-control"
                      style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}
                    />
                    <small style={{ color: '#64748b', fontSize: '0.75rem' }}>Expected working hours per working day</small>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                      Standard Break Time (Minutes)
                    </label>
                    <input 
                      type="number" 
                      name="standard_break_minutes"
                      value={formData.standard_break_minutes}
                      onChange={handleChange}
                      placeholder="e.g. 0, 30, 60, 120"
                      className="form-control"
                      style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}
                    />
                    <small style={{ color: '#64748b', fontSize: '0.75rem' }}>e.g. 0 min, 30 min, 60 min (1 hr), 120 min (2 hrs)</small>
                  </div>
                </div>

                <div 
                  style={{
                    padding: '0.85rem 1rem',
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '8px',
                    fontSize: '0.825rem',
                    color: '#0369a1',
                    lineHeight: '1.4'
                  }}
                >
                  💡 <strong>Dynamic Calculation Note:</strong> AMS uses these individual shift timings to calculate actual work hours, expected hours, deficit/surplus differences, late arrivals, and early departures dynamically for every day.
                </div>
              </div>
            )}

            {/* TAB 2: Salary & Rates */}
            {activeTab === 'salary' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span 
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      color: '#64748b',
                      letterSpacing: '0.05em'
                    }}
                  >
                    Salary Structure & Calculation Basis
                  </span>
                  <button
                    type="button"
                    onClick={handleAutoRateCalc}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      borderRadius: '6px',
                      background: '#e0f2fe',
                      color: '#0369a1',
                      border: '1px solid #bae6fd',
                      cursor: 'pointer'
                    }}
                  >
                    <Sparkles size={13} /> Auto-Compute Rates
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                      Base Monthly Salary (₹)
                    </label>
                    <input 
                      type="number" 
                      name="salary"
                      value={formData.salary}
                      onChange={handleChange}
                      placeholder="e.g. 12000, 22000, 35000"
                      className="form-control"
                      style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', fontWeight: '600', fontSize: '1rem', color: '#0f172a' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                      Payment Mode
                    </label>
                    <select
                      name="payment_mode"
                      value={formData.payment_mode}
                      onChange={handleChange}
                      className="form-control"
                      style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}
                    >
                      <option value="Bank">Bank Transfer</option>
                      <option value="Cheque">Cheque (CHQ)</option>
                      <option value="Cash">Cash</option>
                      <option value="TDS / Cheque">TDS / Cheque</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '0.825rem' }}>
                      Rate Type
                    </label>
                    <select
                      name="rate_type"
                      value={formData.rate_type}
                      onChange={handleChange}
                      className="form-control"
                      style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}
                    >
                      <option value="hourly">Hourly Rate Basis</option>
                      <option value="daily">Daily Rate Basis</option>
                      <option value="monthly_30">Monthly Divisor (30 Days)</option>
                      <option value="monthly_31">Monthly Divisor (31 Days)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '0.825rem' }}>
                      Hourly Rate (₹/hr)
                    </label>
                    <input 
                      type="number" 
                      step="0.01"
                      name="hourly_rate"
                      value={formData.hourly_rate}
                      onChange={handleChange}
                      placeholder="Auto if blank"
                      className="form-control"
                      style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '0.825rem' }}>
                      Daily Rate (₹/day)
                    </label>
                    <input 
                      type="number" 
                      step="0.01"
                      name="daily_rate"
                      value={formData.daily_rate}
                      onChange={handleChange}
                      placeholder="Auto if blank"
                      className="form-control"
                      style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Special Rules & Bond */}
            {activeTab === 'rules' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div 
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    color: '#64748b',
                    letterSpacing: '0.05em'
                  }}
                >
                  Late Tolerance, Overtime & Bond Conditions
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '0.825rem' }}>
                      Late Grace (Mins)
                    </label>
                    <input 
                      type="number" 
                      name="late_grace_minutes"
                      value={formData.late_grace_minutes}
                      onChange={handleChange}
                      placeholder="Default 11"
                      className="form-control"
                      style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '0.825rem' }}>
                      Late Multiplier
                    </label>
                    <input 
                      type="number" 
                      step="0.1"
                      name="late_deduction_multiplier"
                      value={formData.late_deduction_multiplier}
                      onChange={handleChange}
                      placeholder="e.g. 0.5, 1.0"
                      className="form-control"
                      style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '0.825rem' }}>
                      Overtime Multiplier
                    </label>
                    <input 
                      type="number" 
                      step="0.1"
                      name="overtime_multiplier"
                      value={formData.overtime_multiplier}
                      onChange={handleChange}
                      placeholder="e.g. 2.0, 1.5"
                      className="form-control"
                      style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}
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
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#0284c7' }}
                  />
                  <label htmlFor="overtime_allowed" style={{ fontSize: '0.875rem', fontWeight: '500', color: '#1e293b', cursor: 'pointer' }}>
                    Allow Overtime compensation for this employee
                  </label>
                </div>

                <div className="form-group" style={{ marginTop: '0.5rem' }}>
                  <label className="form-label" style={{ fontWeight: '600', fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Special Rules / Bond Terms / Remarks (Gujarati & English)</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>Maintained in individual Excel sheets</span>
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
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      width: '100%',
                      fontSize: '0.9rem',
                      lineHeight: '1.5',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>
            )}

            {/* TAB 4: Profile Details */}
            {activeTab === 'personal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div 
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    color: '#64748b',
                    letterSpacing: '0.05em'
                  }}
                >
                  Personal & Organizational Information
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                      Employee Full Name
                    </label>
                    <input 
                      type="text" 
                      name="employee_name"
                      value={formData.employee_name}
                      onChange={handleChange}
                      className="form-control"
                      style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                      Department
                    </label>
                    <input 
                      type="text" 
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      className="form-control"
                      style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '0.825rem' }}>
                      Designation
                    </label>
                    <input 
                      type="text" 
                      name="designation"
                      value={formData.designation}
                      onChange={handleChange}
                      className="form-control"
                      style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '0.825rem' }}>
                      Date of Joining (DOJ)
                    </label>
                    <input 
                      type="date" 
                      name="doj"
                      value={formData.doj}
                      onChange={handleChange}
                      className="form-control"
                      style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '0.825rem' }}>
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      className="form-control"
                      style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}
                    >
                      <option value="Working">Working / Active</option>
                      <option value="Resigned">Resigned</option>
                      <option value="Leave">On Extended Leave</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '0.825rem' }}>
                      Gender
                    </label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="form-control"
                      style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Not Specified">Not Specified</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '0.825rem' }}>
                      PAN / ID No
                    </label>
                    <input 
                      type="text" 
                      name="pan_no"
                      value={formData.pan_no}
                      onChange={handleChange}
                      className="form-control"
                      style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '0.825rem' }}>
                      Biometric Device / RFID
                    </label>
                    <input 
                      type="text" 
                      name="rfid"
                      value={formData.rfid}
                      onChange={handleChange}
                      className="form-control"
                      style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div 
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem'
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.65rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                borderRadius: '8px',
                background: '#ffffff',
                color: '#475569',
                border: '1px solid #cbd5e1',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.65rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
                color: '#ffffff',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 6px -1px rgba(14, 165, 233, 0.3)'
              }}
            >
              <Save size={16} />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
