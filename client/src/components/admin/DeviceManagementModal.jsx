import React, { useState, useEffect } from 'react';
import { 
  Laptop, 
  X, 
  CheckCircle, 
  AlertTriangle, 
  Trash2, 
  RotateCcw, 
  Edit2, 
  Check, 
  RefreshCw, 
  Shield, 
  Search, 
  Sparkles,
  LogOut
} from 'lucide-react';
import { deviceApi } from '../../services/api';

export const DeviceManagementModal = ({ isOpen, onClose }) => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  const [selectedDevices, setSelectedDevices] = useState([]);

  const currentDeviceId = typeof window !== 'undefined' ? localStorage.getItem('ams_device_id') : null;

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await deviceApi.getAll();
      if (res.success) {
        setDevices(res.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch devices:', err);
      setStatusMsg({ text: 'Failed to load device list.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDevices();
      setSelectedDevices([]);
      setStatusMsg({ text: '', type: '' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handle1ClickApprove = async (device) => {
    setActionLoading(true);
    setStatusMsg({ text: '', type: '' });
    try {
      // Direct approval simulation / manual activate
      if (device.random_number) {
        const res = await deviceApi.activateManual(
          device.device_id, 
          // We can call server approve or calculate key
          calculateKeyLocal(device.random_number)
        );
        if (res.success) {
          setStatusMsg({ text: `Device "${device.device_name || 'Workstation'}" approved successfully!`, type: 'success' });
          fetchDevices();
        }
      }
    } catch (err) {
      setStatusMsg({ text: err.response?.data?.message || 'Failed to approve device.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const calculateKeyLocal = (randomNumber) => {
    const concatenated = (randomNumber + 'AMS').trim().toUpperCase();
    let asciiSum = 0;
    for (let i = 0; i < concatenated.length; i++) {
      asciiSum += concatenated.charCodeAt(i);
    }
    let finalSum = asciiSum * 10252;
    if (finalSum < 0) finalSum *= -1;
    return finalSum.toString();
  };

  const handleRevoke = async (deviceId) => {
    if (!window.confirm('Are you sure you want to revoke authorization for this workstation? It will be locked out immediately.')) return;
    setActionLoading(true);
    try {
      const res = await deviceApi.revoke(deviceId);
      if (res.success) {
        setStatusMsg({ text: 'Device authorization revoked.', type: 'success' });
        fetchDevices();
        if (deviceId === currentDeviceId) {
          localStorage.removeItem('ams_is_registered');
          window.location.reload();
        }
      }
    } catch (err) {
      setStatusMsg({ text: err.response?.data?.message || 'Failed to revoke device.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (deviceId) => {
    if (!window.confirm('Are you sure you want to delete this device record?')) return;
    setActionLoading(true);
    try {
      const res = await deviceApi.deleteDevice(deviceId);
      if (res.success) {
        setStatusMsg({ text: 'Device deleted successfully.', type: 'success' });
        fetchDevices();
      }
    } catch (err) {
      setStatusMsg({ text: err.response?.data?.message || 'Failed to delete device.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartEdit = (device) => {
    setEditingId(device.device_id);
    setEditName(device.device_name || '');
  };

  const handleSaveEdit = async (deviceId) => {
    try {
      await deviceApi.update(deviceId, editName.trim() || 'Workstation');
      setEditingId(null);
      fetchDevices();
    } catch (err) {
      alert('Failed to update device name');
    }
  };

  const handleSurrenderCurrent = async () => {
    if (!window.confirm('Surrender license on THIS machine? You will be presented with the activation screen immediately.')) return;
    if (!currentDeviceId) return;
    try {
      await deviceApi.surrender(currentDeviceId);
      localStorage.removeItem('ams_is_registered');
      window.location.reload();
    } catch (err) {
      alert('Failed to surrender license');
    }
  };

  const filteredDevices = devices.filter((d) => {
    const q = search.toLowerCase();
    return (
      (d.device_name && d.device_name.toLowerCase().includes(q)) ||
      (d.last_user && d.last_user.toLowerCase().includes(q)) ||
      (d.ip_address && d.ip_address.toLowerCase().includes(q)) ||
      (d.device_id && d.device_id.toLowerCase().includes(q))
    );
  });

  return (
    <div className="device-modal-overlay" onClick={onClose}>
      <div className="device-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="device-modal-header">
          <div className="device-modal-title-wrap">
            <div className="device-modal-icon-badge">
              <Shield size={22} />
            </div>
            <div>
              <h3>Authorized Workstations &amp; Licenses</h3>
              <p>Manage machines, authorize pending access requests, and review active sessions</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="btn-icon"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-400)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="device-modal-body">
          {/* Status Message */}
          {statusMsg.text && (
            <div className={`device-alert ${statusMsg.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: '1rem' }}>
              <div>{statusMsg.text}</div>
            </div>
          )}

          {/* Search & Actions Bar */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
              <input 
                type="text"
                className="input-field"
                placeholder="Search workstations by name, user, or IP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '36px', height: '38px', fontSize: '0.85rem' }}
              />
            </div>
            <button 
              className="btn btn-secondary"
              onClick={fetchDevices}
              disabled={loading}
              style={{ height: '38px', padding: '0 14px', fontSize: '0.825rem' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Devices Table */}
          <div className="table-responsive" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Workstation / Device</th>
                  <th>Status</th>
                  <th>Last User</th>
                  <th>IP Address</th>
                  <th>Last Active</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--slate-500)' }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                      <div>Loading authorized devices...</div>
                    </td>
                  </tr>
                ) : filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--slate-500)' }}>
                      No workstations found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredDevices.map((dev) => {
                    const isCurrent = dev.device_id === currentDeviceId;
                    const isRegistered = dev.is_registered === 1;

                    return (
                      <tr key={dev.device_id} style={{ background: isCurrent ? 'var(--primary-50)' : undefined }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Laptop size={18} color="var(--primary-600)" />
                            <div>
                              {editingId === dev.device_id ? (
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <input 
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    style={{ padding: '2px 6px', fontSize: '0.8rem', border: '1px solid var(--primary-400)', borderRadius: '4px' }}
                                    autoFocus
                                  />
                                  <button onClick={() => handleSaveEdit(dev.device_id)} className="device-action-btn success" style={{ padding: '2px 6px' }}>
                                    <Check size={12} />
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '0.875rem' }}>
                                    {dev.device_name || 'Workstation'}
                                  </span>
                                  <button 
                                    onClick={() => handleStartEdit(dev)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-400)', padding: 0 }}
                                    title="Rename workstation"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  {isCurrent && (
                                    <span style={{ fontSize: '0.65rem', background: 'var(--primary-600)', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                      THIS PC
                                    </span>
                                  )}
                                </div>
                              )}
                              <div style={{ fontSize: '0.725rem', color: 'var(--slate-400)', fontFamily: 'monospace' }}>
                                ID: {dev.device_id.substring(0, 16)}...
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          {isRegistered ? (
                            <span className="device-status-pill active">
                              <CheckCircle size={12} />
                              Authorized
                            </span>
                          ) : (
                            <div>
                              <span className="device-status-pill pending">
                                <AlertTriangle size={12} />
                                Pending
                              </span>
                              {dev.random_number && (
                                <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--slate-500)', marginTop: '2px' }}>
                                  Code: {dev.random_number}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.825rem', color: 'var(--slate-700)', fontWeight: 500 }}>
                            {dev.last_user || '—'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.825rem', fontFamily: 'monospace', color: 'var(--slate-600)' }}>
                            {dev.ip_address || 'Localhost'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.775rem', color: 'var(--slate-500)' }}>
                            {dev.last_active_at ? new Date(dev.last_active_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            {!isRegistered && dev.random_number && (
                              <button 
                                className="device-action-btn success"
                                onClick={() => handle1ClickApprove(dev)}
                                disabled={actionLoading}
                                title="Instantly approve this device"
                              >
                                <Sparkles size={12} />
                                <span>1-Click Approve</span>
                              </button>
                            )}
                            {isRegistered && (
                              <button 
                                className="device-action-btn danger"
                                onClick={() => handleRevoke(dev.device_id)}
                                disabled={actionLoading}
                                title="Revoke authorization"
                              >
                                <RotateCcw size={12} />
                                <span>Revoke</span>
                              </button>
                            )}
                            <button 
                              className="device-action-btn"
                              onClick={() => handleDelete(dev.device_id)}
                              disabled={actionLoading}
                              title="Delete record"
                              style={{ color: 'var(--slate-500)' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="device-modal-footer">
          <button 
            className="btn btn-secondary"
            onClick={handleSurrenderCurrent}
            style={{ color: '#e11d48', borderColor: '#fecdd3', fontSize: '0.8rem', padding: '6px 12px' }}
            title="Surrender license on this current machine"
          >
            <LogOut size={14} />
            <span>Surrender This Machine's License</span>
          </button>
          
          <button className="btn btn-primary" onClick={onClose} style={{ fontSize: '0.85rem', padding: '6px 18px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceManagementModal;
