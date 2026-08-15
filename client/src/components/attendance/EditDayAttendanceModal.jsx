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
        status_code: record.status_code || 'P',
        in_time: record.actual_in_time || record.in_time || '',
        out_time: record.actual_out_time || record.out_time || '',
        break_out: record.break_out || '',
        break_in: record.break_in || '',
        leave_deduction: record.leave_deduction || 0,
        penalty_amount: record.penalty_amount || 0,
        overtime_override_minutes: record.overtime_override_minutes || 0,
        punch_records: record.punch_records || '',
        remarks: record.remarks || ''
      });
      setError(null);
      setSuccess(null);
    }
  }, [record]);

  if (!isOpen || !record) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleStatusChange = (newStatus) => {
    setFormData((prev) => ({
      ...prev,
      status_code: newStatus
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        status_code: formData.status_code.toUpperCase().trim(),
        in_time: formData.in_time ? formData.in_time.trim() : '',
        out_time: formData.out_time ? formData.out_time.trim() : '',
        break_out: formData.break_out ? formData.break_out.trim() : '',
        break_in: formData.break_in ? formData.break_in.trim() : '',
        leave_deduction: parseFloat(formData.leave_deduction) || 0,
        penalty_amount: parseFloat(formData.penalty_amount) || 0,
        overtime_override_minutes: parseInt(formData.overtime_override_minutes, 10) || 0,
        punch_records: formData.punch_records ? formData.punch_records.trim() : '',
        remarks: formData.remarks ? formData.remarks.trim() : ''
      };

      const dateIso = record.attendance_date_iso;
      const code = employee?.employee_code || record.employee_code;

      const res = await attendanceApi.updateRecord(code, dateIso, payload);
      setSuccess('Record updated in database! Recalculating sheet...');
      
      if (onUpdated) {
        setTimeout(() => {
          onUpdated(res.data);
          onClose();
        }, 500);
      }
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
        style={{ display: 'flex', flexDirection: 'column', maxWidth: '600px' }}
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
            {/* Quick Status Presets */}
            <div>
              <label className="form-label" style={{ marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>Attendance Status</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>Select Status</span>
              </label>
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
                  Actual In Time (24h)
                </label>
                <input 
                  type="text" 
                  name="in_time"
                  value={formData.in_time || ''}
                  onChange={handleChange}
                  placeholder="e.g. 08:05 or 09:20"
                  className="form-control"
                />
                <small style={{ color: 'var(--slate-400)', fontSize: '0.725rem' }}>Scheduled: {employee?.standard_in_time || '08:00'}</small>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  <Clock size={13} style={{ display: 'inline', marginRight: '4px' }} />
                  Actual Out Time (24h)
                </label>
                <input 
                  type="text" 
                  name="out_time"
                  value={formData.out_time || ''}
                  onChange={handleChange}
                  placeholder="e.g. 20:05 or 19:24"
                  className="form-control"
                />
                <small style={{ color: 'var(--slate-400)', fontSize: '0.725rem' }}>Scheduled: {employee?.standard_out_time || '20:00'}</small>
              </div>
            </div>

            {/* Break Punches */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  <Coffee size={13} style={{ display: 'inline', marginRight: '4px' }} />
                  Break Out Time (24h)
                </label>
                <input 
                  type="text" 
                  name="break_out"
                  value={formData.break_out || ''}
                  onChange={handleChange}
                  placeholder="e.g. 13:00"
                  className="form-control"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  <Coffee size={13} style={{ display: 'inline', marginRight: '4px' }} />
                  Break In Time (24h)
                </label>
                <input 
                  type="text" 
                  name="break_in"
                  value={formData.break_in || ''}
                  onChange={handleChange}
                  placeholder="e.g. 14:00 or 13:45"
                  className="form-control"
                />
              </div>
            </div>

            {/* Financial Adjustments & Overtime Override */}
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

            {/* Remarks / Reason */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Remarks / Adjustment Reason</label>
              <textarea 
                name="remarks"
                value={formData.remarks || ''}
                onChange={handleChange}
                rows={2}
                placeholder="e.g. Punch missed, verified by supervisor, shift adjusted..."
                className="form-control"
                style={{ resize: 'vertical' }}
              />
            </div>

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
              {loading ? 'Saving...' : 'Save to Database'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalElement, document.body);
};
