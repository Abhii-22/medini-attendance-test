import React, { useState, createContext, useContext, useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { AttendanceProvider } from '@/constants/AttendanceContext';

export const API_BASE_URL = 'http://192.168.1.10:5000/api';

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: any | null;
  isAdmin: boolean;
  adminTargetRoute: 'admin' | 'adminView' | null; 
  login: (user: any, isAdminMode: boolean, targetRoute?: 'admin' | 'adminView') => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

function InitialLayoutProtection() {
  const { isAuthenticated, currentUser, isAdmin, adminTargetRoute } = useAuth();
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
    const inAdminViewPage = segments[0] === 'adminView';
    const inLoginPage = segments[0] === 'login';

    if (!isAuthenticated) {
      if (!inLoginPage) {
        router.replace('/login');
      }
    } else {
      if (adminTargetRoute === 'adminView' || currentUser?.role === 'ADMIN_VIEW') {
        if (!inAdminViewPage) router.replace('/adminView');
      } else if (adminTargetRoute === 'admin' || isAdmin) {
        if (!inAdminPage) router.replace('/admin');
      } else {
        if (!inTabsGroup) router.replace('/(tabs)'); 
      }
    }
  }, [isAuthenticated, isAdmin, adminTargetRoute, currentUser, segments, isNavigationReady]);

  if (!isAuthenticated) {
    const LoginScreen = require('@/app/login').default;
    return <LoginScreen />;
  }

  return <Slot />;
}

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminTargetRoute, setAdminTargetRoute] = useState<'admin' | 'adminView' | null>(null);

  const login = (user: any, isAdminMode: boolean, targetRoute?: 'admin' | 'adminView') => {
    setCurrentUser(user);
    setIsAdmin(isAdminMode);
    setAdminTargetRoute(targetRoute || (isAdminMode ? 'admin' : null));
    setIsAuthenticated(true);
  };

  const logout = () => {
    setCurrentUser(null);
    setIsAdmin(false);
    setAdminTargetRoute(null);
    setIsAuthenticated(false);
  };

  return (
    <AttendanceProvider>
      <AuthContext.Provider value={{ isAuthenticated, currentUser, isAdmin, adminTargetRoute, login, logout }}>
        <InitialLayoutProtection />
      </AuthContext.Provider>
    </AttendanceProvider>
  );
}