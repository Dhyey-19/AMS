import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const AppLayout = ({ activeTab, onSelectTab, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
      />

      {/* Main Content Viewport */}
      <div className="main-wrapper">
        <Header 
          activeTab={activeTab} 
          onToggleSidebar={toggleSidebar} 
        />
        <main className="content-container animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
};
