import React, { useEffect, useState } from 'react';
import { Hospital, ShieldCheck } from 'lucide-react';
import { deviceApi } from '../../services/api';
import { RegistrationPage } from './RegistrationPage';

export const RegistrationGuard = ({ children }) => {
  const [isRegistered, setIsRegistered] = useState(null);
  const [randomNumber, setRandomNumber] = useState(null);
  const [deviceName, setDeviceName] = useState('');
  const [checking, setChecking] = useState(true);
  const [loadError, setLoadError] = useState('');

  const checkRegistration = async () => {
    setChecking(true);
    setLoadError('');
    try {
      // Generate or retrieve persistent unique Device ID
      let deviceId = localStorage.getItem('ams_device_id');
      if (!deviceId) {
        deviceId = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'ams_dev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('ams_device_id', deviceId);
      }

      let currentUser = '';
      try {
        const userObj = localStorage.getItem('ams_user');
        if (userObj) {
          const parsed = JSON.parse(userObj);
          currentUser = parsed.username || parsed.fullName || '';
        }
      } catch (e) {
        // ignore parsing error
      }

      const data = await deviceApi.getStatus(deviceId, currentUser);

      if (data.success) {
        setIsRegistered(data.isRegistered);
        if (!data.isRegistered && data.randomNumber) {
          setRandomNumber(data.randomNumber);
          if (data.deviceName) setDeviceName(data.deviceName);
          localStorage.removeItem('ams_is_registered');
        } else if (data.isRegistered) {
          localStorage.setItem('ams_is_registered', 'true');
        }
      } else {
        setIsRegistered(false);
        setLoadError(data.message || 'Could not retrieve device authorization code');
      }
    } catch (err) {
      console.error('Failed to verify workstation registration:', err);
      setIsRegistered(false);
      setLoadError(err.response?.data?.message || err.message || 'Server connection error');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkRegistration();
  }, []);

  // Loading state while checking device status
  if (checking || isRegistered === null) {
    return (
      <div 
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0369a1 0%, #0c4a6e 100%)',
          color: '#ffffff',
          gap: '1.25rem'
        }}
      >
        <div 
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
          }}
        >
          <Hospital size={36} strokeWidth={2.5} color="#ffffff" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.35rem', fontWeight: '800', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
            Global IVF Hospital
          </div>
          <div style={{ fontSize: '0.875rem', color: '#bae6fd' }}>
            Verifying Workstation Security &amp; License...
          </div>
        </div>
      </div>
    );
  }

  // If unregistered, present the Registration Lock Screen
  if (!isRegistered) {
    return (
      <RegistrationPage 
        randomNumber={randomNumber} 
        deviceName={deviceName}
        loadError={loadError}
        onRefresh={checkRegistration}
        onRegistered={() => setIsRegistered(true)} 
      />
    );
  }

  // Workstation is authorized: proceed to render application
  return <>{children}</>;
};

export default RegistrationGuard;
