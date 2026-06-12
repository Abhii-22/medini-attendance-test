import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useAuth } from '../_layout';
import { Ionicons, Feather } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { currentUser, logout } = useAuth();

  const employeeName = currentUser?.name || 'Employee';
  const employeeRole = currentUser?.designation || 'Staff Member';
  const employeeId = currentUser?.employeeId || 'N/A';
  const employeeEmail = currentUser?.email || 'N/A';

  const handleLogoutPress = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to log out of your session?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: () => logout() }
      ]
    );
  };

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false} 
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      
      {/* 🟦 PROFILE AVATAR HERO SECTION */}
      <View style={styles.profileHeroSection}>
        <View style={styles.largeAvatarCircle}>
          <Text style={styles.largeAvatarText}>{employeeName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.heroProfileName} numberOfLines={1}>{employeeName}</Text>
        <Text style={styles.heroProfileRole}>{employeeRole}</Text>
        
        <View style={styles.statusPillBadge}>
          <Ionicons name="shield-checkmark" size={12} color="#3182CE" style={{ marginRight: 4 }} />
          <Text style={styles.statusPillText}>Verified Profile</Text>
        </View>
      </View>

      {/* 📊 ACCOUNT DATA INFORMATION CARD */}
      <View style={styles.sectionHeaderRowInline}>
        <Ionicons name="person-outline" size={14} color="#2B6CB0" />
        <Text style={styles.sectionHeadingLabel}>Account Profile</Text>
      </View>
      
      <View style={styles.infoBlockContainer}>
        <View style={styles.infoRowItem}>
          <View style={styles.infoIconWrapper}>
            <Ionicons name="id-card-outline" size={16} color="#718096" />
          </View>
          <View style={styles.infoTextFrame}>
            <Text style={styles.infoItemKey}>Employee ID Reference</Text>
            <Text style={styles.infoItemValue}>{employeeId}</Text>
          </View>
        </View>

        <View style={styles.infoRowItem}>
          <View style={styles.infoIconWrapper}>
            <Feather name="briefcase" size={15} color="#718096" />
          </View>
          <View style={styles.infoTextFrame}>
            <Text style={styles.infoItemKey}>Assigned Designation</Text>
            <Text style={styles.infoItemValue}>{employeeRole}</Text>
          </View>
        </View>

        <View style={[styles.infoRowItem, { borderBottomWidth: 0 }]}>
          <View style={styles.infoIconWrapper}>
            <Ionicons name="mail-outline" size={16} color="#718096" />
          </View>
          <View style={styles.infoTextFrame}>
            <Text style={styles.inputItemKeyLabel}>Communication Email</Text>
            <Text style={styles.infoItemValueEmail}>{employeeEmail}</Text>
          </View>
        </View>
      </View>

      <View style={styles.lockNoticeBox}>
        <Feather name="lock" size={12} color="#718096" style={{ marginRight: 6 }} />
        <Text style={styles.lockNoticeText}>Locked Profile (Read-Only Context)</Text>
      </View>

      {/* 🚪 LOGOUT TERMINATION INTERACTIVE BUTTON */}
      <TouchableOpacity 
        style={styles.terminationSignOutBtn} 
        activeOpacity={0.85}
        onPress={handleLogoutPress}
      >
        <Ionicons name="log-out-outline" size={16} color="#E53E3E" style={{ marginRight: 6 }} />
        <Text style={styles.terminationSignOutBtnText}>Sign Out From Session</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingTop: 20 },
  
  profileHeroSection: { backgroundColor: '#FFFFFF', paddingVertical: 24, paddingHorizontal: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1, marginBottom: 20 },
  largeAvatarCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#EBF4FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#B3D7FF', marginBottom: 12 },
  largeAvatarText: { color: '#007AFF', fontSize: 28, fontWeight: '800' },
  heroProfileName: { fontSize: 20, fontWeight: '800', color: '#1A202C', textAlign: 'center', width: '90%' },
  heroProfileRole: { fontSize: 12, fontWeight: '700', color: '#718096', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  statusPillBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EBF8FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginTop: 10, borderWidth: 1, borderColor: '#BEE3F8' },
  statusPillText: { color: '#2B6CB0', fontSize: 11, fontWeight: '800' },

  sectionHeaderRowInline: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingLeft: 2 },
  sectionHeadingLabel: { fontSize: 12, fontWeight: '800', color: '#4A5568', textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 6 },

  infoBlockContainer: { backgroundColor: '#FFFFFF', paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1, marginBottom: 20 },
  infoRowItem: { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EDF2F7' },
  infoIconWrapper: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F7FAFC', borderColor: '#E2E8F0', borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  infoTextFrame: { flex: 1 },
  infoItemKey: { fontSize: 11, fontWeight: '700', color: '#A0AEC0', textTransform: 'uppercase', letterSpacing: 0.2 },
  inputItemKeyLabel: { fontSize: 11, fontWeight: '700', color: '#A0AEC0', textTransform: 'uppercase', letterSpacing: 0.2 },
  infoItemValue: { fontSize: 14, fontWeight: '700', color: '#2D3748', marginTop: 1 },
  infoItemValueEmail: { fontSize: 14, fontWeight: '700', color: '#4A5568', marginTop: 1 },

  lockNoticeBox: { flexDirection: 'row', backgroundColor: '#EDF2F7', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  lockNoticeText: { color: '#718096', fontSize: 11, fontWeight: '600', textAlign: 'center' },

  terminationSignOutBtn: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FED7D7', paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', shadowColor: '#1A202C', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1 },
  terminationSignOutBtnText: { color: '#E53E3E', fontSize: 14, fontWeight: '700' }
});