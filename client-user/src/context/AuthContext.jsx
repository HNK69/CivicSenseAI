import { createContext, useContext, useState, useCallback } from 'react';
import { loginCitizen, registerCitizen, logoutCitizen } from '../services/authService.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('citizen_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /** Login with real backend — returns { success, user } */
  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await loginCitizen({ email, password });
      // Backend shape: { success, data: { user, accessToken, refreshToken } }
      const { user: userData, accessToken, refreshToken } = res.data;
      localStorage.setItem('citizen_token', accessToken);
      localStorage.setItem('citizen_refresh', refreshToken);
      localStorage.setItem('citizen_user', JSON.stringify(userData));
      setUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please try again.';
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  /** Register a new citizen account */
  const register = useCallback(async ({ name, email, phone, password }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await registerCitizen({ name, email, phone, password });
      const { user: userData, accessToken, refreshToken } = res.data;
      localStorage.setItem('citizen_token', accessToken);
      localStorage.setItem('citizen_refresh', refreshToken);
      localStorage.setItem('citizen_user', JSON.stringify(userData));
      setUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.';
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('citizen_refresh');
      await logoutCitizen(refreshToken);
    } catch (e) {
      console.warn('Logout API warning', e);
    } finally {
      localStorage.removeItem('citizen_token');
      localStorage.removeItem('citizen_refresh');
      localStorage.removeItem('citizen_user');
      setUser(null);
      window.location.href = '/login';
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, login, register, logout, loading, error, setError, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider');
  return ctx;
};

export default AuthContext;
