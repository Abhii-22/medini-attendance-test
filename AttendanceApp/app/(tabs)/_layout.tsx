import { Tabs } from 'expo-router';
import React from 'react';
// 🌟 Native React Vector Icons
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerShadowVisible: false,
        tabBarStyle: { height: 60, paddingBottom: 8 },
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
      {/* This href: null line completely deletes the button from your layout screen */}
      <Tabs.Screen 
        name="explore" 
        options={{ 
          href: null 
        }} 
      />
    </Tabs>
  );
}