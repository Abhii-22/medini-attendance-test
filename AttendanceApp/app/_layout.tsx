import React, { useState, createContext, useContext, useEffect } from "react";

import { Stack, useRouter, useSegments } from "expo-router";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { View, ActivityIndicator } from "react-native";

import { SafeAreaProvider } from "react-native-safe-area-context";

import { AttendanceProvider } from "@/constants/AttendanceContext";

// export const API_BASE_URL = "https://attentdanceapi.techvruddhi.com/api";
export const API_BASE_URL = "http://192.168.1.5:5000/api";

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: any | null;
  isAdmin: boolean;
  adminTargetRoute: "admin" | "adminView" | null;

  login: (
    user: any,
    isAdminMode: boolean,
    targetRoute?: "admin" | "adminView",
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

  const [isInitializing, setIsInitializing] = useState(true);

  /*
   * LOAD SAVED SESSION
   */
  useEffect(() => {
    const loadStoredSession = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("@current_user");

        const storedIsAdmin = await AsyncStorage.getItem("@is_admin");

        const storedTargetRoute = await AsyncStorage.getItem(
          "@admin_target_route",
        );

        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);

          setCurrentUser(parsedUser);

          setIsAdmin(storedIsAdmin === "true");

          if (
            storedTargetRoute === "admin" ||
            storedTargetRoute === "adminView"
          ) {
            setAdminTargetRoute(storedTargetRoute);
          } else {
            setAdminTargetRoute(null);
          }

          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("Failed to load stored session:", error);

        // Clear corrupted session
        await AsyncStorage.multiRemove([
          "@current_user",
          "@is_admin",
          "@admin_target_route",
        ]);
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
  ) => {
    const resolvedRoute = targetRoute || (isAdminMode ? "admin" : null);

    setCurrentUser(user);

    setIsAdmin(isAdminMode);

    setAdminTargetRoute(resolvedRoute);

    setIsAuthenticated(true);

    try {
      await AsyncStorage.setItem("@current_user", JSON.stringify(user));

      await AsyncStorage.setItem("@is_admin", String(isAdminMode));

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

    setIsAuthenticated(false);

    try {
      await AsyncStorage.multiRemove([
        "@current_user",
        "@is_admin",
        "@admin_target_route",
      ]);
    } catch (error) {
      console.error("Failed to clear session:", error);
    }
  };

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
