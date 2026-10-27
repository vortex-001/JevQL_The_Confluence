import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getStoredToken, clearStoredToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check auth state on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await api.getMe();
        if (res && res.is_authenticated && res.user) {
          setUser(res.user);
        } else {
          setUser(null);
          clearStoredToken();
        }
      } catch (err) {
        // If unauthenticated or network error, reset user
        setUser(null);
        clearStoredToken();
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  const login = async (username, password) => {
    const res = await api.login({ username, password });
    if (res && res.user) {
      setUser(res.user);
    }
    return res;
  };

  const register = async (userData) => {
    const res = await api.register(userData);
    if (res && res.user) {
      setUser(res.user);
    }
    return res;
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await api.getMe();
      if (res && res.is_authenticated && res.user) {
        setUser(res.user);
      }
    } catch {
      // Ignore
    }
  };

  const value = {
    user,
    token: getStoredToken(),
    isAuthenticated: !!user,
    loading,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
