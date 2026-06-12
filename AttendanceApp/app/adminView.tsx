import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, ActivityIndicator, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, API_BASE_URL } from './_layout'; 

const { width } = Dimensions.get('window');

interface AttendanceLog {
  _id: string;
  employeeIdReference: string;
  employeeName: string;
  date: string;
  dayOfWeek: string;
  loginTime: string;
  logoutTime: string;
  capturedPhotoInUri?: string;
  capturedPhotoOutUri?: string;
}

interface EmployeeStats {
  name: string;
  id: string;
  presentDays: number;
  absentDays: number;
}

export default function AdminViewScreen() {
  const router = useRouter();
  const { logout } = useAuth(); 
  
  const [allLogs, setAllLogs] = useState<AttendanceLog[]>([]);
  const [displayedLogs, setDisplayedLogs] = useState<AttendanceLog[]>([]);
  const [employeeStatsList, setEmployeeStatsList] = useState<EmployeeStats[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [totalEmployeesCount, setTotalEmployeesCount] = useState<number>(0);

  const fetchTotalEmployeesHeadcount = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/employees`);
      if (response.ok) {
        const data = await response.json();
        setTotalEmployeesCount(data.length);
      }
    } catch (error) {
      console.error('Error fetching global employee headcounts:', error);
    }
  };

  const syncLiveLogsDesk = async () => {
    try {
      setIsLoading(true);
      await fetchTotalEmployeesHeadcount();
      
      const response = await fetch(`${API_BASE_URL}/admin/attendance-sheet?employeeName=ALL`);
      if (response.ok) {
        const data: AttendanceLog[] = await response.json();
        setAllLogs(data);
        setDisplayedLogs(data);
        calculateMetricsAggregate(data);
      }
    } catch (error) {
      console.error('Error syncing logs to view board:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateMetricsAggregate = (logs: AttendanceLog[]) => {
    const statsMap: { [key: string]: EmployeeStats } = {};

    logs.forEach((log) => {
      const key = log.employeeName;
      if (!statsMap[key]) {
        statsMap[key] = {
          name: log.employeeName,
          id: log.employeeIdReference || 'N/A',
          presentDays: 0,
          absentDays: 0,
        };
      }

      if (log.loginTime === 'ABSENT' || log.logoutTime === 'ABSENT') {
        statsMap[key].absentDays += 1;
      } else if (log.loginTime !== '--:--') {
        statsMap[key].presentDays += 1;
      }
    });

    setEmployeeStatsList(Object.values(statsMap));
  };

  useEffect(() => {
    syncLiveLogsDesk();
  }, []);

  const handleApplyFilter = (name: string) => {
    setSelectedFilter(name);
    if (name === 'ALL') {
      setDisplayedLogs(allLogs);
    } else {
      setDisplayedLogs(allLogs.filter(log => log.employeeName === name));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerHeroCard}>
        <View style={styles.headerInfoBlock}>
          <Text style={styles.headerSubtitle}>READ-ONLY SYSTEM DIRECTORY</Text>
          <Text style={styles.headerTitle}>Live Inspection Desk</Text>
        </View>
        <TouchableOpacity style={styles.refreshBadgeBtn} activeOpacity={0.7} onPress={syncLiveLogsDesk}>
          <Text style={styles.refreshBtnText}>Sync Hub 🔄</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryGridContainer}>
        {selectedFilter === 'ALL' ? (
          <View style={[styles.statBoxSummary, { borderLeftColor: '#007AFF', width: '100%' }]}>
            <Text style={styles.statBoxNumber}>{totalEmployeesCount}</Text>
            <Text style={styles.statBoxLabel}>Total Employees Registered</Text>
          </View>
        ) : (
          employeeStatsList.filter(e => e.name === selectedFilter).map((stat) => (
            <React.Fragment key={stat.id}>
              <View style={[styles.statBoxSummary, { borderLeftColor: '#38A169', width: '48%' }]}>
                <Text style={styles.statBoxNumber}>{stat.presentDays}</Text>
                <Text style={styles.statBoxLabel}>Days Present ({stat.name})</Text>
              </View>
              <View style={[styles.statBoxSummary, { borderLeftColor: '#E53E3E', width: '48%' }]}>
                <Text style={styles.statBoxNumber}>{stat.absentDays}</Text>
                <Text style={styles.statBoxLabel}>Days Absent ({stat.name})</Text>
              </View>
            </React.Fragment>
          ))
        )}
      </View>

      <Text style={styles.sectionHeadingLabel}>Isolate Workforce Logs</Text>
      <View style={styles.pillScrollFrame}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity style={[styles.filterPill, selectedFilter === 'ALL' && styles.activeFilterPill]} onPress={() => handleApplyFilter('ALL')}>
            <Text style={[styles.filterPillText, selectedFilter === 'ALL' && styles.activeFilterPillText]}>🌐 All Workers</Text>
          </TouchableOpacity>
          {employeeStatsList.map((emp) => (
            <TouchableOpacity key={emp.id} style={[styles.filterPill, selectedFilter === emp.name && styles.activeFilterPill]} onPress={() => handleApplyFilter(emp.name)}>
              <Text style={[styles.filterPillText, selectedFilter === emp.name && styles.activeFilterPillText]}>👤 {emp.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <Text style={styles.sectionHeadingLabel}>Security Verification Stream</Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        {isLoading ? (
          <View style={styles.loaderCenterFrame}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loaderLabelSub}>Compiling cloud attendance registries...</Text>
          </View>
        ) : displayedLogs.length === 0 ? (
          <View style={styles.emptyCardFrame}><Text style={styles.emptyTextMessage}>No log vectors discovered.</Text></View>
        ) : (
          displayedLogs.map((log) => {
            const isFullAbsence = log.loginTime === 'ABSENT' || log.logoutTime === 'ABSENT';
            return (
              <View key={log._id} style={[styles.logInspectionCard, isFullAbsence && styles.logInspectionCardAbsent]}>
                <View style={styles.cardTopHeaderRow}>
                  <View style={styles.headerInfoMetaLeft}>
                    <Text style={styles.cardEmpNameText}>{log.employeeName}</Text>
                    <Text style={styles.cardEmpIdText}>Reference ID: {log.employeeIdReference}</Text>
                  </View>
                  <View style={[styles.dateLabelBadge, isFullAbsence && { backgroundColor: '#FED7D7' }]}>
                    <Text style={[styles.dateBadgeText, isFullAbsence && { color: '#9B2C2C' }]}>{log.date}</Text>
                  </View>
                </View>

                <View style={styles.timeDetailsRow}>
                  <View style={[styles.timeBoxPill, isFullAbsence ? styles.absentBorderBlock : styles.presentBorderInBlock]}>
                    <Text style={styles.timeBoxLabel}>PUNCH IN</Text>
                    <Text style={[styles.timeBoxValue, isFullAbsence ? { color: '#E53E3E' } : { color: '#2F855A' }]}>{log.loginTime}</Text>
                  </View>
                  <View style={[styles.timeBoxPill, isFullAbsence ? styles.absentBorderBlock : styles.presentBorderOutBlock]}>
                    <Text style={styles.timeBoxLabel}>PUNCH OUT</Text>
                    <Text style={[styles.timeBoxValue, isFullAbsence ? { color: '#E53E3E' } : { color: '#4A5568' }]}>{log.logoutTime}</Text>
                  </View>
                </View>

                {/* 🚀 Render both photos side by side for Admin Audit reviews */}
                {!isFullAbsence && (
                  <View style={styles.photoVerificationSection}>
                    <Text style={styles.photoSectionLabel}>📸 Dual Biometric Compliance Record Images:</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <View style={{ width: '49%' }}>
                        <Text style={styles.photoPaneMiniTitle}>📥 In Snapshot:</Text>
                        {log.capturedPhotoInUri ? (
                          <Image source={{ uri: log.capturedPhotoInUri }} style={styles.adminVerificationImage} />
                        ) : (
                          <View style={styles.noPhotoPlaceholderBox}><Text style={styles.noPhotoPlaceholderText}>No image</Text></View>
                        )}
                      </View>
                      <View style={{ width: '49%' }}>
                        <Text style={styles.photoPaneMiniTitle}>📤 Out Snapshot:</Text>
                        {log.capturedPhotoOutUri ? (
                          <Image source={{ uri: log.capturedPhotoOutUri }} style={styles.adminVerificationImage} />
                        ) : (
                          <View style={styles.noPhotoPlaceholderBox}><Text style={styles.noPhotoPlaceholderText}>No image</Text></View>
                        )}
                      </View>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity style={styles.floatingCloseBtn} activeOpacity={0.85} onPress={() => logout()}>
        <Text style={styles.floatingCloseBtnText}>Exit Monitor & Sign Out 🚪</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA', paddingHorizontal: 16, paddingTop: 50 },
  headerHeroCard: { backgroundColor: '#1A202C', padding: 20, borderRadius: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerInfoBlock: { flex: 1 },
  headerSubtitle: { color: '#A0AEC0', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 },
  refreshBadgeBtn: { backgroundColor: '#2D3748', borderWidth: 1, borderColor: '#4A5568', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  refreshBtnText: { color: '#E2E8F0', fontSize: 12, fontWeight: '700' },
  summaryGridContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 20 },
  statBoxSummary: { borderRadius: 18, padding: 14, borderWidth: 1, backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderLeftWidth: 5 },
  statBoxNumber: { fontSize: 24, fontWeight: '800', color: '#1A202C' },
  statBoxLabel: { fontSize: 11, fontWeight: '700', color: '#718096', marginTop: 3 },
  sectionHeadingLabel: { fontSize: 12, fontWeight: '800', color: '#2B6CB0', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10, paddingLeft: 2 },
  pillScrollFrame: { maxHeight: 44, marginBottom: 18 },
  filterPill: { backgroundColor: '#E2E8F0', paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderRadius: 14, marginRight: 6, height: 36, borderWidth: 1, borderColor: '#CBD5E0' },
  activeFilterPill: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  filterPillText: { fontSize: 12, color: '#4A5568', fontWeight: '700' },
  activeFilterPillText: { color: '#FFFFFF' },
  logInspectionCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  logInspectionCardAbsent: { backgroundColor: '#FFF5F5', borderColor: '#FED7D7' },
  cardTopHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EDF2F7', paddingBottom: 10, marginBottom: 12 },
  headerInfoMetaLeft: { flex: 1 },
  cardEmpNameText: { fontSize: 16, fontWeight: '800', color: '#1A202C' },
  cardEmpIdText: { fontSize: 11, color: '#A0AEC0', fontWeight: '600', marginTop: 1 },
  dateLabelBadge: { backgroundColor: '#F7FAFC', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  dateBadgeText: { fontSize: 11, color: '#4A5568', fontWeight: '700' },
  timeDetailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  timeBoxPill: { width: '49%', padding: 10, borderRadius: 12, borderWidth: 1, backgroundColor: '#F7FAFC', alignItems: 'center' },
  presentBorderInBlock: { borderColor: '#C6F6D5', backgroundColor: '#F6FDF9' },
  presentBorderOutBlock: { borderColor: '#E2E8F0' },
  absentBorderBlock: { borderColor: '#FEB2B2', backgroundColor: '#FFF5F5' },
  timeBoxLabel: { fontSize: 9, fontWeight: '800', color: '#A0AEC0', marginBottom: 2 },
  timeBoxValue: { fontSize: 14, fontWeight: '800' },
  photoVerificationSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EDF2F7' },
  photoSectionLabel: { fontSize: 11, fontWeight: '700', color: '#718096', marginBottom: 8 },
  photoPaneMiniTitle: { fontSize: 10, fontWeight: '700', color: '#718096', marginBottom: 4 },
  adminVerificationImage: { width: '100%', height: 140, borderRadius: 14, backgroundColor: '#EDF2F7', resizeMode: 'cover' },
  noPhotoPlaceholderBox: { width: '100%', height: 140, backgroundColor: '#F7FAFC', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E0' },
  noPhotoPlaceholderText: { color: '#A0AEC0', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  loaderCenterFrame: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  loaderLabelSub: { color: '#718096', fontSize: 13, fontWeight: '600', marginTop: 12 },
  emptyCardFrame: { backgroundColor: '#FFFFFF', padding: 30, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  emptyTextMessage: { color: '#A0AEC0', fontSize: 13, fontStyle: 'italic', fontWeight: '600' },
  floatingCloseBtn: { backgroundColor: '#E53E3E', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 20 },
  floatingCloseBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' }
});