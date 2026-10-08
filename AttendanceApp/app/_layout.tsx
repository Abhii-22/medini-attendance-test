import React, { useState, createContext, useContext, useEffect } from "react";

import { Stack, useRouter, useSegments } from "expo-router";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { View, ActivityIndicator, AppState } from "react-native";

import { SafeAreaProvider } from "react-native-safe-area-context";

import { AttendanceProvider } from "@/constants/AttendanceContext";

export const API_BASE_URL = "https://attentdanceapi.techvruddhi.com/api";
// export const API_BASE_URL = "http://192.168.1.13:5000/api";

const SESSION_KEYS = [
  "@current_user",
  "@is_admin",
  "@admin_target_route",
  "@session_key",
];

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: any | null;
  isAdmin: boolean;
  adminTargetRoute: "admin" | "adminView" | null;

  login: (
    user: any,
    isAdminMode: boolean,
    targetRoute?: "admin" | "adminView",
    sessionKey?: string,
  ) => void;

  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

/*
 * ASKS THE SERVER IF THE SAVED SESSION IS STILL VALID
 * Returns false ONLY when the server clearly says the password changed
 * (or the account no longer exists). Offline, timeout or server error
 * returns true so the user is never logged out by accident.
 */
const isSessionStillValid = async (
  user: any,
  targetRoute: "admin" | "adminView" | null,
  sessionKey: string | null,
): Promise<boolean> => {
  const loginMode =
    targetRoute === "admin"
      ? "ADMIN_PANEL"
      : targetRoute === "adminView"
        ? "ADMIN_VIEW"
        : "EMPLOYEE";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${API_BASE_URL}/auth/validate-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ email: user?.email, loginMode, sessionKey }),
    });

    if (!response.ok) return true; // server problem: keep the session

    const data = await response.json();
    return data.valid !== false;
  } catch {
    return true; // offline or timeout: keep the session
  } finally {
    clearTimeout(timeoutId);
  }
};

function InitialLayoutProtection() {
  const { isAuthenticated, currentUser, isAdmin, adminTargetRoute } = useAuth();

  const segments = useSegments();
  const router = useRouter();

  const [isNavigationReady, setIsNavigationReady] = useState(false);

  useEffect(() => {
    setIsNavigationReady(true);
  }, []);

  useEffect(() => {
    if (!isNavigationReady) {
      return;
    }

    const currentSegment = segments[0] as string | undefined;

    const inTabsGroup = currentSegment === "(tabs)";
    const inAdminPage = currentSegment === "admin";
    const inAdminViewPage = currentSegment === "adminView";
    const inLoginPage = currentSegment === "login";

    /*
     * NOT AUTHENTICATED
     */
    if (!isAuthenticated) {
      if (!inLoginPage) {
        router.replace("/login");
      }

      return;
    }

    /*
     * AUTHENTICATED
     */

    const rolesArray =
      currentUser && Array.isArray(currentUser.role)
        ? currentUser.role
        : currentUser?.role
          ? [currentUser.role]
          : [];

    /*
     * ADMIN VIEW
     */
    if (adminTargetRoute === "adminView" || rolesArray.includes("ADMIN_VIEW")) {
      if (!inAdminViewPage) {
        router.replace("/adminView");
      }

      return;
    }

    /*
     * MASTER / ADMIN
     */
    if (
      adminTargetRoute === "admin" ||
      isAdmin ||
      rolesArray.includes("MASTER")
    ) {
      if (!inAdminPage) {
        router.replace("/admin");
      }

      return;
    }

    /*
     * NORMAL USER
     */
    if (!inTabsGroup) {
      router.replace("/(tabs)");
    }
  }, [
    isAuthenticated,
    isAdmin,
    adminTargetRoute,
    currentUser,
    segments,
    isNavigationReady,
  ]);

  if (!isNavigationReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#F8FAFC",
        }}
      >
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="login" />

      <Stack.Screen name="(tabs)" />

      <Stack.Screen name="admin" />

      <Stack.Screen name="adminView" />
    </Stack>
  );
}

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [currentUser, setCurrentUser] = useState<any | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);

  const [adminTargetRoute, setAdminTargetRoute] = useState<
    "admin" | "adminView" | null
  >(null);

  const [sessionKey, setSessionKey] = useState<string | null>(null);

  const [isInitializing, setIsInitializing] = useState(true);

  /*
   * LOAD SAVED SESSION (and check it against the server)
   */
  useEffect(() => {
    const loadStoredSession = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("@current_user");

        const storedIsAdmin = await AsyncStorage.getItem("@is_admin");

        const storedTargetRoute = await AsyncStorage.getItem(
          "@admin_target_route",
        );

        const storedSessionKey = await AsyncStorage.getItem("@session_key");

        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);

          const route =
            storedTargetRoute === "admin" || storedTargetRoute === "adminView"
              ? storedTargetRoute
              : null;

          // Password changed since last login? Then do not restore the session.
          const valid = await isSessionStillValid(
            parsedUser,
            route,
            storedSessionKey,
          );

          if (!valid) {
            await AsyncStorage.multiRemove(SESSION_KEYS);
            return; // stays logged out and lands on the login page
          }

          setCurrentUser(parsedUser);

          setIsAdmin(storedIsAdmin === "true");

          setAdminTargetRoute(route);

          setSessionKey(storedSessionKey);

          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("Failed to load stored session:", error);

        // Clear corrupted session
        await AsyncStorage.multiRemove(SESSION_KEYS);
      } finally {
        setIsInitializing(false);
      }
    };

    loadStoredSession();
  }, []);

  /*
   * LOGIN
   */
  const login = async (
    user: any,
    isAdminMode: boolean,
    targetRoute?: "admin" | "adminView",
    newSessionKey?: string,
  ) => {
    const resolvedRoute = targetRoute || (isAdminMode ? "admin" : null);

    setCurrentUser(user);

    setIsAdmin(isAdminMode);

    setAdminTargetRoute(resolvedRoute);

    setSessionKey(newSessionKey || null);

    setIsAuthenticated(true);

    try {
      await AsyncStorage.setItem("@current_user", JSON.stringify(user));

      await AsyncStorage.setItem("@is_admin", String(isAdminMode));

      if (newSessionKey) {
        await AsyncStorage.setItem("@session_key", newSessionKey);
      }

      if (resolvedRoute) {
        await AsyncStorage.setItem("@admin_target_route", resolvedRoute);
      } else {
        await AsyncStorage.removeItem("@admin_target_route");
      }
    } catch (error) {
      console.error("Failed to save session:", error);
    }
  };

  /*
   * LOGOUT
   */
  const logout = async () => {
    setCurrentUser(null);

    setIsAdmin(false);

    setAdminTargetRoute(null);

    setSessionKey(null);

    setIsAuthenticated(false);

    try {
      await AsyncStorage.multiRemove(SESSION_KEYS);
    } catch (error) {
      console.error("Failed to clear session:", error);
    }
  };

  /*
   * RE-CHECK WHEN THE APP COMES BACK TO THE FOREGROUND
   * Covers the case where the app stays open in the background
   * while the password is changed.
   * (Must stay ABOVE the early return below so hooks keep a stable order.)
   */
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    const subscription = AppState.addEventListener("change", async (state) => {
      if (state !== "active") return;

      const valid = await isSessionStillValid(
        currentUser,
        adminTargetRoute,
        sessionKey,
      );

      if (!valid) {
        logout();
      }
    });

    return () => subscription.remove();
  }, [isAuthenticated, currentUser, adminTargetRoute, sessionKey]);

  /*
   * INITIALIZATION
   */
  if (isInitializing) {
    return (
      <SafeAreaProvider>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#F8FAFC",
          }}
        >
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AttendanceProvider>
        <AuthContext.Provider
          value={{
            isAuthenticated,
            currentUser,
            isAdmin,
            adminTargetRoute,
            login,
            logout,
          }}
        >
          <InitialLayoutProtection />
        </AuthContext.Provider>
      </AttendanceProvider>
    </SafeAreaProvider>
  );
}