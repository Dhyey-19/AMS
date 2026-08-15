import React, { useState, useRef } from 'react';
import { Modal } from '../common/Modal';
import { employeeApi } from '../../services/api';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, RefreshCw, Layers, Users } from 'lucide-react';

export const MasterDataImportModal = ({ isOpen, onClose, onImportSuccess }) => {
  const [file, setFile] = useState(null);
  const [importType, setImportType] = useState('master'); // 'master' or 'workbook'
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
    if (importType === 'workbook' && !['xlsx', 'xls'].includes(ext)) {
      setError('Multi-sheet workbooks must be an Excel file (.xlsx, .xls)');
      return;
    }
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
      let res;
      if (importType === 'workbook') {
        res = await employeeApi.importWorkbook(formData);
      } else {
        res = await employeeApi.importFile(formData);
      }
      setResult({ ...res.data, importType });
      if (onImportSuccess) onImportSuccess();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Import failed');
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
      title={importType === 'workbook' ? 'Import Multi-Sheet Monthly Workbook' : 'Import Employee Master Data'}
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
                  Processing File...
                </>
              ) : (
                <>
                  <UploadCloud size={16} />
                  Upload & Import
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
                  File Processed Successfully!
                </h4>
                <p style={{ color: '#047857', fontSize: '0.8125rem' }}>
                  Uploaded: <strong>{result.filename}</strong>
                </p>
              </div>
            </div>

            {result.importType === 'workbook' ? (
              <div className="detail-info-grid">
                <div className="detail-item">
                  <span className="detail-item-label">Employee Sheets Synced</span>
                  <span className="detail-item-value" style={{ color: '#0284c7' }}>{result.totalSheets || result.employeesUpserted}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-item-label">Profiles Created / Updated</span>
                  <span className="detail-item-value" style={{ color: '#059669' }}>{result.employeesUpserted}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-item-label">New Shifts Created</span>
                  <span className="detail-item-value" style={{ color: '#059669' }}>{result.attendanceInserted}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-item-label">Existing Shifts Updated</span>
                  <span className="detail-item-value" style={{ color: '#0284c7' }}>{result.attendanceUpdated}</span>
                </div>
              </div>
            ) : (
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
            )}

            {result.errors && result.errors.length > 0 && (
              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '0.875rem' }}>
                <strong style={{ color: '#9f1239', fontSize: '0.8125rem' }}>Validation Warnings ({result.errors.length}):</strong>
                <ul style={{ paddingLeft: '1.25rem', marginTop: '0.375rem', fontSize: '0.75rem', color: '#be123c' }}>
                  {result.errors.map((err, i) => (
                    <li key={i}>{err.sheet ? `Sheet ${err.sheet}: ` : `Row ${err.row}: `}{err.error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          /* File Upload & Mode Selector */
          <>
            {/* Import Format Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div
                onClick={() => { setImportType('master'); setFile(null); }}
                style={{
                  border: `2px solid ${importType === 'master' ? 'var(--primary-600)' : '#e2e8f0'}`,
                  backgroundColor: importType === 'master' ? 'var(--primary-50)' : '#ffffff',
                  borderRadius: '10px',
                  padding: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <Users size={20} color={importType === 'master' ? 'var(--primary-600)' : '#64748b'} style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.875rem', color: importType === 'master' ? 'var(--primary-900)' : '#1e293b' }}>
                    Master Data (List)
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                    Standard CSV or Excel list of employees & salaries
                  </div>
                </div>
              </div>

              <div
                onClick={() => { setImportType('workbook'); setFile(null); }}
                style={{
                  border: `2px solid ${importType === 'workbook' ? 'var(--primary-600)' : '#e2e8f0'}`,
                  backgroundColor: importType === 'workbook' ? 'var(--primary-50)' : '#ffffff',
                  borderRadius: '10px',
                  padding: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <Layers size={20} color={importType === 'workbook' ? 'var(--primary-600)' : '#64748b'} style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.875rem', color: importType === 'workbook' ? 'var(--primary-900)' : '#1e293b' }}>
                    Monthly Workbook
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                    Multi-sheet .xlsx with individual employee sheets
                  </div>
                </div>
              </div>
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
                accept={importType === 'workbook' ? '.xlsx, .xls' : '.csv, .xlsx, .xls'}
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <div className="dropzone-icon">
                <FileSpreadsheet size={28} />
              </div>
              <div className="dropzone-text">
                <h4>{file ? file.name : importType === 'workbook' ? 'Choose Monthly Workbook (.xlsx) or drag here' : 'Choose Master Data File (.csv, .xlsx) or drag here'}</h4>
                <p>{importType === 'workbook' ? 'Supports Excel workbooks with individual employee sheets' : 'Supports CSV (.csv) or Excel spreadsheets (.xlsx, .xls)'}</p>
                {file && (
                  <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '0.75rem', color: '#0284c7', fontWeight: '600' }}>
                    Size: {(file.size / 1024).toFixed(1)} KB &bull; Click to change
                  </span>
                )}
              </div>
            </div>

            {/* Deduplication Settings for Master Data */}
            {importType === 'master' && (
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
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
