import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const Toast = ({ message, type = 'success', onClose, duration = 4000 }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const icons = {
    success: <CheckCircle2 size={18} color="#059669" />,
    error: <AlertCircle size={18} color="#e11d48" />,
    info: <Info size={18} color="#0284c7" />
  };

  const bgStyles = {
    success: { background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' },
    error: { background: '#fff1f2', borderColor: '#fecdd3', color: '#9f1239' },
    info: { background: '#f0f9ff', borderColor: '#bae6fd', color: '#0369a1' }
  };

  const currentStyle = bgStyles[type] || bgStyles.info;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 18px',
        borderRadius: '10px',
        border: `1px solid ${currentStyle.borderColor}`,
        backgroundColor: currentStyle.background,
        color: currentStyle.color,
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
        zIndex: 9999,
        fontSize: '0.875rem',
        fontWeight: 600,
        maxWidth: '420px',
        animation: 'fadeIn 0.25s ease'
      }}
    >
      {icons[type]}
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
          opacity: 0.7,
          display: 'flex'
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
};
