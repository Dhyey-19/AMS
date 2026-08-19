import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Copy, 
  Check, 
  Mail, 
  Key, 
  Laptop, 
  Hospital, 
  AlertCircle, 
  Sparkles, 
  RefreshCw
} from 'lucide-react';
import { deviceApi } from '../../services/api';

export const RegistrationPage = ({ randomNumber, onRegistered, deviceName }) => {
  const [activationKey, setActivationKey] = useState('');
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [isRequestSent, setIsRequestSent] = useState(false);
  const [isAutoApproved, setIsAutoApproved] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Background Auto-Approval Polling (unlocks automatically when administrator approves via email)
  useEffect(() => {
    const deviceId = localStorage.getItem('ams_device_id');
    if (!deviceId || isAutoApproved) return;

    const checkInterval = setInterval(async () => {
      try {
        const data = await deviceApi.getStatus(deviceId);
        
        if (data.success && data.isRegistered) {
          clearInterval(checkInterval);
          setIsAutoApproved(true);
          setStatusMsg({
            text: '🎉 Workstation authorized! Unlocking AMS Portal...',
            type: 'success'
          });
          localStorage.setItem('ams_is_registered', 'true');
          setTimeout(() => {
            onRegistered();
          }, 900);
        }
      } catch (err) {
        // Polling error silently handled
      }
    }, 3000);

    return () => clearInterval(checkInterval);
  }, [isAutoApproved, onRegistered]);

  const handleCopyCode = () => {
    if (!randomNumber) return;
    navigator.clipboard.writeText(randomNumber);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRequestActivation = async () => {
    setLoading(true);
    setStatusMsg({ text: '', type: '' });
    try {
      const deviceId = localStorage.getItem('ams_device_id');
      const data = await deviceApi.requestActivation({
        randomNumber,
        deviceId,
        appName: 'AMS'
      });

      if (data.success) {
        setStatusMsg({
          text: data.message || 'Activation request sent to Administrator. Waiting for approval...',
          type: 'success'
        });
        setIsRequestSent(true);
      } else {
        setStatusMsg({ text: data.message || 'Failed to send request.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setStatusMsg({ 
        text: err.response?.data?.message || 'Network error. Could not request activation.', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualActivate = async (e) => {
    e?.preventDefault();
    if (!activationKey.trim()) {
      setStatusMsg({ text: 'Please enter the activation key provided by Administrator.', type: 'error' });
      return;
    }

    setLoading(true);
    setStatusMsg({ text: '', type: '' });
    try {
      const deviceId = localStorage.getItem('ams_device_id');
      const data = await deviceApi.activateManual(deviceId, activationKey.trim(), 'AMS');
      
      if (data.success) {
        localStorage.setItem('ams_is_registered', 'true');
        setStatusMsg({ text: '✅ Workstation activated successfully! Loading application...', type: 'success' });
        setTimeout(() => onRegistered(), 800);
      } else {
        setStatusMsg({ text: data.message || 'Invalid Activation Key. Please try again.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setStatusMsg({ 
        text: err.response?.data?.message || 'Invalid Activation Key. Please verify with Administrator.', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="device-lock-screen">
      <div className="device-card">
        {/* Card Header */}
        <div className="device-card-header">
          <div className="device-shield-badge">
            <ShieldCheck size={30} strokeWidth={2.5} />
          </div>
          <div className="device-hospital-tag">
            <Hospital size={13} />
            <span>Global IVF Hospital &bull; AMS</span>
          </div>
          <h2>Workstation Authorization</h2>
          <p>
            This workstation requires license authorization before accessing hospital staff data.
          </p>
        </div>

        {/* Card Body */}
        <div className="device-card-body">
          {/* Status Message Alert */}
          {statusMsg.text && (
            <div className={`device-alert ${statusMsg.type === 'error' ? 'error' : 'success'}`}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{statusMsg.text}</div>
            </div>
          )}

          {/* Verification Code Box */}
          <div className="device-code-box">
            <div className="device-code-label">Device Verification Code</div>
            <div className="device-code-value-row">
              <span className="device-code-number">{randomNumber || 'Generating...'}</span>
              <button 
                type="button"
                className={`btn-copy-code ${copiedCode ? 'copied' : ''}`}
                onClick={handleCopyCode}
                title="Copy verification code"
              >
                {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Live Polling Waiting Indicator (Active when request submitted) */}
          {isRequestSent && !isAutoApproved && (
            <div className="device-polling-box">
              <div className="radar-pulse-wrap">
                <div className="radar-pulse-ring"></div>
                <div className="radar-pulse-dot"></div>
              </div>
              <div className="device-polling-text">
                <h4>Waiting for Administrator Approval...</h4>
                <p>
                  As soon as authorization is confirmed by Administrator, this screen will automatically unlock.
                </p>
              </div>
            </div>
          )}

          {/* 1-Click Activation Request Button */}
          <button 
            type="button"
            className="btn-request-activation"
            onClick={handleRequestActivation}
            disabled={loading || isAutoApproved}
          >
            {loading ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                <span>Sending Activation Request...</span>
              </>
            ) : isRequestSent ? (
              <>
                <Mail size={18} />
                <span>Resend Request to Administrator</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>Request Activation</span>
              </>
            )}
          </button>

          {/* Manual Activation Key Section */}
          <div className="manual-key-divider">
            <span>Or Enter Activation Key Manually</span>
          </div>

          <form onSubmit={handleManualActivate} className="manual-key-input-row">
            <input 
              type="text"
              className="manual-key-input"
              placeholder="e.g. 98451200"
              value={activationKey}
              onChange={(e) => setActivationKey(e.target.value)}
              disabled={loading || isAutoApproved}
              autoComplete="off"
            />
            <button 
              type="submit"
              className="btn-manual-activate"
              disabled={loading || isAutoApproved || !activationKey.trim()}
            >
              <Key size={14} style={{ display: 'inline', marginRight: '5px' }} />
              Activate
            </button>
          </form>

          {/* Footer Metadata */}
          <div className="device-footer-specs">
            <div className="device-spec-item">
              <Laptop size={14} />
              <span>{deviceName || 'Workstation Client'}</span>
            </div>
            <div className="device-spec-item">
              <span>Security License v2.6</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationPage;
