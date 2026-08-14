import React, { useState, useRef } from 'react';
import { Modal } from '../common/Modal';
import { attendanceApi } from '../../services/api';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  FileText,
  Calendar
} from 'lucide-react';

export const AttendanceImportModal = ({ isOpen, onClose, onImportSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const sampleMonths = [
    { label: 'MD MAY.csv (Primary)', file: 'MD MAY.csv', highlight: true },
    { label: 'MD APRIL.csv', file: 'MD APRIL.csv' },
    { label: 'MD JUNE.csv', file: 'MD JUNE.csv' },
    { label: 'MD JULY.csv', file: 'MD JULY.csv' },
    { label: 'MD AUG.csv', file: 'MD AUG.csv' }
  ];

  const resetState = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setLoading(false);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      validateAndSetFile(dropped);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (f) => {
    const ext = f.name.split('.').pop().toLowerCase();
    if (['csv', 'xlsx', 'xls'].includes(ext)) {
      setFile(f);
      setError(null);
    } else {
      setError('Please select a valid CSV or Excel file (.csv, .xlsx, .xls)');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select an attendance file to upload.');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await attendanceApi.importFile(formData);
      setResult(res.data);
      if (onImportSuccess) onImportSuccess();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Attendance import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleImportSample = async (sampleFileName) => {
    setLoading(true);
    setError(null);
    try {
      const res = await attendanceApi.importSample(sampleFileName);
      setResult(res.data);
      if (onImportSuccess) onImportSuccess();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Sample import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        resetState();
        onClose();
      }}
      title="Import Attendance Records"
      size="md"
      footer={
        result ? (
          <button
            className="btn btn-primary"
            onClick={() => {
              resetState();
              onClose();
            }}
          >
            Done
          </button>
        ) : (
          <>
            <button
              className="btn btn-secondary"
              onClick={() => {
                resetState();
                onClose();
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={!file || loading}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-pulse" />
                  Importing Attendance...
                </>
              ) : (
                <>
                  <UploadCloud size={16} />
                  Import File
                </>
              )}
            </button>
          </>
        )
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {error && (
          <div className="auth-alert-error">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        {result ? (
          /* Import Result Report */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="animate-fade-in">
            <div
              style={{
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}
            >
              <CheckCircle2 size={32} color="#059669" />
              <div>
                <h4 style={{ color: '#065f46', fontWeight: '700', fontSize: '1rem' }}>
                  Attendance Import Completed!
                </h4>
                <p style={{ color: '#047857', fontSize: '0.8125rem' }}>
                  File: <strong>{result.filename}</strong> &bull; Deduplication: <strong>Employee ID + Date</strong>
                </p>
              </div>
            </div>

            <div className="detail-info-grid">
              <div className="detail-item">
                <span className="detail-item-label">Total Rows Processed</span>
                <span className="detail-item-value" style={{ color: '#0284c7' }}>{result.totalRows}</span>
              </div>
              <div className="detail-item">
                <span className="detail-item-label">New Shifts Inserted</span>
                <span className="detail-item-value" style={{ color: '#059669' }}>{result.inserted}</span>
              </div>
              <div className="detail-item">
                <span className="detail-item-label">Existing Shifts Updated</span>
                <span className="detail-item-value" style={{ color: '#0284c7' }}>{result.updated}</span>
              </div>
              <div className="detail-item">
                <span className="detail-item-label">Validation Errors</span>
                <span className="detail-item-value" style={{ color: result.errorCount > 0 ? '#e11d48' : '#64748b' }}>
                  {result.errorCount}
                </span>
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '0.875rem' }}>
                <strong style={{ color: '#9f1239', fontSize: '0.8125rem' }}>Import Warnings:</strong>
                <ul style={{ paddingLeft: '1.25rem', marginTop: '0.375rem', fontSize: '0.75rem', color: '#be123c' }}>
                  {result.errors.map((err, i) => (
                    <li key={i}>Row {err.row}: {err.error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          /* File Upload & Sample Loader */
          <>
            {/* Quick 1-Click Sample Monthly Loaders */}
            <div 
              style={{
                padding: '1rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                <Calendar size={18} color="#0284c7" />
                <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1e293b' }}>
                  Load Hospital Monthly Datasets
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {sampleMonths.map((item) => (
                  <button
                    key={item.file}
                    className={`btn btn-sm ${item.highlight ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleImportSample(item.file)}
                    disabled={loading}
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                  >
                    {loading ? 'Processing...' : item.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', fontWeight: '600' }}>
              &mdash; OR UPLOAD ATTENDANCE FILE &mdash;
            </div>

            {/* Drag & Drop Area */}
            <div
              className={`dropzone-box ${dragActive ? 'drag-over' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <div className="dropzone-icon">
                <FileSpreadsheet size={28} />
              </div>
              <div className="dropzone-text">
                <h4>{file ? file.name : 'Choose Attendance CSV / Excel or drag here'}</h4>
                <p>Specifically formatted with Employee Code, Attendance Date, In/Out Times, Status Code</p>
                {file && (
                  <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '0.75rem', color: '#0284c7', fontWeight: '600' }}>
                    Size: {(file.size / 1024).toFixed(1)} KB &bull; Click to change
                  </span>
                )}
              </div>
            </div>

            {/* Note on unique constraint */}
            <div style={{ fontSize: '0.75rem', color: '#64748b', backgroundColor: '#f1f5f9', padding: '0.625rem 0.875rem', borderRadius: '6px' }}>
              <strong>Deduplication Rule:</strong> Records with matching <code>Employee ID + Attendance Date</code> will be updated/overwritten with the newest data automatically.
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
