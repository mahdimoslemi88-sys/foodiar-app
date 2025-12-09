import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User } from '../types';

// Initial default users
const initialUsers: User[] = [
  { id: '1', name: 'مدیر سیستم', username: 'manager', pin: '1111', role: 'manager' },
  { id: '2', name: 'صندوق‌دار', username: 'cashier', pin: '2222', role: 'cashier' },
  { id: '3', name: 'سرآشپز', username: 'chef', pin: '3333', role: 'chef' },
];

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const item = window.localStorage.getItem('foodyar_currentUser');
      return item ? JSON.parse(item) : null;
    } catch (error) {
      return null;
    }
  });

  const [users, setUsers] = useState<User[]>(() => {
    try {
      const item = window.localStorage.getItem('foodyar_users');
      return item ? JSON.parse(item) : initialUsers;
    } catch (error) {
      return initialUsers;
    }
  });

  useEffect(() => {
    try {
      if (currentUser) {
        window.localStorage.setItem('foodyar_currentUser', JSON.stringify(currentUser));
      } else {
        window.localStorage.removeItem('foodyar_currentUser');
      }
    } catch (error) {
      console.error("Failed to save current user to localStorage", error);
    }
  }, [currentUser]);

  useEffect(() => {
    try {
      window.localStorage.setItem('foodyar_users', JSON.stringify(users));
    } catch (error) {
      console.error("Failed to save users to localStorage", error);
    }
  }, [users]);


  const login = (user: User) => {
    setCurrentUser(user);
  };

  const logout = () => {
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, users, setUsers, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
