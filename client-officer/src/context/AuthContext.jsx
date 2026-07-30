import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [officer, setOfficer] = useState(() => {
    const saved = localStorage.getItem('officer_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('officer_token');
  });

  const login = (token, officerData) => {
    localStorage.setItem('officer_token', token);
    localStorage.setItem('officer_user', JSON.stringify(officerData));
    setOfficer(officerData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    setOfficer(null);
    setIsAuthenticated(false);
    localStorage.removeItem('officer_token');
    localStorage.removeItem('officer_user');
  };

  return (
    <AuthContext.Provider value={{ officer, isAuthenticated, setOfficer, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
