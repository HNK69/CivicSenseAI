import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import router from './routes.jsx';

/**
 * App — root component.
 * 1. AuthProvider   — provides mock officer session to all children.
 * 2. RouterProvider — mounts the centralized router from routes.jsx.
 */
function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
