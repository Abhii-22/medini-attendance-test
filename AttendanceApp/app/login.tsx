import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, API_BASE_URL } from './_layout'; 

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  
  const [loginMode, setLoginMode] = useState<'EMPLOYEE' | 'ADMIN_VIEW' | 'ADMIN_PANEL'>('EMPLOYEE');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAuthenticationSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Incomplete Fields', 'Please fill out your credentials.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
          loginMode: loginMode, 
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const rolesArray: string[] = result.user && Array.isArray(result.user.role)
          ? result.user.role
          : result.user?.role
            ? [result.user.role]
            : [];
        
        if (loginMode === 'EMPLOYEE' && rolesArray.includes('ADMIN_VIEW') && !rolesArray.includes('EMPLOYEE')) {
          Alert.alert(
            'Access Denied',
            'This account has Administrative View status. Please use the "Admin View" tab to sign in.'
          );
          setIsLoading(false);
          return;
        }

        if (loginMode === 'ADMIN_VIEW' && !rolesArray.includes('ADMIN_VIEW')) {
          Alert.alert(
            'Access Denied',
            'This account does not have supervisor monitoring clearance.'
          );
          setIsLoading(false);
          return;
        }

        if (loginMode === 'ADMIN_VIEW') {
          login(result.user, result.isAdmin, 'adminView');
        } else if (loginMode === 'ADMIN_PANEL') {
          login(result.user, result.isAdmin, 'admin');
        } else {
          login(result.user, result.isAdmin);
        }
        
        setEmail('');
        setPassword('');
      } else {
        Alert.alert('Access Denied', result.message || 'Invalid credentials matching this context.');
      }
    } catch (error) {
      console.error('Login Network Error:', error);
      Alert.alert('Connection Error', 'Could not reach the attendance server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.brandContainer}>
        <View style={styles.logoBadgeFrame}>
          <Image 
            source={require('../assets/images/medini new logo.jpeg')} 
            style={styles.mediniLogoImage} 
            resizeMode="contain"
          />
        </View>
        <Text style={styles.brandName}>Employee Attendance</Text>
        <Text style={styles.brandSubtext}>WELLCOME!!</Text>
      </View>

      <View style={styles.tabToggleRow}>
        <TouchableOpacity style={[styles.toggleTab, loginMode === 'EMPLOYEE' && styles.activeToggleTab]} onPress={() => setLoginMode('EMPLOYEE')} disabled={isLoading}>
          <Text style={[styles.tabText, loginMode === 'EMPLOYEE' && styles.activeTabText]}>Employee</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleTab, loginMode === 'ADMIN_VIEW' && styles.activeToggleTab]} onPress={() => setLoginMode('ADMIN_VIEW')} disabled={isLoading}>
          <Text style={[styles.tabText, loginMode === 'ADMIN_VIEW' && styles.activeTabText]}>Admin View</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleTab, loginMode === 'ADMIN_PANEL' && styles.activeToggleTab]} onPress={() => setLoginMode('ADMIN_PANEL')} disabled={isLoading}>
          <Text style={[styles.tabText, loginMode === 'ADMIN_PANEL' && styles.activeTabText]}>Admin Panel</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.authFormCard}>
        <Text style={styles.formContextTitle}>
          {loginMode === 'EMPLOYEE' ? 'Sign in to Log Daily Attendance' : loginMode === 'ADMIN_VIEW' ? 'Administrative Read-Only View Gateway' : 'Administrative Management Gateway'}
        </Text>

        <Text style={styles.inputLabel}>Official Email</Text>
        <TextInput style={styles.inputField} value={email} onChangeText={setEmail} placeholder={loginMode === 'EMPLOYEE' ? 'name@company.com' : 'admin@medini.com'} placeholderTextColor="#A0AEC0" keyboardType="email-address" autoCapitalize="none" editable={!isLoading} />

        <Text style={styles.inputLabel}>Secure Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput 
            style={styles.passwordInputField} 
            value={password} 
            onChangeText={setPassword} 
            placeholder="••••••••" 
            placeholderTextColor="#A0AEC0" 
            secureTextEntry={!showPassword} 
            autoCapitalize="none" 
            editable={!isLoading} 
          />
          <TouchableOpacity 
            style={styles.eyeBtn} 
            onPress={() => setShowPassword(!showPassword)} 
            disabled={isLoading}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons 
              name={showPassword ? "eye-outline" : "eye-off-outline"} 
              size={20} 
              color="#718096" 
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.primaryAuthBtn, isLoading && { opacity: 0.6 }]} activeOpacity={0.8} onPress={handleAuthenticationSubmit} disabled={isLoading}>
          <Text style={styles.primaryAuthBtnText}>{isLoading ? 'Verifying...' : 'Secure Login'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA', justifyContent: 'center', paddingHorizontal: 16 },
  brandContainer: { alignItems: 'center', marginBottom: 35 },
  logoBadgeFrame: { width: 92, height: 92, borderRadius: 22, backgroundColor: '#FFFFFF', padding: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  mediniLogoImage: { width: '100%', height: '100%' },
  brandName: { fontSize: 24, fontWeight: '800', color: '#1A202C' },
  brandSubtext: { fontSize: 13, color: '#718096', marginTop: 4, fontWeight: '500' },
  tabToggleRow: { flexDirection: 'row', backgroundColor: '#E2E8F0', padding: 4, borderRadius: 12, marginBottom: 16 },
  toggleTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  activeToggleTab: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 11, fontWeight: '700', color: '#718096' }, 
  activeTabText: { color: '#007AFF' },
  authFormCard: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 24, shadowColor: '#1A202C', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 4 },
  formContextTitle: { fontSize: 14, fontWeight: '700', color: '#4A5568', textAlign: 'center', marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#718096', marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.3 },
  inputField: { backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: '#2D3748' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12 },
  passwordInputField: { flex: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: '#2D3748' },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 14, justifyContent: 'center', alignItems: 'center' },
  primaryAuthBtn: { backgroundColor: '#007AFF', paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 25, shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
  primaryAuthBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }
});