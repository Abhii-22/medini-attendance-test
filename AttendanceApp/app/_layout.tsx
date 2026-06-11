import React, { useState, createContext, useContext, useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { AttendanceProvider } from '@/constants/AttendanceContext';
import LoginScreen from '@/app/login'; 

// 🌐 Your Computer's Wi-Fi IPv4 Network Portal Coordinate
export const API_BASE_URL = 'http://192.168.1.10:5000/api';

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: any | null;
  isAdmin: boolean;
  login: (user: any, isAdminMode: boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

function InitialLayoutProtection() {
  const { isAuthenticated, isAdmin } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  useEffect(() => {
    setIsNavigationReady(true);
  }, []);

  useEffect(() => {
    if (!isNavigationReady) return;

    const inTabsGroup = segments[0] === '(tabs)';
    const inAdminPage = segments[0] === 'admin';
    const inLoginPage = segments[0] === 'login';

    if (!isAuthenticated) {
      if (!inLoginPage) {
        router.replace('/login');
      }
    } else {
      if (isAdmin) {
        if (!inAdminPage) {
          router.replace('/admin');
        }
      } else {
        if (!inTabsGroup) {
          router.replace('/(tabs)'); 
        }
      }
    }
  }, [isAuthenticated, isAdmin, segments, isNavigationReady]);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <Slot />;
}

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const login = (user: any, isAdminMode: boolean) => {
    setCurrentUser(user);
    setIsAdmin(isAdminMode);
    setIsAuthenticated(true);
  };

  const logout = () => {
    setCurrentUser(null);
    setIsAdmin(false);
    setIsAuthenticated(false);
  };

  return (
    <AttendanceProvider>
      <AuthContext.Provider value={{ isAuthenticated, currentUser, isAdmin, login, logout }}>
        <InitialLayoutProtection />
      </AuthContext.Provider>
    </AttendanceProvider>
  );
}