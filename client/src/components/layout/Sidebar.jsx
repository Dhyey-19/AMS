import React from 'react';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  Users, 
  LogOut, 
  Hospital,
  Building2,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = ({ activeTab, onSelectTab, isOpen, onClose }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
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
            <span className="hospital-subtitle">Hospital AMS</span>
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
            <span className="nav-section-title">System</span>
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
        </div>
      </aside>
    </>
  );
};
