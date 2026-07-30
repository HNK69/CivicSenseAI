import { createContext, useContext, useState, useEffect } from 'react';

/**
 * AuthContext — Provides logged-in citizen info across the app.
 * TODO: replace MOCK_USER with real session/JWT from backend
 */

const MOCK_USER = {
  id: 'CIT-001',
  name: 'Aditya Kumar',
  email: 'aditya.kumar@example.com',
  avatar: null,           // null → initials fallback
  ward: 'Ward 42',
  city: 'Bangalore',
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: connect to backend endpoint — GET /api/auth/me
    // Simulate async session check
    const timer = setTimeout(() => {
      setUser(MOCK_USER);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const login = (credentials) => {
    // TODO: POST /api/auth/login → set user from response
    setUser(MOCK_USER);
  };

  const logout = () => {
    // TODO: POST /api/auth/logout → clear session cookie
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
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
