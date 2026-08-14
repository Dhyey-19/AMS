import React from 'react';
import { Modal } from '../common/Modal';
import { StatusBadge, DepartmentBadge } from '../common/Badge';
import { User, Briefcase, Calendar, Shield, CreditCard, Building } from 'lucide-react';

export const EmployeeDetailsModal = ({ isOpen, onClose, employee }) => {
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
      title={`Employee Profile - ${employee.employee_name}`}
      size="lg"
      footer={
        <button className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
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
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}>
                {employee.employee_name}
              </h3>
              <StatusBadge status={employee.status} />
            </div>
            <div style={{ fontSize: '0.875rem', color: '#0369a1', fontWeight: '600', marginTop: '0.25rem' }}>
              {employee.designation || 'Staff Member'} &bull; {employee.department || 'Hospital Department'}
            </div>
          </div>
        </div>

        {/* Section 1: Employment Details */}
        <div>
          <h4 style={{ fontSize: '0.9375rem', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Briefcase size={16} color="#0284c7" />
            Hospital & Designation Information
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
              <span className="detail-item-label">Hospital / Company</span>
              <span className="detail-item-value">{employee.company || 'Global Ivf Hospital'}</span>
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
              <span className="detail-item-label">Location</span>
              <span className="detail-item-value">{employee.location || 'Default'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Category</span>
              <span className="detail-item-value">{employee.category || 'DefaultCategory'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Employment Type</span>
              <span className="detail-item-value">{employee.employment_type || 'Regular'}</span>
            </div>
          </div>
        </div>

        {/* Section 2: Important Dates & Status */}
        <div>
          <h4 style={{ fontSize: '0.9375rem', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Calendar size={16} color="#059669" />
            Dates & Lifecycle
          </h4>
          <div className="detail-info-grid">
            <div className="detail-item">
              <span className="detail-item-label">Date of Joining (DOJ)</span>
              <span className="detail-item-value">{formatDate(employee.doj)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Date of Confirmation (DOC)</span>
              <span className="detail-item-value">{formatDate(employee.doc)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Date of Birth (DOB)</span>
              <span className="detail-item-value">{formatDate(employee.dob)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Date of Relieving / Resignation (DOR)</span>
              <span className="detail-item-value">{formatDate(employee.dor)}</span>
            </div>
          </div>
        </div>

        {/* Section 3: Identification & Statutory Details */}
        <div>
          <h4 style={{ fontSize: '0.9375rem', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <CreditCard size={16} color="#7c3aed" />
            Identification & Statutory Records
          </h4>
          <div className="detail-info-grid">
            <div className="detail-item">
              <span className="detail-item-label">Gender</span>
              <span className="detail-item-value">{employee.gender || 'Not Specified'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">RFID Card No</span>
              <span className="detail-item-value">{employee.rfid || 'Not Assigned'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">UID / Aadhaar No</span>
              <span className="detail-item-value">{employee.uid_no || 'Not Provided'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">PAN Card No</span>
              <span className="detail-item-value">{employee.pan_no || 'Not Provided'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Voter ID No</span>
              <span className="detail-item-value">{employee.voter_id_no || 'Not Provided'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item-label">Shift Group Code</span>
              <span className="detail-item-value">{employee.shift_group_code || 'General Shift'}</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
