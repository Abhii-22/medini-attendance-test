import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

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
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Home', 
          headerTitle: 'Dashboard', 
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏠</Text> 
        }} 
      />
      <Tabs.Screen 
        name="attendance" 
        options={{ 
          title: 'Attendance', 
          headerTitle: 'Mark Attendance', 
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📸</Text> 
        }} 
      />
      <Tabs.Screen 
        name="history" 
        options={{ 
          title: 'History', 
          headerTitle: 'Attendance Logs', 
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📅</Text> 
        }} 
      />
      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: 'Profile', 
          headerTitle: 'My Profile', 
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👤</Text> 
        }} 
      />
    </Tabs>
  );
}