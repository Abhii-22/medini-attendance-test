import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, API_BASE_URL } from './_layout'; // Safely import Auth hook and your Wi-Fi IP URL

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  
  const [loginMode, setLoginMode] = useState<'EMPLOYEE' | 'ADMIN'>('EMPLOYEE');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAuthenticationSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Incomplete Fields', 'Please fill out your credentials.');
      return;
    }

    setIsLoading(true);

    try {
      // Direct network API call to your MongoDB Atlas Cloud backend
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
          loginMode: loginMode,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Authenticate inside the root layout context via backend payload response
        login(result.user, result.isAdmin);
        
        setEmail('');
        setPassword('');
      } else {
        Alert.alert('Access Denied 🔐', result.message || 'Invalid credentials matching this context.');
      }
    } catch (error) {
      console.error('Login Network Error:', error);
      Alert.alert(
        'Connection Error 📡', 
        'Could not reach the attendance server. Verify your computer server is running and both devices are on the same Wi-Fi network.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.brandContainer}>
        <Text style={styles.brandLogo}>🛡️</Text>
        <Text style={styles.brandName}>Employee Attendance</Text>
        <Text style={styles.brandSubtext}>Cloud-Synchronized Management Hub</Text>
      </View>

      {/* Mode Selection Tabs */}
      <View style={styles.tabToggleRow}>
        <TouchableOpacity 
          style={[styles.toggleTab, loginMode === 'EMPLOYEE' && styles.activeToggleTab]} 
          onPress={() => setLoginMode('EMPLOYEE')}
          disabled={isLoading}
        >
          <Text style={[styles.tabText, loginMode === 'EMPLOYEE' && styles.activeTabText]}>Employee</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.toggleTab, loginMode === 'ADMIN' && styles.activeToggleTab]} 
          onPress={() => setLoginMode('ADMIN')}
          disabled={isLoading}
        >
          <Text style={[styles.tabText, loginMode === 'ADMIN' && styles.activeTabText]}>Admin Panel</Text>
        </TouchableOpacity>
      </View>

      {/* Input Credentials Form Box */}
      <View style={styles.authFormCard}>
        <Text style={styles.formContextTitle}>
          {loginMode === 'ADMIN' ? 'Administrative Entry Gateway' : 'Sign in to Log Daily Attendance'}
        </Text>

        <Text style={styles.inputLabel}>Official Email</Text>
        <TextInput 
          style={styles.inputField}
          value={email}
          onChangeText={setEmail}
          placeholder={loginMode === 'ADMIN' ? 'admin@medini.com' : 'name@company.com'}
          placeholderTextColor="#A0AEC0"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isLoading}
        />

        <Text style={styles.inputLabel}>Secure Password</Text>
        <TextInput 
          style={styles.inputField}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor="#A0AEC0"
          secureTextEntry
          autoCapitalize="none"
          editable={!isLoading}
        />

        <TouchableOpacity 
          style={[styles.primaryAuthBtn, isLoading && { opacity: 0.6 }]} 
          activeOpacity={0.8} 
          onPress={handleAuthenticationSubmit}
          disabled={isLoading}
        >
          <Text style={styles.primaryAuthBtnText}>
            {isLoading ? 'Verifying... ⏳' : 'Secure Login 🔐'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA', justifyContent: 'center', paddingHorizontal: 24 },
  brandContainer: { alignItems: 'center', marginBottom: 35 },
  brandLogo: { fontSize: 44, marginBottom: 10 },
  brandName: { fontSize: 24, fontWeight: '800', color: '#1A202C' },
  brandSubtext: { fontSize: 13, color: '#718096', marginTop: 4, fontWeight: '500' },
  tabToggleRow: { flexDirection: 'row', backgroundColor: '#E2E8F0', padding: 4, borderRadius: 12, marginBottom: 16 },
  toggleTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  activeToggleTab: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '700', color: '#718096' },
  activeTabText: { color: '#007AFF' },
  authFormCard: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 24, shadowColor: '#1A202C', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 4 },
  formContextTitle: { fontSize: 15, fontWeight: '700', color: '#4A5568', textAlign: 'center', marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#718096', marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.3 },
  inputField: { backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: '#2D3748' },
  primaryAuthBtn: { backgroundColor: '#007AFF', paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 25, shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
  primaryAuthBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }
});