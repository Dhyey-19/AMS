import React, { useState, useEffect } from 'react';
import { Menu, Clock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Header = ({ activeTab, onToggleSidebar, onOpenDeviceModal }) => {
  const { user } = useAuth();
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const titles = {
    'dashboard': { title: 'Hospital Dashboard', breadcrumb: 'Overview & Analytics' },
    'employee-attendance': { title: 'Employee Attendance Record', breadcrumb: 'Individual Attendance, Shifts & Salary Record' },
    'import-master': { title: 'Import Master Data', breadcrumb: 'Staff Roster & Profile Ingestion' },
    'import-attendance': { title: 'Import Attendance', breadcrumb: 'Biometric Punch Records Ingestion' },
    'reports': { title: 'Attendance Reports', breadcrumb: 'Daily, Monthly & Employee Analytics' },
    'employees': { title: 'Employee Directory', breadcrumb: 'Staff Records & Master Profiles' }
  };

  const current = titles[activeTab] || { title: 'AMS Portal', breadcrumb: 'Global IVF Hospital' };

  return (
    <header className="top-header">
      <div className="header-left">
        <button 
          className="menu-toggle-btn" 
          onClick={onToggleSidebar}
          aria-label="Toggle menu"
        >
          <Menu size={22} />
        </button>

        <div className="page-title-group">
          <h1>{current.title}</h1>
          <div className="page-breadcrumbs">Global IVF Hospital &bull; {current.breadcrumb}</div>
        </div>
      </div>

      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Device / Workstation License Badge */}
        <button 
          onClick={onOpenDeviceModal}
          className="live-clock-badge"
          style={{ 
            background: 'var(--primary-50)', 
            borderColor: 'var(--primary-200)',
            cursor: 'pointer',
            border: '1px solid var(--primary-200)',
            color: 'var(--primary-700)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
          title="Workstation License Active &bull; Click to manage authorized devices"
        >
          <ShieldCheck size={15} color="#0284c7" />
          <span style={{ fontWeight: 600 }}>Workstation Active</span>
        </button>

        <div className="live-clock-badge">
          <Clock size={15} color="#0284c7" />
          <span>{dateStr} &bull; {timeStr}</span>
          <span className="live-indicator-dot" title="Realtime Sync Active"></span>
        </div>
      </div>
    </header>
  );
};
