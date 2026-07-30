import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/**
 * useAuth — returns { officer, isAuthenticated, setOfficer, logout }
 *
 * Usage:
 *   const { officer } = useAuth();
 *
 * Throws if used outside <AuthProvider>.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider> (see src/App.jsx)');
  return ctx;
}
