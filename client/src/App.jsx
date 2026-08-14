import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { DashboardPage } from './pages/DashboardPage';
import { MasterDataPage } from './pages/MasterDataPage';
import { AttendanceImportPage } from './pages/AttendanceImportPage';
import { AttendanceReportsPage } from './pages/AttendanceReportsPage';
import { EmployeeAttendancePage } from './pages/EmployeeAttendancePage';
import { AppLayout } from './components/layout/AppLayout';

const MainApplication = () => {
  const { isAuthenticated, loading } = useAuth();
  const [authView, setAuthView] = useState('login'); // 'login' or 'signup'
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'employee-attendance', 'import-master', 'import-attendance', 'reports', 'employees'
  const [selectedEmployeeForAttendance, setSelectedEmployeeForAttendance] = useState('128');

  const handleOpenEmployeeAttendance = (code) => {
    if (code) {
      setSelectedEmployeeForAttendance(code.toString());
    }
    setActiveTab('employee-attendance');
  };

  if (loading) {
    return (
      <div 
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#38bdf8'
        }}
      >
        <div style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem' }}>
          Global IVF Hospital
        </div>
        <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
          Loading Attendance Management System...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authView === 'signup') {
      return <SignupPage onNavigateToLogin={() => setAuthView('login')} />;
    }
    return <LoginPage onNavigateToSignup={() => setAuthView('signup')} />;
  }

  return (
    <AppLayout activeTab={activeTab} onSelectTab={setActiveTab}>
      {activeTab === 'dashboard' && (
        <DashboardPage 
          onNavigateToImport={() => setActiveTab('import-master')}
          onNavigateToEmployees={() => setActiveTab('employees')}
          onNavigateToAttendanceImport={() => setActiveTab('import-attendance')}
          onNavigateToReports={() => setActiveTab('reports')}
          onNavigateToEmployeeAttendance={handleOpenEmployeeAttendance}
        />
      )}
      {activeTab === 'employee-attendance' && (
        <EmployeeAttendancePage 
          initialEmployeeCode={selectedEmployeeForAttendance}
          onNavigateToEmployees={() => setActiveTab('employees')}
        />
      )}
      {activeTab === 'import-master' && (
        <MasterDataPage 
          onNavigateToEmployeeAttendance={handleOpenEmployeeAttendance}
        />
      )}
      {activeTab === 'import-attendance' && (
        <AttendanceImportPage 
          onNavigateToEmployeeAttendance={handleOpenEmployeeAttendance}
        />
      )}
      {activeTab === 'reports' && (
        <AttendanceReportsPage 
          onNavigateToEmployeeAttendance={handleOpenEmployeeAttendance}
        />
      )}
      {activeTab === 'employees' && (
        <MasterDataPage 
          onNavigateToEmployeeAttendance={handleOpenEmployeeAttendance}
        />
      )}
    </AppLayout>
  );
};

export const App = () => {
  return (
    <AuthProvider>
      <MainApplication />
    </AuthProvider>
  );
};

export default App;
