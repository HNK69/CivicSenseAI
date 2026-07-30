import React, { createContext, useState } from 'react';

/**
 * Mock officer session — mirrors expected MongoDB/JWT user payload.
 * Replace with real login response when backend auth is wired up.
 */
const MOCK_OFFICER = {
  id: 'OFF-001',
  name: 'Rajesh Kumar',
  designation: 'Senior Municipal Officer',
  department: 'Public Works Department',
  email: 'rajesh.kumar@municipality.gov.in',
  avatar: 'https://ui-avatars.com/api/?name=Rajesh+Kumar&background=0a3d62&color=fff&size=128',
  notifications: 5,
  zone: 'Zone-A',
};

export const AuthContext = createContext(null);

/**
 * AuthProvider — wrap <App /> with this in main.jsx / App.jsx.
 *
 * Integration: replace useState(MOCK_OFFICER) with an async login()
 * that calls POST /api/auth/login, stores JWT, and populates officer.
 */
export function AuthProvider({ children }) {
  const [officer, setOfficer]         = useState(MOCK_OFFICER);
  const [isAuthenticated]             = useState(true); // hardcoded true for scaffolding

  const logout = () => {
    setOfficer(null);
    localStorage.removeItem('officer_token');
    // TODO: navigate('/login') via useNavigate inside a wrapper or router-level redirect
  };

  return (
    <AuthContext.Provider value={{ officer, isAuthenticated, setOfficer, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
