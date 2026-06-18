import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserState } from '../types';

const AuthContext = createContext<{
  user: UserState | null;
  login: (companyId: string, token: string) => void;
  logout: () => void;
} | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserState | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('crm_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = (companyId: string, token: string) => {
    const newUser: UserState = { isAuthenticated: true, companyId, token };
    setUser(newUser);
    localStorage.setItem('crm_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('crm_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
