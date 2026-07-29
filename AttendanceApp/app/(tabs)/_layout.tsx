import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerShadowVisible: false,
        tabBarStyle: { 
          // 🚀 Dynamically adjusts tab bar height based on bottom navigation buttons/gesture bar
          height: 60 + insets.bottom, 
          paddingBottom: 8 + insets.bottom,
          paddingTop: 6,
        },
      }}
    >
      {/* 🏠 Home Tab */}
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Home', 
          headerTitle: 'Dashboard', 
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={20} color={color} />
          ) 
        }} 
      />

      {/* 📸 Attendance Tab */}
      <Tabs.Screen 
        name="attendance" 
        options={{ 
          title: 'Attendance', 
          headerTitle: 'Mark Attendance', 
          tabBarIcon: ({ color }) => (
            <Ionicons name="camera" size={22} color={color} />
          ) 
        }} 
      />

      {/* 📅 History Tab */}
      <Tabs.Screen 
        name="history" 
        options={{ 
          title: 'History', 
          headerTitle: 'Attendance Logs', 
          tabBarIcon: ({ color }) => (
            <Ionicons name="calendar" size={20} color={color} />
          ) 
        }} 
      />

      {/* 👤 Profile Tab */}
      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: 'Profile', 
          headerTitle: 'My Profile', 
          tabBarIcon: ({ color }) => (
            <Ionicons name="person" size={20} color={color} />
          ) 
        }} 
      />

      {/* 🛑 HIDDEN ABSOLUTE BLOCKER FOR THE EXPLORE TAB */}
      <Tabs.Screen 
        name="explore" 
        options={{ 
          href: null 
        }} 
      />
    </Tabs>
  );
}