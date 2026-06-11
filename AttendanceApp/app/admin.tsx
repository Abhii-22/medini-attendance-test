import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert, Linking } from 'react-native';
import { useAuth, API_BASE_URL } from './_layout';

interface EmployeeProfile {
  _id: string;
  name: string;
  employeeId: string;
  designation: string;
  email: string;
}

interface AttendanceRecord {
  _id: string;
  employeeIdReference: string;
  employeeName: string;
  date: string;
  dayOfWeek: string;
  loginTime: string;
  logoutTime: string;
}

export default function AdminScreen() {
  const { logout } = useAuth();

  // Navigation Panel View States
  const [activeTab, setActiveTab] = useState<'REGISTER' | 'LOGS'>('REGISTER');
  const [selectedEmpFilter, setSelectedEmpFilter] = useState<string>('ALL');

  // Server Data Collections States
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Form Field Inputs Registration States
  const [name, setName] = useState('');
  const [empId, setEmpId] = useState('');
  const [designation, setDesignation] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // ----------------------------------------------------
  // SERVER DATA SYNC FUNCTIONS
  // ----------------------------------------------------

  // 1. Fetch complete employee list directory from MongoDB Cluster
  const fetchEmployeesList = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/employees`);
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error('Failed fetching employee array:', error);
    }
  };

  // 2. Fetch attendance logs safely filtered by specific employee identity strings
  const fetchAttendanceLogs = async (filterName: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/attendance-sheet?employeeName=${filterName}`);
      if (response.ok) {
        const data = await response.json();
        setAttendanceLogs(data);
      }
    } catch (error) {
      console.error('Failed fetching attendance array:', error);
      Alert.alert('Network Error', 'Could not sync log history from cloud servers.');
    } finally {
      setIsLoading(false);
    }
  };

  // Run initial pull loops when changing view segments or active isolation selectors
  useEffect(() => {
    if (activeTab === 'REGISTER') {
      fetchEmployeesList();
    } else {
      fetchAttendanceLogs(selectedEmpFilter);
    }
  }, [activeTab, selectedEmpFilter]);

  // 3. Register a brand new worker profile directly to the cloud
  const handleCreateEmployee = async () => {
    if (!name || !empId || !designation || !email || !password) {
      Alert.alert('Missing Parameters', 'Please fill out all credential registration fields.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/admin/register-employee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          employeeId: empId.trim().toUpperCase(),
          designation: designation.trim(),
          email: email.trim().toLowerCase(),
          password: password
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        Alert.alert('Success 🎉', `Credential baseline configured for ${name} (${empId}).`);
        // Reset form blocks and re-sync local dashboard registry list view
        setName(''); setEmpId(''); setDesignation(''); setEmail(''); setPassword('');
        fetchEmployeesList();
      } else {
        Alert.alert('Registration Denied', result.message || 'Error processing registration parameters.');
      }
    } catch (error) {
      Alert.alert('Connection Error', 'Failed to save employee profile back to database.');
    }
  };

  // 4. Fire direct browser intent to trigger live CSV Spreadsheet compiler and download
  const handleDownloadReport = () => {
    const downloadUrl = `${API_BASE_URL}/admin/download-attendance?employeeName=${selectedEmpFilter}`;
    
    Linking.openURL(downloadUrl).catch(() => {
      Alert.alert('Download Error', 'Could not establish connection to the download engine router.');
    });
  };

  const handleAdminExit = () => {
    Alert.alert('Exit Admin Panel', 'Terminate your administrative session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Exit Panel', style: 'destructive', onPress: () => logout() }
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Executive Command Header */}
      <View style={styles.adminHeader}>
        <View>
          <Text style={styles.adminTitle}>Admin Workspace</Text>
          <Text style={styles.adminSubtitle}>Employee Attendance Portal</Text>
        </View>
        <TouchableOpacity style={styles.backBtn} onPress={handleAdminExit}>
          <Text style={styles.backBtnText}>Exit Admin 🚪</Text>
        </TouchableOpacity>
      </View>

      {/* Main Sub-Navigation Toggle Row */}
      <View style={styles.menuToggleRow}>
        <TouchableOpacity 
          style={[styles.menuTab, activeTab === 'REGISTER' && styles.activeMenuTab]} 
          onPress={() => setActiveTab('REGISTER')}
        >
          <Text style={[styles.menuTabText, activeTab === 'REGISTER' && styles.activeMenuTabText]}>Add Employee</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.menuTab, activeTab === 'LOGS' && styles.activeMenuTab]} 
          onPress={() => setActiveTab('LOGS')}
        >
          <Text style={[styles.menuTabText, activeTab === 'LOGS' && styles.activeMenuTabText]}>Attendance Sheet</Text>
        </TouchableOpacity>
      </View>

      {/* VIEW PANEL 1: REGISTRATION & DIRECTORY WORKFLOW */}
      {activeTab === 'REGISTER' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={styles.formCard}>
            <Text style={styles.sectionHeading}>Generate Employee Credentials</Text>
            
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. John Doe" placeholderTextColor="#A0AEC0" />

            <Text style={styles.inputLabel}>Employee ID</Text>
            <TextInput style={styles.input} value={empId} onChangeText={setEmpId} placeholder="e.g. EMP-4022" placeholderTextColor="#A0AEC0" autoCapitalize="characters" />

            <Text style={styles.inputLabel}>Designation / Role</Text>
            <TextInput style={styles.input} value={designation} onChangeText={setDesignation} placeholder="e.g. Senior QA Engineer" placeholderTextColor="#A0AEC0" />

            <Text style={styles.inputLabel}>Official Email Address</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="e.g. employee@company.com" placeholderTextColor="#A0AEC0" keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.inputLabel}>Account Access Password</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor="#A0AEC0" secureTextEntry autoCapitalize="none" />

            <TouchableOpacity style={styles.submitButton} activeOpacity={0.8} onPress={handleCreateEmployee}>
              <Text style={styles.submitButtonText}>Register Employee Credentials 🚀</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.directoryCard}>
            <Text style={styles.sectionHeading}>Active Registry ({employees.length})</Text>
            {employees.length === 0 ? (
              <Text style={styles.emptyTextSub}>No active profiles in database directory container.</Text>
            ) : (
              employees.map((item) => (
                <View key={item._id} style={styles.employeeRowItem}>
                  <View style={styles.avatarCircle}><Text style={styles.avatarText}>{item.name.charAt(0)}</Text></View>
                  <View style={styles.employeeInfoBox}>
                    <Text style={styles.empRowName}>{item.name} <Text style={styles.empRowId}>({item.employeeId})</Text></Text>
                    <Text style={styles.empRowSub}>{item.designation} • {item.email}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* VIEW PANEL 2: COMPREHENSIVE ATTENDANCE LOG TRACKER SHEET */}
      {activeTab === 'LOGS' && (
        <View style={{ flex: 1 }}>
          
          {/* Isolation Filtering Selector Bar */}
          <Text style={styles.filterBarLabel}>Filter Records by Specific Employee:</Text>
          <View style={{ maxHeight: 50, marginBottom: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterWrapper} contentContainerStyle={{ paddingRight: 20 }}>
              <TouchableOpacity 
                style={[styles.filterPill, selectedEmpFilter === 'ALL' && styles.activeFilterPill]}
                onPress={() => setSelectedEmpFilter('ALL')}
              >
                <Text style={[styles.filterPillText, selectedEmpFilter === 'ALL' && styles.activeFilterPillText]}>All Team Members</Text>
              </TouchableOpacity>
              {employees.map((emp) => (
                <TouchableOpacity 
                  key={emp._id}
                  style={[styles.filterPill, selectedEmpFilter === emp.name && styles.activeFilterPill]}
                  onPress={() => setSelectedEmpFilter(emp.name)}
                >
                  <Text style={[styles.filterPillText, selectedEmpFilter === emp.name && styles.activeFilterPillText]}>{emp.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Master Excel Export Footer Trigger Block */}
          <TouchableOpacity style={styles.downloadFloatingBtn} activeOpacity={0.8} onPress={handleDownloadReport}>
            <Text style={styles.downloadFloatingBtnText}>📥 Download Attendance CSV Spreadsheet</Text>
          </TouchableOpacity>

          {/* Isolated Stream Activity Feed */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            <Text style={styles.sectionHeading}>Shift Chronology Logs</Text>
            {isLoading ? (
              <Text style={styles.emptyText}>Syncing metrics with cloud database... ⏳</Text>
            ) : attendanceLogs.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={{ fontSize: 32, marginBottom: 10 }}>📊</Text>
                <Text style={styles.emptyText}>No punches recorded for this profile search filter yet.</Text>
              </View>
            ) : (
              attendanceLogs.map((logItem) => (
                <View key={logItem._id} style={styles.dataLogCard}>
                  <View style={styles.logCardHeader}>
                    <View>
                      <Text style={styles.logEmployeeIdentity}>{logItem.employeeName}</Text>
                      <Text style={styles.logEmployeeIdSub}>ID: {logItem.employeeIdReference}</Text>
                    </View>
                    <View style={styles.dateBadge}>
                      <Text style={styles.dateBadgeText}>{logItem.date}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.punchMetricsRow}>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricLabel}>IN TIME</Text>
                      <Text style={[styles.metricTime, { color: '#38A169' }]}>{logItem.loginTime}</Text>
                    </View>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricLabel}>OUT TIME</Text>
                      <Text style={[styles.metricTime, { color: '#E53E3E' }]}>{logItem.logoutTime}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA', paddingHorizontal: 16, paddingTop: 50 },
  adminHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  adminTitle: { fontSize: 20, fontWeight: '800', color: '#1A202C' },
  adminSubtitle: { fontSize: 12, fontWeight: '600', color: '#718096', marginTop: 1 },
  backBtn: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FED7D7', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  backBtnText: { color: '#E53E3E', fontSize: 13, fontWeight: '700' },
  menuToggleRow: { flexDirection: 'row', backgroundColor: '#E2E8F0', padding: 4, borderRadius: 12, marginBottom: 20 },
  menuTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  activeMenuTab: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  menuTabText: { fontSize: 14, fontWeight: '700', color: '#718096' },
  activeMenuTabText: { color: '#007AFF' },
  formCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  sectionHeading: { fontSize: 14, fontWeight: '800', color: '#2B6CB0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 15 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#718096', marginBottom: 5, marginTop: 10 },
  input: { backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#2D3748' },
  submitButton: { backgroundColor: '#007AFF', paddingVertical: 15, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  submitButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  directoryCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  employeeRowItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EDF2F7' },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EBF4FF', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#007AFF', fontSize: 16, fontWeight: '700' },
  employeeInfoBox: { marginLeft: 12, flex: 1 },
  empRowName: { fontSize: 15, fontWeight: '700', color: '#1A202C' },
  empRowId: { color: '#718096', fontWeight: '500', fontSize: 13 },
  empRowSub: { fontSize: 12, color: '#718096', marginTop: 1 },
  filterBarLabel: { fontSize: 12, fontWeight: '700', color: '#4A5568', marginBottom: 8 },
  filterWrapper: { flexDirection: 'row', marginBottom: 15, height: 40 },
  filterPill: { backgroundColor: '#E2E8F0', paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderRadius: 20, marginRight: 8, height: 38 },
  activeFilterPill: { backgroundColor: '#007AFF' },
  filterPillText: { fontSize: 13, color: '#4A5568', fontWeight: '700' },
  activeFilterPillText: { color: '#FFFFFF' },
  dataLogCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  logCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EDF2F7', paddingBottom: 10, marginBottom: 10 },
  logEmployeeIdentity: { fontSize: 16, fontWeight: '800', color: '#2D3748' },
  logEmployeeIdSub: { fontSize: 11, fontWeight: '600', color: '#A0AEC0', marginTop: 1 },
  dateBadge: { backgroundColor: '#EDF2F7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  dateBadgeText: { fontSize: 12, color: '#4A5568', fontWeight: '700' },
  punchMetricsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metricBox: { flex: 1, backgroundColor: '#F7FAFC', padding: 10, borderRadius: 10, alignItems: 'center', marginHorizontal: 2 },
  metricLabel: { fontSize: 10, fontWeight: '700', color: '#A0AEC0', marginBottom: 2 },
  metricTime: { fontSize: 14, fontWeight: '800' },
  downloadFloatingBtn: { backgroundColor: '#38A169', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  downloadFloatingBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#718096', textAlign: 'center', fontSize: 14, fontWeight: '600' },
  emptyTextSub: { color: '#A0AEC0', fontSize: 13, fontWeight: '500', textAlign: 'center', marginVertical: 10 }
});