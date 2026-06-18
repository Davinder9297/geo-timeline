import React from 'react';
import { useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';

const App: React.FC = () => {
  const { user } = useAuth();
  return user?.isAuthenticated ? <Dashboard /> : <Login />;
};

export default App;
