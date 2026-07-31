import React, { createContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [officer, setOfficer] = useState(() => {
    const saved = localStorage.getItem('officer_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('officer_token');
  });

  const socketRef = useRef(null);

  useEffect(() => {
    if (!officer) return;
    const officerId = officer._id || officer.id;
    if (!officerId) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const socket = io(socketUrl, { withCredentials: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('officer:join', {
        officerId,
        department: officer.department,
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [officer]);

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
    localStorage.removeItem('officer_refresh');
    localStorage.removeItem('officer_user');
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ officer, isAuthenticated, setOfficer, login, logout, socket: socketRef.current }}>
      {children}
    </AuthContext.Provider>
  );
}
