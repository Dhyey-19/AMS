import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import versionData from '../version.json';
import { 
  Hospital, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2, 
  KeyRound, 
  AlertCircle 
} from 'lucide-react';

export const LoginPage = ({ onNavigateToSignup }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await login(username, password);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = () => {
    setUsername('admin');
    setPassword('admin123');
    setError('');
  };

  return (
    <div className="auth-page-container">
      <div className="auth-split-wrapper animate-fade-in">
        {/* Left Side: Hospital Branding & Info */}
        <div className="auth-banner-side">
          <div>
            <div className="banner-hospital-brand">
              <div className="banner-logo-icon">
                <Hospital size={28} strokeWidth={2.5} />
              </div>
              <div className="banner-title-text">
                <h2>Global IVF</h2>
                <span>Hospital & Fertility Centre</span>
              </div>
            </div>

            <div className="banner-main-hero">
              <h1>Attendance Management System</h1>
              <p>
                Hospital-grade biometric & staff attendance portal. Secure, local SQLite data architecture with master employee synchronization.
              </p>

              <div className="banner-highlights">
                <div className="highlight-pill">
                  <span className="highlight-pill-icon">
                    <CheckCircle2 size={16} />
                  </span>
                  <span>Master Data CSV/Excel Deduplication</span>
                </div>
                <div className="highlight-pill">
                  <span className="highlight-pill-icon">
                    <CheckCircle2 size={16} />
                  </span>
                  <span>Departmental Shift & Roster Tracking</span>
                </div>
                <div className="highlight-pill">
                  <span className="highlight-pill-icon">
                    <CheckCircle2 size={16} />
                  </span>
                  <span>Zero-Cloud Dependency (Local SQLite)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="banner-footer">
            &copy; 2026 Global IVF Hospital &bull; AMS {versionData?.display || `v${versionData?.version || '20260820'}`} ({versionData?.displayDate || '20-Aug-2026'})
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="auth-form-side">
          <div className="auth-form-header">
            <h2>Sign In to AMS</h2>
            <p>Enter your hospital staff credentials to access the dashboard</p>
          </div>

          {error && (
            <div className="auth-alert-error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">
                Username
              </label>
              <div className="password-input-wrap">
                <input
                  id="username"
                  type="text"
                  className="form-input"
                  placeholder="e.g. admin or username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <div className="password-input-wrap">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? (
                'Authenticating...'
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Fill Box */}
          <div className="demo-credentials-box">
            <div className="demo-credentials-text">
              <strong>Demo Administrator</strong>
              <div>User: <code>admin</code> | Pass: <code>admin123</code></div>
            </div>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={handleQuickFill}
            >
              <KeyRound size={14} />
              Auto-fill
            </button>
          </div>

          <div className="auth-toggle-link">
            Don't have an account?{' '}
            <a
              href="#signup"
              onClick={(e) => {
                e.preventDefault();
                onNavigateToSignup();
              }}
            >
              Create Staff Account
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
