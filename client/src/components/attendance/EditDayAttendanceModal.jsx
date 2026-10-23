import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Save,
  Clock,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  FileText,
  User,
  Coffee,
  HelpCircle
} from 'lucide-react';
import { attendanceApi } from '../../services/api';
import { calculateDayRule } from '../../utils/attendanceCalculator';

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

export const EditDayAttendanceModal = ({
  isOpen,
  onClose,
  record,
  employee,
  onUpdated
}) => {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const daysInMonth = React.useMemo(() => {
    if (record?.attendance_date_iso) {
      const parts = record.attendance_date_iso.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(y) && !isNaN(m)) return new Date(y, m, 0).getDate();
    }
    return 30;
  }, [record]);

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
    if (record) {
      setFormData({
        is_manual: record.is_manual === 1 || record.is_manual === true || record.is_manual === '1',
        status_code: record.status_code || 'P',
        calc_mode: record.calc_mode || 'Normal',
        scheduled_in_time: formatTimeToHHMM(record.scheduled_in_time || employee?.standard_in_time || '08:00'),
        scheduled_out_time: formatTimeToHHMM(record.scheduled_out_time || employee?.standard_out_time || '20:00'),
        scheduled_duration_formatted: record.scheduled_duration_formatted || '12:00',
        scheduled_break_formatted: record.scheduled_break_formatted || '00:00',
        scheduled_work_formatted: record.scheduled_work_formatted || '12:00',
        in_time: formatTimeToHHMM(record.actual_in_time || record.in_time || ''),
        out_time: formatTimeToHHMM(record.actual_out_time || record.out_time || ''),
        actual_duration_formatted: record.actual_duration_formatted || record.total_duration || '00:00',
        break_out: formatTimeToHHMM(record.break_out || ''),
        break_in: formatTimeToHHMM(record.break_in || ''),
        effective_break_formatted: record.effective_break_formatted || '00:00',
        actual_work_formatted: record.actual_work_formatted || '00:00',
        work_diff_formatted: record.work_diff_formatted || '00:00',
        late_formatted: record.late_formatted || '00:00',
        overtime_formatted: record.overtime_formatted || '00:00',
        hourly_rate: record.hourly_rate !== undefined && record.hourly_rate !== null ? record.hourly_rate : '',
        daily_salary_earned: record.daily_salary_earned !== undefined && record.daily_salary_earned !== null ? record.daily_salary_earned : '',
        late_salary_deduction: record.late_salary_deduction !== undefined && record.late_salary_deduction !== null ? record.late_salary_deduction : 0,
        overtime_pay: record.overtime_pay !== undefined && record.overtime_pay !== null ? record.overtime_pay : 0,
        leave_deduction: record.leave_deduction || 0,
        penalty_amount: record.penalty_amount || 0,
        overtime_override_minutes: record.overtime_override_minutes || 0,
        net_daily_salary: record.net_daily_salary !== undefined && record.net_daily_salary !== null ? record.net_daily_salary : '',
        punch_records: record.punch_records || '',
        remarks: record.remarks || ''
      });
      setError(null);
      setSuccess(null);
    }
  }, [record, employee]);

  if (!isOpen || !record) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newVal = type === 'checkbox' ? checked : value;
    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: newVal
      };
      if (name === 'is_manual') {
        if (newVal) {
          return calculateDayRule(updated, employee, daysInMonth, null);
        }
        return updated;
      }
      if (updated.is_manual) {
        return calculateDayRule(updated, employee, daysInMonth, name);
      }
      return updated;
    });
  };

  const handleStatusChange = (newStatus) => {
    setFormData((prev) => {
      const updated = {
        ...prev,
        status_code: newStatus
      };
      if (updated.is_manual) {
        return calculateDayRule(updated, employee, daysInMonth, 'status_code');
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const isManual = !!formData.is_manual;
      let payload;

      if (isManual) {
        payload = {
          is_manual: 1,
          status_code: (formData.status_code || 'P').toUpperCase().trim(),
          calc_mode: formData.calc_mode || 'Manual',
          scheduled_in_time: formData.scheduled_in_time || '',
          scheduled_out_time: formData.scheduled_out_time || '',
          scheduled_duration_formatted: formData.scheduled_duration_formatted || '',
          scheduled_break_formatted: formData.scheduled_break_formatted || '',
          scheduled_work_formatted: formData.scheduled_work_formatted || '',
          in_time: formData.in_time ? formData.in_time.trim() : '',
          out_time: formData.out_time ? formData.out_time.trim() : '',
          actual_duration_formatted: formData.actual_duration_formatted || '',
          break_out: formData.break_out ? formData.break_out.trim() : '',
          break_in: formData.break_in ? formData.break_in.trim() : '',
          effective_break_formatted: formData.effective_break_formatted || '',
          actual_work_formatted: formData.actual_work_formatted || '',
          work_diff_formatted: formData.work_diff_formatted || '',
          late_formatted: formData.late_formatted || '',
          overtime_formatted: formData.overtime_formatted || '',
          hourly_rate: formData.hourly_rate !== '' ? parseFloat(formData.hourly_rate) : undefined,
          daily_salary_earned: formData.daily_salary_earned !== '' ? parseFloat(formData.daily_salary_earned) : undefined,
          late_salary_deduction: formData.late_salary_deduction !== '' ? parseFloat(formData.late_salary_deduction) : 0,
          overtime_pay: formData.overtime_pay !== '' ? parseFloat(formData.overtime_pay) : 0,
          leave_deduction: parseFloat(formData.leave_deduction) || 0,
          penalty_amount: parseFloat(formData.penalty_amount) || 0,
          overtime_override_minutes: parseInt(formData.overtime_override_minutes, 10) || 0,
          net_daily_salary: formData.net_daily_salary !== '' ? parseFloat(formData.net_daily_salary) : undefined,
          remarks: formData.remarks ? formData.remarks.trim() : ''
        };
      } else {
        payload = {
          is_manual: 0,
          status_code: formData.status_code.toUpperCase().trim(),
          in_time: formData.in_time ? formData.in_time.trim() : '',
          out_time: formData.out_time ? formData.out_time.trim() : '',
          break_out: formData.break_out ? formData.break_out.trim() : '',
          break_in: formData.break_in ? formData.break_in.trim() : '',
          leave_deduction: parseFloat(formData.leave_deduction) || 0,
          penalty_amount: parseFloat(formData.penalty_amount) || 0,
          overtime_override_minutes: parseInt(formData.overtime_override_minutes, 10) || 0,
          remarks: formData.remarks ? formData.remarks.trim() : ''
        };
      }

      const dateIso = record.attendance_date_iso;
      const code = employee?.employee_code || record.employee_code;

      const res = await attendanceApi.updateRecord(code, dateIso, payload);
      setSuccess(isManual ? 'Manual record saved with rule calculations applied!' : 'Record updated in database! Recalculating sheet...');
      
      if (onUpdated) {
        await onUpdated(res.data);
      }
      setTimeout(() => {
        onClose();
      }, 400);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update record');
    } finally {
      setLoading(false);
    }
  };

  const modalElement = (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="modal-dialog modal-md" 
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', maxWidth: formData.is_manual ? '780px' : '620px', width: '100%', transition: 'max-width 0.2s ease' }}
      >
        {/* Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div 
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--primary-600) 0%, var(--primary-700) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}
            >
              <Calendar size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '700', color: 'var(--slate-900)' }}>
                Edit Attendance Record
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--slate-500)' }}>
                {record.attendance_date_iso} ({record.attendance_date || ''}) • #{employee?.employee_code} {employee?.employee_name}
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

        {/* Form Body */}
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
            {/* Manual Mode Toggle Header Card */}
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                backgroundColor: formData.is_manual ? '#fffbeb' : '#f8fafc',
                border: formData.is_manual ? '1.5px solid #f59e0b' : '1px solid var(--border-color)',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input 
                  type="checkbox"
                  id="modal_is_manual_toggle"
                  name="is_manual"
                  checked={!!formData.is_manual}
                  onChange={handleChange}
                  style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#d97706' }}
                />
                <label htmlFor="modal_is_manual_toggle" style={{ cursor: 'pointer', margin: 0 }}>
                  <div style={{ fontWeight: '700', fontSize: '0.925rem', color: formData.is_manual ? '#b45309' : 'var(--slate-800)' }}>
                    Manual Record Mode (Rule Calculated & Fully Editable)
                  </div>
                  <div style={{ fontSize: '0.75rem', color: formData.is_manual ? '#92400e' : 'var(--slate-500)' }}>
                    {formData.is_manual 
                      ? '⚡ Active: All columns unlocked for editing. Dynamic rule calculations run in real-time as you type!' 
                      : 'Tick to unlock all columns for manual editing while calculating rules dynamically.'}
                  </div>
                </label>
              </div>
              <span 
                className={`badge ${formData.is_manual ? 'badge-warning' : 'badge-secondary'}`}
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', fontWeight: '700' }}
              >
                {formData.is_manual ? '✏️ MANUAL ACTIVE' : '⚙️ AUTO RULES'}
              </span>
            </div>

            {/* Quick Status Presets & Status Code */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ margin: 0 }}>Attendance Status (P/A)</label>
                {formData.is_manual && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Status Code:</span>
                    <input 
                      type="text"
                      name="status_code"
                      value={formData.status_code || ''}
                      onChange={handleChange}
                      placeholder="P / A / WO"
                      style={{ width: '80px', padding: '0.2rem 0.4rem', fontSize: '0.8rem', fontWeight: '700', textAlign: 'center' }}
                      className="form-control"
                    />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[
                  { code: 'P', label: 'Present (P)', color: 'var(--success-bg)', text: 'var(--success-text)', border: 'var(--success-border)' },
                  { code: 'A', label: 'Absent (A)', color: 'var(--danger-bg)', text: 'var(--danger-text)', border: 'var(--danger-border)' },
                  { code: 'WO', label: 'Weekly Off (WO)', color: 'var(--info-bg)', text: 'var(--info-text)', border: 'var(--info-border)' },
                  { code: 'WOP', label: 'WO Present (WOP)', color: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
                  { code: 'HD', label: 'Half Day (HD)', color: 'var(--warning-bg)', text: 'var(--warning-text)', border: 'var(--warning-border)' },
                  { code: 'L', label: 'Leave (L)', color: 'var(--slate-100)', text: 'var(--slate-700)', border: 'var(--slate-300)' }
                ].map((s) => {
                  const isSelected = formData.status_code === s.code;
                  return (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => handleStatusChange(s.code)}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.8125rem',
                        fontWeight: isSelected ? '700' : '500',
                        backgroundColor: isSelected ? s.color : '#ffffff',
                        color: isSelected ? s.text : 'var(--slate-600)',
                        border: isSelected ? `2px solid ${s.text}` : '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* In / Out Timings */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  <Clock size={13} style={{ display: 'inline', marginRight: '4px' }} />
                  Actual In Time (HH:MM)
                </label>
                <input 
                  type="time" 
                  name="in_time"
                  value={formData.in_time || ''}
                  onChange={handleChange}
                  className="form-control"
                />
                <small style={{ color: 'var(--slate-400)', fontSize: '0.725rem' }}>Scheduled: {formData.scheduled_in_time || employee?.standard_in_time || '08:00'}</small>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  <Clock size={13} style={{ display: 'inline', marginRight: '4px' }} />
                  Actual Out Time (HH:MM)
                </label>
                <input 
                  type="time" 
                  name="out_time"
                  value={formData.out_time || ''}
                  onChange={handleChange}
                  className="form-control"
                />
                <small style={{ color: 'var(--slate-400)', fontSize: '0.725rem' }}>Scheduled: {formData.scheduled_out_time || employee?.standard_out_time || '20:00'}</small>
              </div>
            </div>

            {/* Break Punches */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  <Coffee size={13} style={{ display: 'inline', marginRight: '4px' }} />
                  Break Out Time (HH:MM)
                </label>
                <input 
                  type="time" 
                  name="break_out"
                  value={formData.break_out || ''}
                  onChange={handleChange}
                  className="form-control"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  <Coffee size={13} style={{ display: 'inline', marginRight: '4px' }} />
                  Break In Time (HH:MM)
                </label>
                <input 
                  type="time" 
                  name="break_in"
                  value={formData.break_in || ''}
                  onChange={handleChange}
                  className="form-control"
                />
              </div>
            </div>

            {/* If Manual Mode is ON: Expose All Additional Fields */}
            {formData.is_manual && (
              <>
                {/* Scheduled Shift Overrides */}
                <div style={{ padding: '0.85rem', background: 'var(--slate-50)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--slate-700)', marginBottom: '0.65rem' }}>
                    📅 Scheduled Shift Fields (Manual Edit)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.65rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.725rem' }}>Sched In</label>
                      <input 
                        type="text" 
                        name="scheduled_in_time"
                        value={formData.scheduled_in_time || ''}
                        onChange={handleChange}
                        placeholder="08:00"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.725rem' }}>Sched Out</label>
                      <input 
                        type="text" 
                        name="scheduled_out_time"
                        value={formData.scheduled_out_time || ''}
                        onChange={handleChange}
                        placeholder="20:00"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.725rem' }}>Target (HH:MM)</label>
                      <input 
                        type="text" 
                        name="scheduled_duration_formatted"
                        value={formData.scheduled_duration_formatted || ''}
                        onChange={handleChange}
                        placeholder="12:00"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.725rem' }}>Std Break</label>
                      <input 
                        type="text" 
                        name="scheduled_break_formatted"
                        value={formData.scheduled_break_formatted || ''}
                        onChange={handleChange}
                        placeholder="00:00"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.725rem' }}>Work Time</label>
                      <input 
                        type="text" 
                        name="scheduled_work_formatted"
                        value={formData.scheduled_work_formatted || ''}
                        onChange={handleChange}
                        placeholder="12:00"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Timing Deviations & Calculations Overrides */}
                <div style={{ padding: '0.85rem', background: 'var(--slate-50)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--slate-700)', marginBottom: '0.65rem' }}>
                    ⏱️ Work & Duration Fields (Auto-Calculated as per rules — Fully Editable)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.65rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.725rem' }}>Calc Mode</label>
                      <input 
                        type="text" 
                        name="calc_mode"
                        value={formData.calc_mode || ''}
                        onChange={handleChange}
                        placeholder="Normal"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.725rem' }}>Duration</label>
                      <input 
                        type="text" 
                        name="actual_duration_formatted"
                        value={formData.actual_duration_formatted || ''}
                        onChange={handleChange}
                        placeholder="12:00"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.725rem' }}>Eff. Break</label>
                      <input 
                        type="text" 
                        name="effective_break_formatted"
                        value={formData.effective_break_formatted || ''}
                        onChange={handleChange}
                        placeholder="00:00"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.725rem' }}>Actual Work</label>
                      <input 
                        type="text" 
                        name="actual_work_formatted"
                        value={formData.actual_work_formatted || ''}
                        onChange={handleChange}
                        placeholder="12:00"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', fontWeight: '700' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.725rem' }}>Diff (+/-)</label>
                      <input 
                        type="text" 
                        name="work_diff_formatted"
                        value={formData.work_diff_formatted || ''}
                        onChange={handleChange}
                        placeholder="+00:00"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.725rem' }}>Late By</label>
                      <input 
                        type="text" 
                        name="late_formatted"
                        value={formData.late_formatted || ''}
                        onChange={handleChange}
                        placeholder="00:00"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.725rem' }}>Overtime</label>
                      <input 
                        type="text" 
                        name="overtime_formatted"
                        value={formData.overtime_formatted || ''}
                        onChange={handleChange}
                        placeholder="00:00"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Direct Salary & Financials Overrides (No rules!) */}
                <div style={{ padding: '0.85rem', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#047857' }}>
                      💰 Salary & Pay Details (Auto-Calculated as per rules — Fully Editable)
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const sal = parseFloat(formData.daily_salary_earned) || 0;
                        const late = parseFloat(formData.late_salary_deduction) || 0;
                        const ot = parseFloat(formData.overtime_pay) || 0;
                        const leave = parseFloat(formData.leave_deduction) || 0;
                        const pen = parseFloat(formData.penalty_amount) || 0;
                        const computed = Math.max(0, sal - late + ot - leave - pen);
                        setFormData(prev => ({ ...prev, net_daily_salary: Number(computed.toFixed(2)) }));
                      }}
                      className="btn btn-sm btn-outline-success"
                      style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem' }}
                      title="Quick Auto-Sum Net = Salary - Late + OT - Leave - Penalty"
                    >
                      Auto-Sum Net Salary
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.65rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.725rem' }}>Rate (₹/hr)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        name="hourly_rate"
                        value={formData.hourly_rate ?? ''}
                        onChange={handleChange}
                        placeholder="83.33"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.725rem' }}>Daily Salary (₹)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        name="daily_salary_earned"
                        value={formData.daily_salary_earned ?? ''}
                        onChange={handleChange}
                        placeholder="1000.00"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', fontWeight: '600' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.725rem', color: 'var(--danger-text)' }}>Late Ded (₹)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        name="late_salary_deduction"
                        value={formData.late_salary_deduction ?? ''}
                        onChange={handleChange}
                        placeholder="0.00"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', color: 'var(--danger-text)' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.725rem', color: 'var(--success-text)' }}>OT Pay (₹)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        name="overtime_pay"
                        value={formData.overtime_pay ?? ''}
                        onChange={handleChange}
                        placeholder="0.00"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', color: 'var(--success-text)' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.725rem' }}>Leave Ded (₹)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        name="leave_deduction"
                        value={formData.leave_deduction ?? ''}
                        onChange={handleChange}
                        placeholder="0.00"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.725rem' }}>Penalty (₹)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        name="penalty_amount"
                        value={formData.penalty_amount ?? ''}
                        onChange={handleChange}
                        placeholder="0.00"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.725rem', fontWeight: '700', color: 'var(--primary-700)' }}>Net Daily Salary (₹)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        name="net_daily_salary"
                        value={formData.net_daily_salary ?? ''}
                        onChange={handleChange}
                        placeholder="1000.00"
                        className="form-control"
                        style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem', fontWeight: '800', color: 'var(--primary-700)', background: '#ffffff', border: '2px solid var(--primary-500)' }}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Standard Financial Adjustments & Overtime Override (if auto mode) */}
            {!formData.is_manual && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" title="Manual Overtime in minutes">OT Override (Mins)</label>
                  <input 
                    type="number" 
                    name="overtime_override_minutes"
                    value={formData.overtime_override_minutes || ''}
                    onChange={handleChange}
                    placeholder="0"
                    className="form-control"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Leave Ded (₹)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    name="leave_deduction"
                    value={formData.leave_deduction || ''}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="form-control"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Penalty (₹)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    name="penalty_amount"
                    value={formData.penalty_amount || ''}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="form-control"
                  />
                </div>
              </div>
            )}

            {/* Remarks / Reason */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Remarks / Adjustment Reason</label>
              <textarea 
                name="remarks"
                value={formData.remarks || ''}
                onChange={handleChange}
                rows={2}
                placeholder="e.g. Manual data entry, verified by admin..."
                className="form-control"
                style={{ resize: 'vertical' }}
              />
            </div>

            {formData.is_manual ? (
              <div 
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  color: '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Sparkles size={16} color="#d97706" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Manual Type & Save Mode:</strong> Saving will store these exact typed values in the database. No formulas, timing rules, or salary calculations will alter what you typed.
                </span>
              </div>
            ) : (
              <div 
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--primary-50)',
                  border: '1px solid var(--primary-200)',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  color: 'var(--primary-800)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Sparkles size={16} color="var(--primary-600)" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Dynamic Recalculation:</strong> Saving will immediately update this record in SQLite and recompute all duration cases, late deductions, break adjustments, and monthly salary on the fly.
                </span>
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
              className={`btn ${formData.is_manual ? 'btn-warning' : 'btn-primary'}`}
              style={formData.is_manual ? { backgroundColor: '#d97706', borderColor: '#b45309', color: '#ffffff', fontWeight: '700' } : {}}
            >
              <Save size={16} />
              {loading ? 'Saving...' : (formData.is_manual ? 'Save Manual Record' : 'Save to Database')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalElement, document.body);
};
