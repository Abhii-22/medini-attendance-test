import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert, Linking, ActivityIndicator } from 'react-native';
import { useAuth, API_BASE_URL } from './_layout';

interface EmployeeProfile {
  _id: string;
  name: string;
  employeeId: string;
  designation: string;
  email: string;
  password?: string;
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
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);

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

  useEffect(() => {
    if (activeTab === 'REGISTER') {
      fetchEmployeesList();
    } else {
      fetchAttendanceLogs(selectedEmpFilter);
    }
  }, [activeTab, selectedEmpFilter]);

  // 3. Register a brand new worker profile or update an existing one directly in the cloud
  const handleCreateOrUpdateEmployee = async () => {
    if (!name || !empId || !designation || !email || !password) {
      Alert.alert('Missing Parameters', 'Please fill out all credential registration fields.');
      return;
    }

    const payload = {
      name: name.trim(),
      employeeId: empId.trim().toUpperCase(),
      designation: designation.trim(),
      email: email.trim().toLowerCase(),
      password: password
    };

    try {
      setIsLoading(true);
      let response;

      if (isEditing && editingTargetId) {
        response = await fetch(`${API_BASE_URL}/admin/update-employee`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _id: editingTargetId, ...payload })
        });
      } else {
        response = await fetch(`${API_BASE_URL}/admin/register-employee`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const result = await response.json();

      if (response.ok && (result.success || result._id)) {
        Alert.alert('Success 🎉', isEditing ? 'Employee profile updated successfully.' : `Credential baseline configured for ${name}.`);
        clearFormState();
        fetchEmployeesList();
      } else {
        Alert.alert('Operation Denied', result.message || 'Error processing registration parameters.');
      }
    } catch (error) {
      Alert.alert('Connection Error', 'Failed to communicate with database server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectEditEmployee = (item: EmployeeProfile) => {
    setIsEditing(true);
    setEditingTargetId(item._id);
    setName(item.name);
    setEmpId(item.employeeId);
    setDesignation(item.designation);
    setEmail(item.email);
    setPassword(item.password || '');
  };

  const handleDeleteTrigger = (id: string, nameString: string) => {
    Alert.alert(
      'Purge Confirmation ⚠️',
      `Are you sure you want to permanently delete ${nameString}?\n\nThis will clear their profile data and delete all associated shift history permanently.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/admin/delete-employee/${id}`, { method: 'DELETE' });
              if (response.ok) {
                Alert.alert('Deleted Successfully', 'Employee profile entries swept out from database.');
                if (editingTargetId === id) clearFormState();
                fetchEmployeesList();
              }
            } catch (err) {
              Alert.alert('System Error', 'Failed to process termination sequence.');
            }
          }
        }
      ]
    );
  };

  const clearFormState = () => {
    setIsEditing(false);
    setEditingTargetId(null);
    setName(''); setEmpId(''); setDesignation(''); setEmail(''); setPassword('');
  };

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
      
      {/* 👑 PREMIUM DARK HERO DASHBOARD HEADER */}
      <View style={styles.headerHeroCard}>
        <View style={styles.headerInfoBlock}>
          <Text style={styles.headerSubtitle}>ADMIN CONTROL CENTER</Text>
          <Text style={styles.headerTitle}>Management Hub</Text>
        </View>
        <TouchableOpacity style={styles.exitBadgeBtn} activeOpacity={0.7} onPress={handleAdminExit}>
          <Text style={styles.exitBtnText}>Exit Hub 🚪</Text>
        </TouchableOpacity>
      </View>

      {/* 📊 SYSTEM SUMMARY KPI MATRIX */}
      <View style={styles.summaryGridContainer}>
        <View style={[styles.statBoxSummary, { borderLeftColor: '#007AFF' }]}>
          <Text style={styles.statBoxNumber}>{employees.length}</Text>
          <Text style={styles.statBoxLabel}>Total Staff Profiles</Text>
        </View>
        <View style={[styles.statBoxSummary, { borderLeftColor: '#38A169' }]}>
          <Text style={styles.statBoxNumber}>
            {activeTab === 'LOGS' ? attendanceLogs.length : 'Active'}
          </Text>
          <Text style={styles.statBoxLabel}>
            {activeTab === 'LOGS' ? 'Filtered Logs Loaded' : 'Database Cluster'}
          </Text>
        </View>
      </View>

      {/* 🔍 WORKSPACE LAYOUT SWITCHER TAB PILLS */}
      <View style={styles.menuToggleRow}>
        <TouchableOpacity 
          style={[styles.menuTab, activeTab === 'REGISTER' && styles.activeMenuTab]} 
          onPress={() => setActiveTab('REGISTER')}
        >
          <Text style={[styles.menuTabText, activeTab === 'REGISTER' && styles.activeMenuTabText]}>👤 Workforce Profiles</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.menuTab, activeTab === 'LOGS' && styles.activeMenuTab]} 
          onPress={() => setActiveTab('LOGS')}
        >
          <Text style={[styles.menuTabText, activeTab === 'LOGS' && styles.activeMenuTabText]}>📑 Attendance Sheet</Text>
        </TouchableOpacity>
      </View>

      {/* WORKSPACE CONTENT SECTIONS */}
      {activeTab === 'REGISTER' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          
          {/* PROFILE CREATION & EDIT CARD */}
          <View style={styles.formCard}>
            <Text style={styles.sectionHeading}>
              {isEditing ? '✏️ Modify Employee Parameters' : '⚙️ Provision Workspace Identity'}
            </Text>
            
            <Text style={styles.inputLabel}>Full Legal Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. John Doe" placeholderTextColor="#A0AEC0" />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
              <View style={{ width: '48%' }}>
                <Text style={styles.inputLabel}>Employee ID Code</Text>
                <TextInput style={styles.input} value={empId} onChangeText={setEmpId} placeholder="e.g. EMP-109" placeholderTextColor="#A0AEC0" autoCapitalize="characters" editable={!isEditing} />
              </View>
              <View style={{ width: '48%' }}>
                <Text style={styles.inputLabel}>Corporate Role</Text>
                <TextInput style={styles.input} value={designation} onChangeText={setDesignation} placeholder="e.g. UX Designer" placeholderTextColor="#A0AEC0" />
              </View>
            </View>

            <Text style={styles.inputLabel}>Official Email Address</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="e.g. worker@medini.com" placeholderTextColor="#A0AEC0" keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.inputLabel}>Account Password</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor="#A0AEC0" secureTextEntry autoCapitalize="none" />

            <View style={{ flexDirection: 'row', marginTop: 20, width: '100%' }}>
              <TouchableOpacity style={[styles.submitButton, { flex: 1 }]} activeOpacity={0.8} onPress={handleCreateOrUpdateEmployee}>
                <Text style={styles.submitButtonText}>{isEditing ? 'Save Structural Changes 💾' : 'Deploy Credentials 🚀'}</Text>
              </TouchableOpacity>
              {isEditing && (
                <TouchableOpacity style={styles.cancelEditBtn} onPress={clearFormState}>
                  <Text style={styles.cancelEditBtnText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ACTIVE STAFF DIRECTORY TABLE */}
          <Text style={styles.sectionHeadingLabel}>Active Operational Registry</Text>
          <View style={styles.directoryCard}>
            {employees.length === 0 ? (
              <Text style={styles.emptyTextSub}>No active baseline nodes connected inside directory frame.</Text>
            ) : (
              employees.map((item) => (
                <View key={item._id} style={styles.employeeRowItem}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.employeeInfoBox}>
                    <Text style={styles.empRowName}>{item.name} <Text style={styles.empRowId}>({item.employeeId})</Text></Text>
                    <Text style={styles.empRowSub}>{item.designation}  •  {item.email}</Text>
                  </View>
                  <View style={styles.crudActionRow}>
                    <TouchableOpacity style={styles.actionPillEdit} onPress={() => handleSelectEditEmployee(item)}>
                      <Text style={styles.actionPillTextEdit}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionPillDelete} onPress={() => handleDeleteTrigger(item._id, item.name)}>
                      <Text style={styles.actionPillTextDelete}>Wipe</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {activeTab === 'LOGS' && (
        <View style={{ flex: 1 }}>
          
          {/* HORIZONTAL WORKFORCE ISOLATION SELECTOR PILLS */}
          <Text style={styles.sectionHeadingLabel}>Workforce Filtering Focus</Text>
          <View style={styles.pillScrollFrame}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity style={[styles.filterPill, selectedEmpFilter === 'ALL' && styles.activeFilterPill]} onPress={() => setSelectedEmpFilter('ALL')}>
                <Text style={[styles.filterPillText, selectedEmpFilter === 'ALL' && styles.activeFilterPillText]}>🌐 Global Workforce</Text>
              </TouchableOpacity>
              {employees.map((emp) => (
                <TouchableOpacity key={emp._id} style={[styles.filterPill, selectedEmpFilter === emp.name && styles.activeFilterPill]} onPress={() => setSelectedEmpFilter(emp.name)}>
                  <Text style={[styles.filterPillText, selectedEmpFilter === emp.name && styles.activeFilterPillText]}>👤 {emp.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* SPREADSHEET COMPILER EXPORT TRIGGER */}
          <TouchableOpacity style={styles.downloadFloatingBtn} activeOpacity={0.8} onPress={handleDownloadReport}>
            <Text style={styles.downloadFloatingBtnText}>📥 Export Log Stream to spreadsheet CSV</Text>
          </TouchableOpacity>

          {/* TIMELINE LOG FEED CONTAINER */}
          <Text style={styles.sectionHeadingLabel}>Chronological Verification Stream</Text>
          
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            {isLoading ? (
              <View style={styles.loaderCenterFrame}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loaderLabelSub}>Compiling structural database logs...</Text>
              </View>
            ) : attendanceLogs.length === 0 ? (
              <View style={styles.emptyCardFrame}>
                <Text style={styles.emptyTextMessage}>No chronological data entries matches search parameters.</Text>
              </View>
            ) : (
              attendanceLogs.map((logItem) => {
                const isAbsent = logItem.loginTime === 'ABSENT' || logItem.logoutTime === 'ABSENT';
                return (
                  <View key={logItem._id} style={[styles.dataLogCard, isAbsent && styles.dataLogCardAbsent]}>
                    <View style={styles.logCardHeader}>
                      <View>
                        <Text style={styles.logEmployeeIdentity}>{logItem.employeeName}</Text>
                        <Text style={styles.logEmployeeIdSub}>Profile ID reference: {logItem.employeeIdReference}</Text>
                      </View>
                      <View style={[styles.dateBadge, isAbsent && { backgroundColor: '#FED7D7', borderColor: '#FEB2B2' }]}>
                        <Text style={[styles.dateBadgeText, isAbsent && { color: '#9B2C2C' }]}>{logItem.date}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.punchMetricsRow}>
                      <View style={[styles.metricBox, isAbsent && { borderColor: '#FEB2B2', backgroundColor: '#FFF5F5' }]}>
                        <Text style={styles.metricLabel}>PUNCH IN</Text>
                        <Text style={[styles.metricTime, isAbsent ? { color: '#E53E3E' } : { color: '#2F855A' }]}>{logItem.loginTime}</Text>
                      </View>
                      <View style={[styles.metricBox, isAbsent && { borderColor: '#FEB2B2', backgroundColor: '#FFF5F5' }]}>
                        <Text style={styles.metricLabel}>PUNCH OUT</Text>
                        <Text style={[styles.metricTime, isAbsent ? { color: '#E53E3E' } : { color: '#4A5568' }]}>{logItem.logoutTime}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA', paddingHorizontal: 16, paddingTop: 50 },
  
  // Executive Header Hero Banner
  headerHeroCard: { backgroundColor: '#1A202C', padding: 20, borderRadius: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  headerInfoBlock: { flex: 1 },
  headerSubtitle: { color: '#A0AEC0', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 },
  exitBadgeBtn: { backgroundColor: '#E53E3E', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  exitBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // Key Statistics Aggregations Matrices
  summaryGridContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 20 },
  statBoxSummary: { width: '48%', borderRadius: 18, padding: 14, borderWidth: 1, backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderLeftWidth: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 6, elevation: 1 },
  statBoxNumber: { fontSize: 24, fontWeight: '800', color: '#1A202C' },
  statBoxLabel: { fontSize: 11, fontWeight: '700', color: '#718096', marginTop: 3 },

  // Segment Label Formatting Typography
  sectionHeadingLabel: { fontSize: 12, fontWeight: '800', color: '#2B6CB0', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10, paddingLeft: 2 },

  // Workspace Layout Switcher Tab Pills
  menuToggleRow: { flexDirection: 'row', backgroundColor: '#E2E8F0', padding: 4, borderRadius: 14, marginBottom: 20 },
  menuTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, flexDirection: 'row', justifyContent: 'center' },
  activeMenuTab: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  menuTabText: { fontSize: 12, fontWeight: '700', color: '#718096' },
  activeMenuTabText: { color: '#007AFF' },

  // Profile Form Card Styling
  formCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 24, marginBottom: 25, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10, elevation: 2 },
  sectionHeading: { fontSize: 13, fontWeight: '800', color: '#2B6CB0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#718096', marginBottom: 5, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: { backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#2D3748', marginBottom: 4 },
  submitButton: { backgroundColor: '#007AFF', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#007AFF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1 },
  submitButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  cancelEditBtn: { borderColor: '#CBD5E0', borderWidth: 1, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 8, backgroundColor: '#FFFFFF' },
  cancelEditBtnText: { color: '#4A5568', fontSize: 14, fontWeight: '600' },

  // Employee Directory Layout Block
  directoryCard: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, borderRadius: 24, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10, elevation: 2 },
  employeeRowItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EDF2F7' },
  avatarCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EBF4FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#BEE3F8' },
  avatarText: { color: '#007AFF', fontSize: 16, fontWeight: '800' },
  employeeInfoBox: { marginLeft: 12, flex: 1, paddingRight: 4 },
  empRowName: { fontSize: 15, fontWeight: '700', color: '#1A202C' },
  empRowId: { color: '#718096', fontWeight: '600', fontSize: 12 },
  empRowSub: { fontSize: 12, color: '#718096', marginTop: 3, fontWeight: '500' },
  crudActionRow: { flexDirection: 'row', alignItems: 'center' },
  actionPillEdit: { backgroundColor: '#EBF8FF', borderWidth: 1, borderColor: '#BEE3F8', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 5 },
  actionPillTextEdit: { color: '#2B6CB0', fontSize: 12, fontWeight: '700' },
  actionPillDelete: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FED7D7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  actionPillTextDelete: { color: '#E53E3E', fontSize: 12, fontWeight: '700' },

  // Horizontal Filter Pills Setup Bar
  pillScrollFrame: { maxHeight: 44, marginBottom: 15 },
  filterPill: { backgroundColor: '#E2E8F0', paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderRadius: 14, marginRight: 6, height: 36, borderWidth: 1, borderColor: '#CBD5E0' },
  activeFilterPill: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  filterPillText: { fontSize: 12, color: '#4A5568', fontWeight: '700' },
  activeFilterPillText: { color: '#FFFFFF' },

  // Spreadsheet Export Button Layout
  downloadFloatingBtn: { backgroundColor: '#38A169', paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 18, shadowColor: '#38A169', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1 },
  downloadFloatingBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Chronological Log Item Blocks
  dataLogCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 5 },
  dataLogCardAbsent: { backgroundColor: '#FFF5F5', borderColor: '#FED7D7' },
  logCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EDF2F7', paddingBottom: 10, marginBottom: 12 },
  logEmployeeIdentity: { fontSize: 15, fontWeight: '800', color: '#2D3748' },
  logEmployeeIdSub: { fontSize: 11, fontWeight: '600', color: '#A0AEC0', marginTop: 1 },
  dateBadge: { backgroundColor: '#F7FAFC', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  dateBadgeText: { fontSize: 11, color: '#4A5568', fontWeight: '700' },
  punchMetricsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metricBox: { flex: 1, backgroundColor: '#F7FAFC', padding: 10, borderRadius: 12, alignItems: 'center', marginHorizontal: 2, borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabel: { fontSize: 9, fontWeight: '800', color: '#A0AEC0', marginBottom: 2 },
  metricTime: { fontSize: 13, fontWeight: '800' },

  // Center Frame Loading Layout Elements
  loaderCenterFrame: { paddingVertical: 50, alignItems: 'center', justifyContent: 'center' },
  loaderLabelSub: { color: '#718096', fontSize: 13, fontWeight: '600', marginTop: 12 },
  emptyCardFrame: { backgroundColor: '#FFFFFF', padding: 30, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  emptyTextMessage: { color: '#A0AEC0', fontSize: 13, fontStyle: 'italic', fontWeight: '600', textAlign: 'center' },
  emptyTextSub: { color: '#A0AEC0', fontSize: 13, fontWeight: '600', textAlign: 'center', marginVertical: 15, fontStyle: 'italic' }
});