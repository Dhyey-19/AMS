import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { DeviceManagementModal } from '../admin/DeviceManagementModal';

export const AppLayout = ({ activeTab, onSelectTab, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="app-layout">
      {/* Mobile Backdrop */}
      <div 
        className={`sidebar-backdrop ${isSidebarOpen ? 'open' : ''}`} 
        onClick={closeSidebar}
      />

      {/* Sidebar Drawer */}
      <Sidebar 
        activeTab={activeTab} 
        onSelectTab={onSelectTab} 
        isOpen={isSidebarOpen} 
        onClose={closeSidebar}
        onOpenDeviceModal={() => setIsDeviceModalOpen(true)}
      />

      {/* Main Content Viewport */}
      <div className="main-wrapper">
        <Header 
          activeTab={activeTab} 
          onToggleSidebar={toggleSidebar} 
          onOpenDeviceModal={() => setIsDeviceModalOpen(true)}
        />
        <main className="content-container animate-fade-in">
          {children}
        </main>
      </div>

      {/* Device Management Modal */}
      <DeviceManagementModal 
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
      />
    </div>
  );
};
