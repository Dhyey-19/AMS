import React, { useState, useRef } from 'react';
import { Modal } from '../common/Modal';
import { employeeApi } from '../../services/api';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, RefreshCw, FileText } from 'lucide-react';

export const MasterDataImportModal = ({ isOpen, onClose, onImportSuccess }) => {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('upsert'); // 'upsert' or 'skip'
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

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
      setError('Please select a file to import');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);

    try {
      const res = await employeeApi.importFile(formData);
      setResult(res.data);
      if (onImportSuccess) onImportSuccess();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleImportSample = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await employeeApi.importSample(mode);
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
      title="Import Employee Master Data"
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
                  Importing...
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
                  Import Completed Successfully!
                </h4>
                <p style={{ color: '#047857', fontSize: '0.8125rem' }}>
                  Source: <strong>{result.filename}</strong>
                </p>
              </div>
            </div>

            <div className="detail-info-grid">
              <div className="detail-item">
                <span className="detail-item-label">Total Rows in File</span>
                <span className="detail-item-value" style={{ color: '#0284c7' }}>{result.totalRows}</span>
              </div>
              <div className="detail-item">
                <span className="detail-item-label">New Records Inserted</span>
                <span className="detail-item-value" style={{ color: '#059669' }}>{result.inserted}</span>
              </div>
              <div className="detail-item">
                <span className="detail-item-label">Existing Records Updated</span>
                <span className="detail-item-value" style={{ color: '#0284c7' }}>{result.updated}</span>
              </div>
              <div className="detail-item">
                <span className="detail-item-label">Duplicates Skipped</span>
                <span className="detail-item-value" style={{ color: '#64748b' }}>{result.skipped}</span>
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '0.875rem' }}>
                <strong style={{ color: '#9f1239', fontSize: '0.8125rem' }}>Validation Warnings ({result.errors.length}):</strong>
                <ul style={{ paddingLeft: '1.25rem', marginTop: '0.375rem', fontSize: '0.75rem', color: '#be123c' }}>
                  {result.errors.map((err, i) => (
                    <li key={i}>Row {err.row}: {err.error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          /* File Upload & Mode Selector */
          <>
            {/* Quick Sample Button */}
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.875rem 1rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileText size={20} color="#0284c7" />
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' }}>
                    Use Hospital Master Data
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Load default <code>MD MASTER.csv</code> directly
                  </div>
                </div>
              </div>
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={handleImportSample}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Load Sample File'}
              </button>
            </div>

            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', fontWeight: '600' }}>
              &mdash; OR UPLOAD CUSTOM FILE &mdash;
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
                <h4>{file ? file.name : 'Choose a file or drag it here'}</h4>
                <p>Supports CSV (.csv) or Excel spreadsheets (.xlsx, .xls)</p>
                {file && (
                  <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '0.75rem', color: '#0284c7', fontWeight: '600' }}>
                    Size: {(file.size / 1024).toFixed(1)} KB &bull; Click to change
                  </span>
                )}
              </div>
            </div>

            {/* Deduplication Settings */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Duplicate Handling Strategy</label>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.375rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="importMode"
                    value="upsert"
                    checked={mode === 'upsert'}
                    onChange={() => setMode('upsert')}
                  />
                  <span><strong>Update Existing</strong> (Recommended: refresh fields on duplicate EmployeeCode)</span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.375rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="importMode"
                    value="skip"
                    checked={mode === 'skip'}
                    onChange={() => setMode('skip')}
                  />
                  <span><strong>Skip Duplicates</strong> (Keep existing database records intact)</span>
                </label>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
