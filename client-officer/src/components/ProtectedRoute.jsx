import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useContext(AuthContext);
  const token = localStorage.getItem('officer_token');

  if (!isAuthenticated && !token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
