import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('ams_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('ams_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    const initAuth = async () => {
      const savedToken = localStorage.getItem('ams_token');
      if (savedToken) {
        try {
          const res = await authApi.getMe();
          setUser(res.data);
          localStorage.setItem('ams_user', JSON.stringify(res.data));
        } catch (err) {
          console.warn('Stored token is invalid or expired:', err.message);
          localStorage.removeItem('ams_token');
          localStorage.removeItem('ams_user');
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (username, password) => {
    const res = await authApi.login({ username, password });
    if (res.success && res.data) {
      const { user: userData, token: userToken } = res.data;
      setUser(userData);
      setToken(userToken);
      localStorage.setItem('ams_token', userToken);
      localStorage.setItem('ams_user', JSON.stringify(userData));
      return { success: true, user: userData };
    }
    throw new Error(res.message || 'Login failed');
  };

  const signup = async (userData) => {
    const res = await authApi.register(userData);
    if (res.success && res.data) {
      const { user: newUser, token: userToken } = res.data;
      setUser(newUser);
      setToken(userToken);
      localStorage.setItem('ams_token', userToken);
      localStorage.setItem('ams_user', JSON.stringify(newUser));
      return { success: true, user: newUser };
    }
    throw new Error(res.message || 'Signup failed');
  };

  const logout = () => {
    localStorage.removeItem('ams_token');
    localStorage.removeItem('ams_user');
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        login,
        signup,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
