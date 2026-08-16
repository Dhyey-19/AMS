import React, { useState, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { 
  FileText, 
  Printer, 
  Download, 
  Check, 
  Settings2, 
  Eye, 
  DollarSign, 
  PenTool, 
  ShieldAlert,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { 
  generateEmployeeAttendanceHtml, 
  printEmployeeAttendance, 
  downloadEmployeeAttendanceHtml 
} from '../../utils/employeeAttendancePdf';

export const EmployeeAttendancePdfModal = ({ isOpen, onClose, sheetData }) => {
  const [showSalary, setShowSalary] = useState(true);
  const [showSignatures, setShowSignatures] = useState(true);
  const [showSpecialRules, setShowSpecialRules] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);

  const emp = sheetData?.employee || {};
  const summary = sheetData?.summary || {};

  const pdfOptions = useMemo(() => ({
    showSalary,
    showSignatures,
    showSpecialRules,
    hospitalName: 'GLOBAL IVF HOSPITAL',
    hospitalSubtitle: 'Department of Human Resources & Administration • Attendance & Payroll Statement'
  }), [showSalary, showSignatures, showSpecialRules]);

  const previewHtml = useMemo(() => {
    if (!sheetData) return '';
    return generateEmployeeAttendanceHtml(sheetData, pdfOptions);
  }, [sheetData, pdfOptions]);

  if (!isOpen || !sheetData) return null;

  const handlePrint = () => {
    setIsPrinting(true);
    printEmployeeAttendance(sheetData, pdfOptions);
    setTimeout(() => {
      setIsPrinting(false);
    }, 1500);
  };

  const handleDownload = () => {
    downloadEmployeeAttendanceHtml(sheetData, pdfOptions);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      customHeader={
        <div 
          style={{ 
            padding: '1.25rem 1.5rem', 
            borderBottom: '1px solid var(--border-color)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#ffffff',
            borderTopLeftRadius: 'var(--radius-xl)',
            borderTopRightRadius: 'var(--radius-xl)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div 
              style={{ 
                width: '38px', 
                height: '38px', 
                borderRadius: '8px', 
                background: 'rgba(255, 255, 255, 0.2)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
            >
              <FileText size={20} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '800', color: '#ffffff' }}>
                Employee Attendance PDF Statement
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#e0f2fe', marginTop: '0.15rem' }}>
                #{emp.employee_code} • {emp.employee_name} ({summary.month}) • Ready for Print & PDF Export
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            style={{ 
              background: 'rgba(255, 255, 255, 0.15)', 
              border: 'none', 
              color: '#ffffff', 
              cursor: 'pointer', 
              width: '32px', 
              height: '32px', 
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              fontWeight: '700',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
          >
            ✕
          </button>
        </div>
      }
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.775rem', color: 'var(--slate-500)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Sparkles size={14} color="var(--primary-600)" />
            <span>Select <strong>Save as PDF</strong> in the browser print dialog with <strong>Landscape</strong> orientation.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleDownload}
              className="btn btn-secondary btn-sm"
              title="Download standalone HTML document"
            >
              <Download size={15} />
              <span>Download HTML</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="btn btn-primary btn-sm"
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
              }}
            >
              <Printer size={15} />
              <span>{isPrinting ? 'Opening Print Dialog...' : 'Save as PDF / Print'}</span>
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* PDF Customization Settings Bar */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            flexWrap: 'wrap', 
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--slate-50)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--slate-700)' }}>
            <Settings2 size={16} color="var(--primary-600)" />
            <span>Report Customizations:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            {/* Show Salary Toggle */}
            <label 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.45rem', 
                cursor: 'pointer', 
                fontSize: '0.8125rem', 
                fontWeight: '600',
                color: showSalary ? 'var(--primary-700)' : 'var(--slate-600)'
              }}
            >
              <input 
                type="checkbox" 
                checked={showSalary} 
                onChange={(e) => setShowSalary(e.target.checked)} 
                style={{ cursor: 'pointer', accentColor: 'var(--primary-600)', width: '15px', height: '15px' }}
              />
              <DollarSign size={14} color={showSalary ? 'var(--primary-600)' : 'var(--slate-400)'} />
              <span>Include Salary & Rates</span>
            </label>

            {/* Show Signatures Toggle */}
            <label 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.45rem', 
                cursor: 'pointer', 
                fontSize: '0.8125rem', 
                fontWeight: '600',
                color: showSignatures ? 'var(--primary-700)' : 'var(--slate-600)'
              }}
            >
              <input 
                type="checkbox" 
                checked={showSignatures} 
                onChange={(e) => setShowSignatures(e.target.checked)} 
                style={{ cursor: 'pointer', accentColor: 'var(--primary-600)', width: '15px', height: '15px' }}
              />
              <PenTool size={14} color={showSignatures ? 'var(--primary-600)' : 'var(--slate-400)'} />
              <span>Signatures Section</span>
            </label>

            {/* Show Special Rules Toggle */}
            {emp.special_rules && (
              <label 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.45rem', 
                  cursor: 'pointer', 
                  fontSize: '0.8125rem', 
                  fontWeight: '600',
                  color: showSpecialRules ? 'var(--primary-700)' : 'var(--slate-600)'
                }}
              >
                <input 
                  type="checkbox" 
                  checked={showSpecialRules} 
                  onChange={(e) => setShowSpecialRules(e.target.checked)} 
                  style={{ cursor: 'pointer', accentColor: 'var(--primary-600)', width: '15px', height: '15px' }}
                />
                <ShieldAlert size={14} color={showSpecialRules ? 'var(--warning-solid)' : 'var(--slate-400)'} />
                <span>Special Rules</span>
              </label>
            )}
          </div>
        </div>

        {/* Live Document Preview Frame */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '700', color: 'var(--slate-500)', textTransform: 'uppercase' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Eye size={13} /> Document Live Preview (Landscape A4)
            </span>
            <span style={{ fontSize: '0.725rem', fontWeight: 'normal', color: 'var(--slate-400)' }}>
              Zoom to inspect before exporting
            </span>
          </div>

          <div 
            style={{ 
              width: '100%', 
              height: '520px', 
              border: '1px solid var(--border-color)', 
              borderRadius: 'var(--radius-md)', 
              overflow: 'hidden',
              backgroundColor: '#f1f5f9',
              boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.05)'
            }}
          >
            <iframe 
              srcDoc={previewHtml}
              title="PDF Statement Preview"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: '#ffffff'
              }}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};
