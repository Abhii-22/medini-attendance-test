import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  Easing,
  ScrollView,
  ActivityIndicator,
  LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, API_BASE_URL } from './_layout';

type LoginMode = 'EMPLOYEE' | 'ADMIN_VIEW' | 'ADMIN_PANEL';

// Light, friendly accent per role. The whole screen softly morphs to it.
const MODE_ORDER: LoginMode[] = ['EMPLOYEE', 'ADMIN_VIEW', 'ADMIN_PANEL'];
const MODES: Record<LoginMode, { label: string; color: string; soft: string; icon: keyof typeof Ionicons.glyphMap }> = {
  EMPLOYEE: { label: 'Employee', color: '#4F8EF7', soft: '#DCEBFF', icon: 'person' },
  ADMIN_VIEW: { label: 'Admin View', color: '#8B7CF6', soft: '#E8E4FF', icon: 'eye' },
  ADMIN_PANEL: { label: 'Admin Panel', color: '#F28B5B', soft: '#FFE6D9', icon: 'shield-checkmark' },
};

const BG = '#F3F8FF';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();

  const [loginMode, setLoginMode] = useState<LoginMode>('EMPLOYEE');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [tabRowWidth, setTabRowWidth] = useState(0);

  /* ------------------------------ ANIMATION VALUES ------------------------------ */
  const brandIn = useRef(new Animated.Value(0)).current;
  const tabsIn = useRef(new Animated.Value(0)).current;
  const cardIn = useRef(new Animated.Value(0)).current;

  const modeAnim = useRef(new Animated.Value(0)).current; // 0 / 1 / 2
  const floatLogo = useRef(new Animated.Value(0)).current; // logo gentle float
  const ripple = useRef(new Animated.Value(0)).current; // soft ring behind logo
  const blobA = useRef(new Animated.Value(0)).current;
  const blobB = useRef(new Animated.Value(0)).current;
  const blobC = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Staggered entrance: logo, then role tabs, then card
    Animated.stagger(140, [
      Animated.spring(brandIn, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
      Animated.spring(tabsIn, { toValue: 1, friction: 8, tension: 50, useNativeDriver: true }),
      Animated.spring(cardIn, { toValue: 1, friction: 8, tension: 45, useNativeDriver: true }),
    ]).start();

    const drift = (v: Animated.Value, ms: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );

    const loops = [
      drift(blobA, 6500),
      drift(blobB, 8000),
      drift(blobC, 7200),
      drift(floatLogo, 2600),
      Animated.loop(
        Animated.timing(ripple, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  const selectMode = (mode: LoginMode) => {
    setLoginMode(mode);
    Animated.spring(modeAnim, {
      toValue: MODE_ORDER.indexOf(mode),
      friction: 8,
      tension: 70,
      useNativeDriver: false,
    }).start();
  };

  const runShake = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 70, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 70, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 70, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 70, useNativeDriver: true }),
    ]).start();
  };

  const accent = modeAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [MODES.EMPLOYEE.color, MODES.ADMIN_VIEW.color, MODES.ADMIN_PANEL.color],
  });
  const accentSoft = modeAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [MODES.EMPLOYEE.soft, MODES.ADMIN_VIEW.soft, MODES.ADMIN_PANEL.soft],
  });

  const pillWidth = tabRowWidth > 0 ? (tabRowWidth - 8) / 3 : 0;
  const pillX = modeAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, pillWidth, pillWidth * 2],
  });

  const rise = (v: Animated.Value, from: number) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }],
  });

  const blobMove = (v: Animated.Value, x: number, y: number) => ({
    transform: [
      { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) },
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, y] }) },
    ],
  });

  /* ------------------------------ LOGIC (UNCHANGED) ------------------------------ */
  const handleAuthenticationSubmit = async () => {
    if (!email || !password) {
      runShake();
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

        // result.sessionKey lets the app detect later if the password was changed
        if (loginMode === 'ADMIN_VIEW') {
          login(result.user, result.isAdmin, 'adminView', result.sessionKey);
        } else if (loginMode === 'ADMIN_PANEL') {
          login(result.user, result.isAdmin, 'admin', result.sessionKey);
        } else {
          login(result.user, result.isAdmin, undefined, result.sessionKey);
        }

        setEmail('');
        setPassword('');
      } else {
        runShake();
        Alert.alert('Access Denied', result.message || 'Invalid credentials matching this context.');
      }
    } catch (error) {
      console.error('Login Network Error:', error);
      Alert.alert('Connection Error', 'Could not reach the attendance server.');
    } finally {
      setIsLoading(false);
    }
  };

  /* ------------------------------ UI ------------------------------ */
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      {/* Soft pastel blobs drifting slowly in the background */}
      <Animated.View style={[styles.blobAWrap, blobMove(blobA, 26, 34)]} pointerEvents="none">
        <Animated.View style={[styles.blobA, { backgroundColor: accentSoft }]} />
      </Animated.View>
      <Animated.View style={[styles.blobBWrap, blobMove(blobB, -30, -24)]} pointerEvents="none">
        <Animated.View style={[styles.blobB, { backgroundColor: accentSoft }]} />
      </Animated.View>
      <Animated.View style={[styles.blobCWrap, blobMove(blobC, 18, -28)]} pointerEvents="none">
        <View style={styles.blobC} />
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* BRAND */}
        <Animated.View style={[styles.brandContainer, rise(brandIn, 24)]}>
          <View style={styles.logoArea}>
            {/* soft ripple ring */}
            <Animated.View
              style={[
                styles.rippleWrap,
                {
                  opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                  transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
                },
              ]}
            >
              <Animated.View style={[styles.ripple, { borderColor: accent }]} />
            </Animated.View>

            <Animated.View
              style={[
                styles.logoFloat,
                { transform: [{ translateY: floatLogo.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] },
              ]}
            >
              <View style={styles.logoBadgeFrame}>
                <Image
                  source={require('../assets/images/medini new logo.jpeg')}
                  style={styles.mediniLogoImage}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>
          </View>

          <Text style={styles.brandName}>Employee Attendance</Text>
          <Text style={styles.brandSubtext}>WELLCOME!!</Text>
        </Animated.View>

        {/* ROLE SWITCH */}
        <Animated.View style={rise(tabsIn, 24)}>
          <View
            style={styles.tabToggleRow}
            onLayout={(e: LayoutChangeEvent) => setTabRowWidth(e.nativeEvent.layout.width)}
          >
            <Animated.View
              style={[
                styles.tabPill,
                { width: pillWidth, backgroundColor: accent, transform: [{ translateX: pillX }] },
              ]}
            />
            {MODE_ORDER.map((mode) => {
              const active = loginMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={styles.toggleTab}
                  onPress={() => selectMode(mode)}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <Ionicons name={MODES[mode].icon} size={15} color={active ? '#FFFFFF' : '#7A88A6'} />
                  <Text style={[styles.tabText, active && styles.activeTabText]} numberOfLines={1}>
                    {MODES[mode].label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* FORM CARD */}
        <Animated.View
          style={[
            styles.authFormCard,
            rise(cardIn, 36),
            { transform: [
                { translateY: cardIn.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) },
                { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) },
            ] },
          ]}
        >
          <Text style={styles.formContextTitle}>
            {loginMode === 'EMPLOYEE'
              ? 'Sign in to Log Daily Attendance'
              : loginMode === 'ADMIN_VIEW'
                ? 'Administrative Read-Only View Gateway'
                : 'Administrative Management Gateway'}
          </Text>

          <Text style={styles.inputLabel}>Official email</Text>
          <Animated.View
            style={[styles.inputShell, { borderColor: focusedField === 'email' ? accent : '#E3EAF5' }]}
          >
            <Ionicons name="mail-outline" size={18} color="#8A97B1" style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              value={email}
              onChangeText={setEmail}
              placeholder={loginMode === 'EMPLOYEE' ? 'name@company.com' : 'admin@medini.com'}
              placeholderTextColor="#A8B3C7"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
            />
          </Animated.View>

          <Text style={styles.inputLabel}>Secure password</Text>
          <Animated.View
            style={[styles.inputShell, { borderColor: focusedField === 'password' ? accent : '#E3EAF5' }]}
          >
            <Ionicons name="lock-closed-outline" size={18} color="#8A97B1" style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#A8B3C7"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!isLoading}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#8A97B1" />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: pressScale }], marginTop: 26 }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleAuthenticationSubmit}
              onPressIn={() => Animated.spring(pressScale, { toValue: 0.96, useNativeDriver: true }).start()}
              onPressOut={() =>
                Animated.spring(pressScale, { toValue: 1, friction: 4, useNativeDriver: true }).start()
              }
              disabled={isLoading}
            >
              <Animated.View
                style={[styles.primaryAuthBtn, { backgroundColor: accent }, isLoading && { opacity: 0.7 }]}
              >
                {isLoading && <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 10 }} />}
                <Text style={styles.primaryAuthBtnText}>{isLoading ? 'Verifying...' : 'Secure Login'}</Text>
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 28 },

  // background blobs
  blobAWrap: { position: 'absolute', top: -70, right: -70 },
  blobA: { width: 240, height: 240, borderRadius: 120, opacity: 0.9 },
  blobBWrap: { position: 'absolute', bottom: -90, left: -80 },
  blobB: { width: 270, height: 270, borderRadius: 135, opacity: 0.75 },
  blobCWrap: { position: 'absolute', top: '42%', right: -40 },
  blobC: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#FFE9F1', opacity: 0.9 },

  brandContainer: { alignItems: 'center', marginBottom: 22 },
  logoArea: { width: 110, height: 110, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  rippleWrap: { position: 'absolute', width: 92, height: 92 },
  ripple: { width: 92, height: 92, borderRadius: 46, borderWidth: 2 },
  logoFloat: { justifyContent: 'center', alignItems: 'center' },
  logoBadgeFrame: {
    width: 92,
    height: 92,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#6B8BC7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  mediniLogoImage: { width: '100%', height: '100%' },

  brandName: { fontSize: 24, fontWeight: '800', color: '#1F2D4A' },
  brandSubtext: { fontSize: 13, color: '#7A88A6', marginTop: 4, fontWeight: '500' },

  tabToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 999,
    marginBottom: 14,
    shadowColor: '#6B8BC7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2,
  },
  tabPill: { position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: 999 },
  toggleTab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  tabText: { fontSize: 11.5, fontWeight: '700', color: '#7A88A6', marginLeft: 5 },
  activeTabText: { color: '#FFFFFF' },

  authFormCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 28,
    shadowColor: '#6B8BC7',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 6,
  },
  formContextTitle: { fontSize: 14, fontWeight: '700', color: '#3B4A68', textAlign: 'center', marginBottom: 12 },

  inputLabel: { fontSize: 12.5, fontWeight: '700', color: '#62708C', marginBottom: 7, marginTop: 14 },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F9FE',
    borderWidth: 1.5,
    borderRadius: 14,
  },
  inputIcon: { marginLeft: 14 },
  inputField: { flex: 1, paddingHorizontal: 10, paddingVertical: 14, fontSize: 15, color: '#1F2D4A' },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 14, justifyContent: 'center', alignItems: 'center' },

  primaryAuthBtn: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAuthBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});