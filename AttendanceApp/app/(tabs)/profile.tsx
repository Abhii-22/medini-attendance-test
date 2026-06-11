import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useAuth } from '../_layout';

export default function ProfileScreen() {
  const { currentUser, logout } = useAuth();

  // Safely extract active identity credentials
  const employeeName = currentUser?.name || 'Employee';
  const employeeRole = currentUser?.designation || 'Staff Member';
  const employeeId = currentUser?.employeeId || 'N/A';
  const employeeEmail = currentUser?.email || 'N/A';

  const handleLogoutPress = () => {
    Alert.alert(
      'Sign Out 🚪',
      'Are you sure you want to log out of your session?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: () => logout() }
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      
      {/* 🟦 PROFILE AVATAR BANNER CARDS */}
      <View style={styles.profileHeroSection}>
        <View style={styles.largeAvatarCircle}>
          <Text style={styles.largeAvatarText}>{employeeName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.heroProfileName}>{employeeName}</Text>
        <Text style={styles.heroProfileRole}>{employeeRole}</Text>
        
        <View style={styles.statusPillBadge}>
          <View style={styles.activeDot} />
          <Text style={styles.statusPillText}>Admin Verified Account</Text>
        </View>
      </View>

      {/* 📊 CREDENTIAL INFORMATION DETAILS CARD */}
      <Text style={styles.sectionHeadingLabel}>Account Metadata</Text>
      <View style={styles.infoBlockContainer}>
        
        <View style={styles.infoRowItem}>
          <Text style={styles.infoItemKey}>Employee ID Reference</Text>
          <Text style={styles.infoItemValue}>{employeeId}</Text>
        </View>

        <View style={styles.infoRowItem}>
          <Text style={styles.infoItemKey}>Assigned Designation</Text>
          <Text style={styles.infoItemValue}>{employeeRole}</Text>
        </View>

        <View style={[styles.infoRowItem, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoItemKey}>Linked Communication Email</Text>
          <Text style={[styles.infoItemValue, { fontSize: 14, fontWeight: '500', color: '#4A5568' }]}>
            {employeeEmail}
          </Text>
        </View>

      </View>

      {/* 🛡️ APP SETTINGS SUMMARY PANEL */}
      <Text style={styles.sectionHeadingLabel}>System Environment</Text>
      <View style={styles.infoBlockContainer}>
        
        <View style={styles.infoRowItem}>
          <Text style={styles.infoItemKey}>System Platform Connection</Text>
          <Text style={[styles.infoItemValue, { color: '#3182CE' }]}>Medini Cloud Engine</Text>
        </View>

        <View style={[styles.infoRowItem, { borderBottomWidth: 0 }]}>
          <Text style={styles.infoItemKey}>Operational Database</Text>
          <Text style={[styles.infoItemValue, { color: '#38A169' }]}>MongoDB Atlas Live</Text>
        </View>

      </View>

      <View style={styles.lockNoticeBox}>
        <Text style={styles.lockNoticeText}>
          🔒 This profile is verified and locked by system administrators. Please reach out to HR if any official directory data changes are required.
        </Text>
      </View>

      {/* 🚪 LOGOUT TERMINATION TRIGGER BUTTON */}
      <TouchableOpacity 
        style={styles.terminationSignOutBtn} 
        activeOpacity={0.85}
        onPress={handleLogoutPress}
      >
        <Text style={styles.terminationSignOutBtnText}>Sign Out From Corporate Workspace 🚪</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA', paddingHorizontal: 20, paddingTop: 20 },
  
  // Profile Hero Header Block Styling
  profileHeroSection: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10, elevation: 2, marginBottom: 25 },
  largeAvatarCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#EBF4FF', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#B3D7FF', marginBottom: 14 },
  largeAvatarText: { color: '#007AFF', fontSize: 32, fontWeight: '800' },
  heroProfileName: { fontSize: 22, fontWeight: '800', color: '#1A202C' },
  heroProfileRole: { fontSize: 14, fontWeight: '600', color: '#718096', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  // Account Status Pill Styling
  statusPillBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EBF8FF', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginTop: 12, borderWidth: 1, borderColor: '#BEE3F8' },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3182CE', marginRight: 6 },
  statusPillText: { color: '#2B6CB0', fontSize: 11, fontWeight: '800' },

  // Section Typography Labels Styling
  sectionHeadingLabel: { fontSize: 13, fontWeight: '800', color: '#2B6CB0', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12, paddingLeft: 2 },

  // Information Row Grid Layout Styling
  infoBlockContainer: { backgroundColor: '#FFFFFF', paddingHorizontal: 18, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 2, marginBottom: 25 },
  infoRowItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#EDF2F7' },
  infoItemKey: { fontSize: 11, fontWeight: '700', color: '#A0AEC0', textTransform: 'uppercase', letterSpacing: 0.3 },
  infoItemValue: { fontSize: 15, fontWeight: '700', color: '#2D3748', marginTop: 4 },

  // Read-only Lock Warning Banner Style
  lockNoticeBox: { backgroundColor: '#EDF2F7', padding: 14, borderRadius: 16, marginBottom: 25, borderWidth: 1, borderColor: '#E2E8F0' },
  lockNoticeText: { color: '#4A5568', fontSize: 12, lineHeight: 18, fontWeight: '600', textAlign: 'center' },

  // Session Termination Interactive SignOut Button Styling
  terminationSignOutBtn: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FED7D7', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 6, elevation: 1 },
  terminationSignOutBtnText: { color: '#E53E3E', fontSize: 15, fontWeight: '700' }
});