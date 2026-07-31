import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useContext(AuthContext);
  const token = localStorage.getItem('officer_token');

  if (!isAuthenticated && !token) {
    window.location.href = 'http://localhost:3000/login';
    return null;
  }

  return children;
}
