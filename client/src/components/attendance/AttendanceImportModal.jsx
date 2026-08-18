import React, { useState, useRef, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { attendanceApi } from '../../services/api';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Trash2,
  Table,
  Layers,
  Info,
  Check
} from 'lucide-react';

export const AttendanceImportModal = ({ isOpen, onClose, onImportSuccess }) => {
  // Step state: 'upload' | 'mapping' | 'result'
  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);

  // File structure info from server
  const [sheetNames, setSheetNames] = useState(['Sheet1']);
  const [selectedSheet, setSelectedSheet] = useState('Sheet1');
  const [headers, setHeaders] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [fieldDefinitions, setFieldDefinitions] = useState([]);
  const [mapping, setMapping] = useState({});
  const [autoMatchedCount, setAutoMatchedCount] = useState(0);

  // Final Import Result
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setResult(null);
    setError(null);
    setLoading(false);
    setParsing(false);
    setSheetNames(['Sheet1']);
    setSelectedSheet('Sheet1');
    setHeaders([]);
    setPreviewRows([]);
    setTotalRows(0);
    setFieldDefinitions([]);
    setMapping({});
    setAutoMatchedCount(0);
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
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = async (f, sheet = null) => {
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setError('Please select a valid CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }

    setFile(f);
    setError(null);
    setParsing(true);

    const formData = new FormData();
    formData.append('file', f);
    if (sheet) {
      formData.append('sheetName', sheet);
    }

    try {
      const res = await attendanceApi.parseHeaders(formData);
      const data = res.data;

      const detectedSheets = data.sheetNames || ['Sheet1'];
      const activeSheet = sheet || data.activeSheet || detectedSheets[0] || 'Sheet1';
      const detectedHeaders = data.headers || [];
      const suggested = data.suggestedMapping || {};
      const defs = data.fieldDefinitions || [];

      setSheetNames(detectedSheets);
      setSelectedSheet(activeSheet);
      setHeaders(detectedHeaders);
      setPreviewRows(data.previewRows || []);
      setTotalRows(data.totalRows || 0);
      setFieldDefinitions(defs);
      setMapping(suggested);

      // Count auto matched fields
      const matched = Object.keys(suggested).filter(k => Boolean(suggested[k])).length;
      setAutoMatchedCount(matched);

      setStep('mapping');
    } catch (err) {
      console.error('Failed to parse file headers:', err);
      setError(err.response?.data?.message || err.message || 'Failed to read headers from selected file');
    } finally {
      setParsing(false);
    }
  };

  const handleSheetChange = (newSheet) => {
    setSelectedSheet(newSheet);
    if (file) {
      processSelectedFile(file, newSheet);
    }
  };

  const handleMappingChange = (fieldKey, headerName) => {
    setMapping(prev => ({
      ...prev,
      [fieldKey]: headerName
    }));
  };

  const handleAutoMatchAll = () => {
    if (!headers.length || !fieldDefinitions.length) return;
    
    const normalize = (str) => (str || '').toString().trim().toLowerCase().replace(/[\s_\-]+/g, '');
    const newMapping = {};
    const used = new Set();

    // Exact matches
    fieldDefinitions.forEach(def => {
      for (const h of headers) {
        if (used.has(h)) continue;
        if (def.aliases.includes(normalize(h))) {
          newMapping[def.key] = h;
          used.add(h);
          break;
        }
      }
    });

    // Fuzzy matches
    fieldDefinitions.forEach(def => {
      if (newMapping[def.key]) return;
      for (const h of headers) {
        if (used.has(h)) continue;
        const normH = normalize(h);
        const match = def.aliases.some(alias => 
          (alias.length > 2 && normH.includes(alias)) || 
          (normH.length > 3 && alias.includes(normH))
        );
        if (match) {
          newMapping[def.key] = h;
          used.add(h);
          break;
        }
      }
    });

    setMapping(newMapping);
    setAutoMatchedCount(Object.keys(newMapping).filter(k => Boolean(newMapping[k])).length);
  };

  const handleClearAllMappings = () => {
    setMapping({});
    setAutoMatchedCount(0);
  };

  const isRequiredMapped = useMemo(() => {
    return Boolean(mapping.employee_code && mapping.attendance_date);
  }, [mapping.employee_code, mapping.attendance_date]);

  const handleExecuteImport = async () => {
    if (!file) {
      setError('Please select an attendance file to upload.');
      return;
    }

    if (!isRequiredMapped) {
      setError('Please map both "Employee Code" and "Attendance Date" before importing.');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('sheetName', selectedSheet);
    formData.append('columnMapping', JSON.stringify(mapping));

    try {
      const res = await attendanceApi.importFile(formData);
      setResult(res.data);
      setStep('result');
      if (onImportSuccess) onImportSuccess();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Attendance import failed');
    } finally {
      setLoading(false);
    }
  };

  // Group field definitions by category for structured layout
  const groupedFields = useMemo(() => {
    const required = fieldDefinitions.filter(f => f.required);
    const timings = fieldDefinitions.filter(f => !f.required && f.category === 'timings');
    const employee = fieldDefinitions.filter(f => !f.required && f.category === 'employee');
    const adjustments = fieldDefinitions.filter(f => !f.required && f.category === 'adjustments');
    return { required, timings, employee, adjustments };
  }, [fieldDefinitions]);

  // Live dynamic sample preview calculation
  const mappedPreviewRows = useMemo(() => {
    if (!previewRows || previewRows.length === 0) return [];
    return previewRows.slice(0, 5).map((row, idx) => {
      const getVal = (key) => {
        const col = mapping[key];
        if (!col || row[col] === undefined) return '';
        return String(row[col]);
      };

      return {
        id: idx,
        empCode: getVal('employee_code'),
        date: getVal('attendance_date'),
        name: getVal('employee_name'),
        inTime: getVal('in_time'),
        outTime: getVal('out_time'),
        duration: getVal('total_duration'),
        status: getVal('status_code'),
        shift: getVal('shift_name'),
        department: getVal('department')
      };
    });
  }, [previewRows, mapping]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        resetState();
        onClose();
      }}
      title={
        step === 'upload' 
          ? 'Upload Biometric Attendance File' 
          : step === 'mapping' 
            ? 'Map Spreadsheet Columns to System Fields' 
            : 'Attendance Import Report'
      }
      size={step === 'mapping' ? 'xl' : 'md'}
      footer={
        step === 'result' ? (
          <button
            className="btn btn-primary"
            onClick={() => {
              resetState();
              onClose();
            }}
          >
            Done
          </button>
        ) : step === 'mapping' ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setStep('upload')}
              disabled={loading}
            >
              &larr; Choose Different File
            </button>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
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
                onClick={handleExecuteImport}
                disabled={!isRequiredMapped || loading}
                title={!isRequiredMapped ? 'Please map Employee Code and Attendance Date' : ''}
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Processing Attendance...
                  </>
                ) : (
                  <>
                    <UploadCloud size={16} />
                    Confirm & Import Attendance
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn btn-secondary"
            onClick={() => {
              resetState();
              onClose();
            }}
            disabled={parsing}
          >
            Cancel
          </button>
        )
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {error && (
          <div className="auth-alert-error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.85rem' }}>{error}</span>
          </div>
        )}

        {/* ================= STEP 1: UPLOAD / DROP ================= */}
        {step === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {parsing ? (
              <div 
                style={{
                  padding: '3rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1rem',
                  backgroundColor: 'var(--slate-50)',
                  borderRadius: '12px',
                  border: '1px solid var(--slate-200)'
                }}
              >
                <RefreshCw size={36} className="animate-spin" color="var(--primary-600)" />
                <div style={{ textAlign: 'center' }}>
                  <h4 style={{ margin: 0, color: 'var(--slate-800)', fontSize: '1.05rem', fontWeight: '700' }}>
                    Reading Spreadsheet Columns & Headers...
                  </h4>
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--slate-500)', fontSize: '0.8125rem' }}>
                    Analyzing structure and matching columns for {file?.name}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div
                  className={`dropzone-box ${dragActive ? 'drag-over' : ''}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ minHeight: '190px' }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <div className="dropzone-icon">
                    <FileSpreadsheet size={30} />
                  </div>
                  <div className="dropzone-text">
                    <h4 style={{ fontSize: '1.05rem', color: 'var(--slate-800)', margin: '0 0 0.25rem' }}>
                      Choose Attendance CSV / Excel file or drag here
                    </h4>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', margin: 0 }}>
                      Supports CSV (<code>.csv</code>) or Excel spreadsheets (<code>.xlsx</code>, <code>.xls</code>)
                    </p>
                    <span 
                      style={{ 
                        display: 'inline-block', 
                        marginTop: '0.75rem', 
                        fontSize: '0.75rem', 
                        backgroundColor: '#e0f2fe', 
                        color: '#0369a1', 
                        padding: '0.25rem 0.625rem', 
                        borderRadius: '999px',
                        fontWeight: '600' 
                      }}
                    >
                      ✨ Automatic Column Mapping & Live Preview included
                    </span>
                  </div>
                </div>

                <div 
                  style={{ 
                    fontSize: '0.8125rem', 
                    color: 'var(--slate-600)', 
                    backgroundColor: 'var(--slate-50)', 
                    padding: '0.875rem 1rem', 
                    borderRadius: '8px',
                    border: '1px solid var(--slate-200)',
                    lineHeight: '1.4'
                  }}
                >
                  <strong style={{ color: 'var(--slate-800)' }}>Smart Header Mapping:</strong> On the next step, you can map columns from your file to the system fields regardless of column order, naming, or device format.
                </div>
              </>
            )}
          </div>
        )}

        {/* ================= STEP 2: COLUMN MAPPING & LIVE PREVIEW ================= */}
        {step === 'mapping' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* File Info & Summary Banner */}
            <div 
              style={{
                backgroundColor: 'var(--slate-50)',
                border: '1px solid var(--slate-200)',
                borderRadius: '10px',
                padding: '0.875rem 1.125rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.875rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div 
                  style={{ 
                    width: '36px', 
                    height: '36px', 
                    borderRadius: '8px', 
                    backgroundColor: '#e0f2fe', 
                    color: '#0284c7', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}
                >
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--slate-800)' }}>
                    {file?.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                    {totalRows} data rows &bull; {headers.length} detected columns &bull; {(file?.size ? (file.size / 1024).toFixed(1) : 0)} KB
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                {/* Sheet Selector (for multi-sheet Excel files) */}
                {sheetNames.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--slate-600)' }}>Sheet:</span>
                    <select
                      className="form-input"
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.8125rem', width: 'auto' }}
                      value={selectedSheet}
                      onChange={(e) => handleSheetChange(e.target.value)}
                    >
                      {sheetNames.map((s, i) => (
                        <option key={i} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Quick Auto-Match & Clear Toolbar */}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAutoMatchAll}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
                  title="Re-run intelligent header name recognition"
                >
                  <Sparkles size={13} color="var(--primary-600)" />
                  Auto-Match All
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleClearAllMappings}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
                  title="Reset all column dropdowns"
                >
                  <Trash2 size={13} color="#e11d48" />
                  Clear All
                </button>
              </div>
            </div>

            {/* Auto match notification badge */}
            <div 
              style={{
                backgroundColor: autoMatchedCount >= 2 ? '#ecfdf5' : '#fffbeb',
                border: `1px solid ${autoMatchedCount >= 2 ? '#a7f3d0' : '#fde68a'}`,
                borderRadius: '8px',
                padding: '0.65rem 0.875rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.8125rem',
                color: autoMatchedCount >= 2 ? '#065f46' : '#92400e'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={16} color={autoMatchedCount >= 2 ? '#059669' : '#d97706'} />
                <span>
                  <strong>{autoMatchedCount} fields</strong> automatically matched based on column headers. Verify and adjust any fields as needed below.
                </span>
              </div>
              {!isRequiredMapped && (
                <span 
                  style={{ 
                    backgroundColor: '#fee2e2', 
                    color: '#991b1b', 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '4px', 
                    fontWeight: '700',
                    fontSize: '0.75rem'
                  }}
                >
                  * Required fields missing
                </span>
              )}
            </div>

            {/* Field Mapping Groups Container */}
            <div 
              style={{ 
                maxHeight: '380px', 
                overflowY: 'auto', 
                paddingRight: '0.375rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem'
              }}
            >
              {/* SECTION 1: REQUIRED FIELDS */}
              <div 
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span 
                      style={{ 
                        backgroundColor: '#ef4444', 
                        color: '#ffffff', 
                        fontSize: '0.6875rem', 
                        fontWeight: '800', 
                        padding: '0.15rem 0.45rem', 
                        borderRadius: '4px', 
                        textTransform: 'uppercase' 
                      }}
                    >
                      Mandatory
                    </span>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: 'var(--slate-800)' }}>
                      1. Required Primary Key Fields (Must be mapped)
                    </h4>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                    Used for unique record identification & deduplication
                  </span>
                </div>

                <div 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                    gap: '1rem' 
                  }}
                >
                  {groupedFields.required.map((field) => (
                    <div 
                      key={field.key}
                      style={{
                        backgroundColor: '#ffffff',
                        border: mapping[field.key] ? '1.5px solid #059669' : '1.5px solid #f87171',
                        borderRadius: '8px',
                        padding: '0.75rem 0.875rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                        <label style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--slate-800)', margin: 0 }}>
                          {field.label} <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        {mapping[field.key] ? (
                          <span style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <Check size={12} /> Mapped
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.6875rem', color: '#ef4444', fontWeight: '700' }}>
                            Required
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.725rem', color: 'var(--slate-500)', margin: '0 0 0.5rem' }}>
                        {field.description}
                      </p>
                      <select
                        className="form-input"
                        style={{
                          width: '100%',
                          padding: '0.45rem 0.65rem',
                          fontSize: '0.8125rem',
                          borderColor: mapping[field.key] ? '#059669' : '#f87171',
                          backgroundColor: mapping[field.key] ? '#f0fdf4' : '#fff5f5'
                        }}
                        value={mapping[field.key] || ''}
                        onChange={(e) => handleMappingChange(field.key, e.target.value)}
                      >
                        <option value="">-- Select Matching Spreadsheet Header (Required) --</option>
                        {headers.map((h, i) => (
                          <option key={i} value={h}>
                            {h} {previewRows[0] && previewRows[0][h] !== undefined ? `(Sample: "${previewRows[0][h]}")` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 2: ATTENDANCE TIMINGS & PUNCHES */}
              <div 
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--slate-200)',
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span 
                    style={{ 
                      backgroundColor: '#e0e7ff', 
                      color: '#4338ca', 
                      fontSize: '0.6875rem', 
                      fontWeight: '800', 
                      padding: '0.15rem 0.45rem', 
                      borderRadius: '4px', 
                      textTransform: 'uppercase' 
                    }}
                  >
                    Timings
                  </span>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: 'var(--slate-800)' }}>
                    2. Punches, Check-in / Out & Duration
                  </h4>
                </div>

                <div 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
                    gap: '0.75rem' 
                  }}
                >
                  {groupedFields.timings.map((field) => (
                    <div 
                      key={field.key}
                      style={{
                        backgroundColor: mapping[field.key] ? '#f8fafc' : '#ffffff',
                        border: '1px solid var(--slate-200)',
                        borderRadius: '6px',
                        padding: '0.625rem 0.75rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <label style={{ fontSize: '0.78125rem', fontWeight: '600', color: 'var(--slate-700)', margin: 0 }}>
                          {field.label}
                        </label>
                        {mapping[field.key] && (
                          <span style={{ fontSize: '0.6875rem', color: '#0284c7', fontWeight: '600' }}>Mapped</span>
                        )}
                      </div>
                      <select
                        className="form-input"
                        style={{
                          width: '100%',
                          padding: '0.35rem 0.5rem',
                          fontSize: '0.78125rem',
                          borderColor: mapping[field.key] ? '#38bdf8' : 'var(--slate-300)',
                          backgroundColor: mapping[field.key] ? '#f0f9ff' : '#ffffff'
                        }}
                        value={mapping[field.key] || ''}
                        onChange={(e) => handleMappingChange(field.key, e.target.value)}
                      >
                        <option value="">-- [ Do Not Import / Skip ] --</option>
                        {headers.map((h, i) => (
                          <option key={i} value={h}>
                            {h} {previewRows[0] && previewRows[0][h] !== undefined ? `(Sample: "${previewRows[0][h]}")` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 3: EMPLOYEE & SHIFT INFO */}
              <div 
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--slate-200)',
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span 
                    style={{ 
                      backgroundColor: '#fef3c7', 
                      color: '#92400e', 
                      fontSize: '0.6875rem', 
                      fontWeight: '800', 
                      padding: '0.15rem 0.45rem', 
                      borderRadius: '4px', 
                      textTransform: 'uppercase' 
                    }}
                  >
                    Employee & Shift
                  </span>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: 'var(--slate-800)' }}>
                    3. Employee Details & Shift Info
                  </h4>
                </div>

                <div 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
                    gap: '0.75rem' 
                  }}
                >
                  {groupedFields.employee.map((field) => (
                    <div 
                      key={field.key}
                      style={{
                        backgroundColor: mapping[field.key] ? '#f8fafc' : '#ffffff',
                        border: '1px solid var(--slate-200)',
                        borderRadius: '6px',
                        padding: '0.625rem 0.75rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <label style={{ fontSize: '0.78125rem', fontWeight: '600', color: 'var(--slate-700)', margin: 0 }}>
                          {field.label}
                        </label>
                        {mapping[field.key] && (
                          <span style={{ fontSize: '0.6875rem', color: '#0284c7', fontWeight: '600' }}>Mapped</span>
                        )}
                      </div>
                      <select
                        className="form-input"
                        style={{
                          width: '100%',
                          padding: '0.35rem 0.5rem',
                          fontSize: '0.78125rem',
                          borderColor: mapping[field.key] ? '#38bdf8' : 'var(--slate-300)',
                          backgroundColor: mapping[field.key] ? '#f0f9ff' : '#ffffff'
                        }}
                        value={mapping[field.key] || ''}
                        onChange={(e) => handleMappingChange(field.key, e.target.value)}
                      >
                        <option value="">-- [ Do Not Import / Skip ] --</option>
                        {headers.map((h, i) => (
                          <option key={i} value={h}>
                            {h} {previewRows[0] && previewRows[0][h] !== undefined ? `(Sample: "${previewRows[0][h]}")` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 4: ADJUSTMENTS & DEDUCTIONS */}
              <div 
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--slate-200)',
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span 
                    style={{ 
                      backgroundColor: '#f1f5f9', 
                      color: '#475569', 
                      fontSize: '0.6875rem', 
                      fontWeight: '800', 
                      padding: '0.15rem 0.45rem', 
                      borderRadius: '4px', 
                      textTransform: 'uppercase' 
                    }}
                  >
                    Adjustments
                  </span>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: 'var(--slate-800)' }}>
                    4. Deductions, Overtime & Remarks
                  </h4>
                </div>

                <div 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
                    gap: '0.75rem' 
                  }}
                >
                  {groupedFields.adjustments.map((field) => (
                    <div 
                      key={field.key}
                      style={{
                        backgroundColor: mapping[field.key] ? '#f8fafc' : '#ffffff',
                        border: '1px solid var(--slate-200)',
                        borderRadius: '6px',
                        padding: '0.625rem 0.75rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <label style={{ fontSize: '0.78125rem', fontWeight: '600', color: 'var(--slate-700)', margin: 0 }}>
                          {field.label}
                        </label>
                        {mapping[field.key] && (
                          <span style={{ fontSize: '0.6875rem', color: '#0284c7', fontWeight: '600' }}>Mapped</span>
                        )}
                      </div>
                      <select
                        className="form-input"
                        style={{
                          width: '100%',
                          padding: '0.35rem 0.5rem',
                          fontSize: '0.78125rem',
                          borderColor: mapping[field.key] ? '#38bdf8' : 'var(--slate-300)',
                          backgroundColor: mapping[field.key] ? '#f0f9ff' : '#ffffff'
                        }}
                        value={mapping[field.key] || ''}
                        onChange={(e) => handleMappingChange(field.key, e.target.value)}
                      >
                        <option value="">-- [ Do Not Import / Skip ] --</option>
                        {headers.map((h, i) => (
                          <option key={i} value={h}>
                            {h} {previewRows[0] && previewRows[0][h] !== undefined ? `(Sample: "${previewRows[0][h]}")` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* LIVE DATA PREVIEW TABLE */}
            <div 
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--slate-200)',
                borderRadius: '10px',
                padding: '0.875rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Table size={16} color="var(--primary-600)" />
                  <span style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--slate-800)' }}>
                    Live Mapping Preview (First 5 Sample Rows)
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                  Updates dynamically as you change column mappings
                </span>
              </div>

              <div style={{ overflowX: 'auto', maxHeight: '160px' }}>
                <table className="custom-table" style={{ fontSize: '0.75rem', margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Row</th>
                      <th style={{ padding: '0.4rem 0.6rem', color: mapping.employee_code ? '#059669' : '#ef4444' }}>
                        Emp Code {mapping.employee_code ? `(${mapping.employee_code})` : '*'}
                      </th>
                      <th style={{ padding: '0.4rem 0.6rem', color: mapping.attendance_date ? '#059669' : '#ef4444' }}>
                        Date {mapping.attendance_date ? `(${mapping.attendance_date})` : '*'}
                      </th>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Name</th>
                      <th style={{ padding: '0.4rem 0.6rem' }}>In Time</th>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Out Time</th>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Duration</th>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Status</th>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Shift</th>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Department</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedPreviewRows.length > 0 ? (
                      mappedPreviewRows.map((r, i) => (
                        <tr key={i}>
                          <td style={{ padding: '0.35rem 0.6rem', fontWeight: '600', color: 'var(--slate-400)' }}>#{i + 1}</td>
                          <td style={{ padding: '0.35rem 0.6rem', fontWeight: '700', color: r.empCode ? 'var(--slate-800)' : '#ef4444' }}>
                            {r.empCode || '<Unmapped>'}
                          </td>
                          <td style={{ padding: '0.35rem 0.6rem', color: r.date ? 'var(--slate-800)' : '#ef4444' }}>
                            {r.date || '<Unmapped>'}
                          </td>
                          <td style={{ padding: '0.35rem 0.6rem' }}>{r.name || '-'}</td>
                          <td style={{ padding: '0.35rem 0.6rem' }}>{r.inTime || '-'}</td>
                          <td style={{ padding: '0.35rem 0.6rem' }}>{r.outTime || '-'}</td>
                          <td style={{ padding: '0.35rem 0.6rem' }}>{r.duration || '-'}</td>
                          <td style={{ padding: '0.35rem 0.6rem' }}>{r.status || '-'}</td>
                          <td style={{ padding: '0.35rem 0.6rem' }}>{r.shift || '-'}</td>
                          <td style={{ padding: '0.35rem 0.6rem' }}>{r.department || '-'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={10} style={{ textAlign: 'center', padding: '1rem', color: 'var(--slate-400)' }}>
                          No sample rows available to preview
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 3: RESULT REPORT ================= */}
        {step === 'result' && result && (
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
                <h4 style={{ color: '#065f46', fontWeight: '700', fontSize: '1rem', margin: 0 }}>
                  Attendance Import Completed Successfully!
                </h4>
                <p style={{ color: '#047857', fontSize: '0.8125rem', margin: '0.2rem 0 0' }}>
                  File: <strong>{result.filename}</strong> &bull; Deduplication Key: <strong>Employee ID + Date</strong>
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

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={resetState}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <UploadCloud size={14} />
                Upload Another Attendance File
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
