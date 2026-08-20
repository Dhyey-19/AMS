import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import versionData from '../version.json';
import { 
  Hospital, 
  Lock, 
  User, 
  Mail, 
  ArrowRight, 
  ShieldCheck, 
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';

export const SignupPage = ({ onNavigateToLogin }) => {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password || !fullName.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await signup({
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim() || null,
        role,
        password
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-split-wrapper animate-fade-in">
        {/* Left Side: Hospital Branding */}
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
              <h1>Register New Staff Account</h1>
              <p>
                Create your local administrative account for the Attendance Management System. All user authentication and activity logs are stored securely in local SQLite.
              </p>

              <div className="banner-highlights">
                <div className="highlight-pill">
                  <span className="highlight-pill-icon">
                    <ShieldCheck size={16} />
                  </span>
                  <span>Bcrypt Encrypted Credential Security</span>
                </div>
                <div className="highlight-pill">
                  <span className="highlight-pill-icon">
                    <ShieldCheck size={16} />
                  </span>
                  <span>Role-Based Access Management</span>
                </div>
              </div>
            </div>
          </div>

          <div className="banner-footer">
            &copy; 2026 Global IVF Hospital &bull; AMS {versionData?.display || `v${versionData?.version || '20260820'}`} ({versionData?.displayDate || '20-Aug-2026'})
          </div>
        </div>

        {/* Right Side: Signup Form */}
        <div className="auth-form-side">
          <div className="auth-form-header">
            <h2>Create Account</h2>
            <p>Register as a staff member or administrator</p>
          </div>

          {error && (
            <div className="auth-alert-error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="fullName">
                Full Name *
              </label>
              <input
                id="fullName"
                type="text"
                className="form-input"
                placeholder="e.g. Dr. Rajesh Patel"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-username">
                  Username *
                </label>
                <input
                  id="reg-username"
                  type="text"
                  className="form-input"
                  placeholder="e.g. rpatel"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="role">
                  Role
                </label>
                <select
                  id="role"
                  className="form-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="Admin">Admin</option>
                  <option value="HR Manager">HR Manager</option>
                  <option value="Medical Officer">Medical Officer</option>
                  <option value="Staff">General Staff</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email Address (Optional)
              </label>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="e.g. rpatel@globalivf.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-password">
                  Password *
                </label>
                <div className="password-input-wrap">
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Min. 4 chars"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirmPassword">
                  Confirm Password *
                </label>
                <div className="password-input-wrap">
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? (
                'Creating Account...'
              ) : (
                <>
                  <span>Complete Registration</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="auth-toggle-link">
            Already have an account?{' '}
            <a
              href="#login"
              onClick={(e) => {
                e.preventDefault();
                onNavigateToLogin();
              }}
            >
              Sign In
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
