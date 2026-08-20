import React from 'react';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  Users, 
  LogOut, 
  Hospital,
  Building2,
  UserCheck,
  ShieldCheck,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import versionData from '../../version.json';

export const Sidebar = ({ activeTab, onSelectTab, isOpen, onClose, onOpenDeviceModal }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'employee-attendance', label: 'Employee Attendance', icon: UserCheck },
    { id: 'import-master', label: 'Import Master Data', icon: FileSpreadsheet },
    { id: 'import-attendance', label: 'Import Attendance', icon: FileSpreadsheet },
    { id: 'reports', label: 'Attendance Reports', icon: Building2 },
    { id: 'employees', label: 'Employee Directory', icon: Users }
  ];

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="hospital-logo-badge">
            <Hospital size={24} strokeWidth={2.5} />
          </div>
          <div className="hospital-brand-info">
            <span className="hospital-title">Global IVF</span>
            <div className="hospital-subtitle-row">
              <span className="hospital-subtitle">Hospital AMS</span>
              <span className="app-version-tag" title={`Build: ${versionData?.displayDate || versionData?.buildDate || '2026-08-20'}`}>
                {versionData?.display || `v${versionData?.version || '20260820'}`}
              </span>
            </div>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <div className="sidebar-nav">
          <span className="nav-section-title">Navigation</span>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onClose) onClose();
                }}
              >
                <span className="nav-icon">
                  <Icon size={20} />
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}

          <div style={{ marginTop: 'auto' }}>
            <span className="nav-section-title">System &amp; Security</span>
            
            {/* Workstations / Device License Management */}
            <button
              className="nav-item"
              onClick={() => {
                if (onOpenDeviceModal) onOpenDeviceModal();
                if (onClose) onClose();
              }}
              style={{ color: 'var(--primary-600)' }}
            >
              <span className="nav-icon" style={{ color: 'var(--primary-600)' }}>
                <ShieldCheck size={20} />
              </span>
              <span>Workstation Licenses</span>
            </button>

            <button
              className="nav-item"
              onClick={logout}
              style={{ color: '#fb7185' }}
            >
              <span className="nav-icon" style={{ color: '#fb7185' }}>
                <LogOut size={20} />
              </span>
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Sidebar User Footer */}
        <div className="sidebar-footer">
          <div className="user-profile-pill">
            <div className="user-avatar">
              {user?.fullName?.charAt(0) || user?.username?.charAt(0) || 'U'}
            </div>
            <div className="user-info">
              <span className="user-name">{user?.fullName || user?.username || 'Hospital User'}</span>
              <span className="user-role">{user?.role || 'Admin'}</span>
            </div>
            <button 
              className="btn-logout" 
              onClick={logout}
              title="Logout from AMS"
            >
              <LogOut size={16} />
            </button>
          </div>
          <div className="sidebar-footer-version">
            <span>AMS {versionData?.display || `v${versionData?.version || '20260820'}`}</span>
            <span>•</span>
            <span>{versionData?.displayDate || '20-Aug-2026'}</span>
          </div>
        </div>
      </aside>
    </>
  );
};
