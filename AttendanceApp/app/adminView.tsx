import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Image, Modal } from 'react-native';
import { useAuth, API_BASE_URL } from './_layout';
import { Ionicons } from '@expo/vector-icons';

interface EmployeeProfile {
  _id: string;
  name: string;
  employeeId: string;
  designation: string;
  email: string;
  role?: string;
}

interface AttendanceRecord {
  _id: string;
  employeeIdReference: string;
  employeeName: string;
  date: string; 
  dayOfWeek: string;
  loginTime: string;
  logoutTime: string;
  capturedPhotoInUri?: string;
  capturedPhotoOutUri?: string;
  locationInAddress?: string;
  locationOutAddress?: string;
}

interface PhotoModalState {
  visible: boolean;
  imageUri: string | null;
  location: string;
  type: 'LOGIN' | 'LOGOUT';
  date: string;
  time: string;
}

export default function AdminViewScreen() {
  const { logout, currentUser } = useAuth();

  const [selectedEmpFilter, setSelectedEmpFilter] = useState<string>('ALL');
  
  const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long' }); 
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>(currentMonthName);
  
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null); 

  const [modalState, setModalState] = useState<PhotoModalState>({
    visible: false,
    imageUri: null,
    location: '',
    type: 'LOGIN',
    date: '',
    time: ''
  });

  const availableMonths = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // ⏱️ STABLE TYPE-SAFE WORK HOURS CALCULATOR
  const calculateWorkingHours = (inTime: string, outTime: string) => {
    if (!inTime || !outTime || inTime === '--:--' || outTime === '--:--' || inTime === 'ABSENT' || outTime === 'ABSENT') {
      return '--';
    }
    try {
      const parseTimeToMinutes = (timeStr: string) => {
        const parts = timeStr.split(' ');
        const timePart = parts[0] || '0:0';
        const modifier = parts[1] || 'AM';

        const timeSplit = timePart.split(':');
        let hours = Number(timeSplit[0]) || 0;
        const minutes = Number(timeSplit[1]) || 0;

        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };

      const diffInMinutes = parseTimeToMinutes(outTime) - parseTimeToMinutes(inTime);
      if (diffInMinutes <= 0) return '0h 0m';

      return `${Math.floor(diffInMinutes / 60)}h ${diffInMinutes % 60}m`;
    } catch (e) {
      return '--';
    }
  };

  const getFilteredLogs = () => {
    const currentYearString = new Date().getFullYear().toString();

    return attendanceLogs.filter((log) => {
      if (!log.date) return false;
      const logDateLower = log.date.toLowerCase();
      const matchesMonth = logDateLower.includes(selectedMonthFilter.toLowerCase());
      const matchesYear = logDateLower.includes(currentYearString);
      return matchesMonth && matchesYear;
    });
  };

  const filteredLogs = getFilteredLogs();

  const getAttendanceMetrics = () => {
    let presentCount = 0;
    let absentCount = 0;

    filteredLogs.forEach((log) => {
      if (log.loginTime === 'ABSENT' || log.logoutTime === 'ABSENT') {
        absentCount++;
      } else if (log.loginTime !== '--:--') {
        presentCount++;
      }
    });

    return { presentCount, absentCount };
  };

  const { presentCount, absentCount } = getAttendanceMetrics();

  const fetchEmployeesList = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/employees`);
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error('Failed fetching employees registry:', error);
    }
  };

  const fetchAttendanceLogs = async (filterName: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/attendance-sheet?employeeName=${filterName}`);
      if (response.ok) {
        const data = await response.json();
        setAttendanceLogs(data);
      }
    } catch (error) {
      console.error('Error fetching logs stream:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeesList();
  }, []);

  useEffect(() => {
    fetchAttendanceLogs(selectedEmpFilter);
    setExpandedLogId(null); 
  }, [selectedEmpFilter]);

  useEffect(() => {
    setExpandedLogId(null); 
  }, [selectedMonthFilter]);

  const handleToggleLogDrawer = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const openPhotoModal = (
    imageUri: string, 
    location: string | undefined, 
    type: 'LOGIN' | 'LOGOUT', 
    date: string, 
    time: string
  ) => {
    setModalState({
      visible: true,
      imageUri,
      location: location || '',
      type,
      date,
      time
    });
  };

  const closePhotoModal = () => {
    setModalState(prev => ({ ...prev, visible: false }));
  };

  return (
    <View style={styles.container}>
      
      {/* SUPERVISOR DASHBOARD BANNER */}
      <View style={styles.headerHeroCard}>
        <View style={styles.headerInfoBlock}>
          <Text style={styles.headerSubtitle}>ADMINISTRATIVE INSPECTION VIEW</Text>
          <Text style={styles.headerTitle}>Welcome, {currentUser?.name || 'Supervisor'}</Text>
        </View>
        <TouchableOpacity style={styles.exitBadgeBtn} activeOpacity={0.7} onPress={() => logout()}>
          <Text style={styles.exitBtnText}>Sign Out 🚪</Text>
        </TouchableOpacity>
      </View>

      {/* METRICS OVERVIEW CARDS */}
      <Text style={styles.sectionHeadingLabel}>
        {selectedEmpFilter === 'ALL' 
          ? `🌐 Global Analytics (${selectedMonthFilter} ${new Date().getFullYear()})` 
          : `👤 ${selectedEmpFilter} Summary (${selectedMonthFilter} ${new Date().getFullYear()})`
        }
      </Text>
      <View style={styles.summaryGridContainer}>
        <View style={[styles.statBoxSummary, { borderLeftColor: '#007AFF' }]}>
          <Text style={styles.statBoxNumber}>
            {selectedEmpFilter === 'ALL' ? employees.filter(e => e.role !== 'ADMIN_VIEW').length : '1'}
          </Text>
          <Text style={styles.statBoxLabel}>
            {selectedEmpFilter === 'ALL' ? 'Staff Members' : 'Active Profile'}
          </Text>
        </View>
        
        <View style={[styles.statBoxSummary, { borderLeftColor: '#38A169' }]}>
          <Text style={[styles.statBoxNumber, { color: '#2F855A' }]}>{presentCount}</Text>
          <Text style={styles.statBoxLabel}>Days Present</Text>
        </View>

        <View style={[styles.statBoxSummary, { borderLeftColor: '#E53E3E' }]}>
          <Text style={[styles.statBoxNumber, { color: '#C53030' }]}>{absentCount}</Text>
          <Text style={styles.statBoxLabel}>Days Absent</Text>
        </View>
      </View>

      {/* FILTER CAROUSEL */}
      <Text style={styles.sectionHeadingLabel}>Workforce Filter Focal Point</Text>
      <View style={styles.pillScrollFrame}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity style={[styles.filterPill, selectedEmpFilter === 'ALL' && styles.activeFilterPill]} onPress={() => setSelectedEmpFilter('ALL')}>
            <Text style={[styles.filterPillText, selectedEmpFilter === 'ALL' && styles.activeFilterPillText]}>🌐 Global Workforce</Text>
          </TouchableOpacity>
          {employees.filter(e => e.role !== 'ADMIN_VIEW').map((emp) => (
            <TouchableOpacity key={emp._id} style={[styles.filterPill, selectedEmpFilter === emp.name && styles.activeFilterPill]} onPress={() => setSelectedEmpFilter(emp.name)}>
              <Text style={[styles.filterPillText, selectedEmpFilter === emp.name && styles.activeFilterPillText]}>👤 {emp.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* CALENDAR MONTH SELECTION STRIP */}
      <Text style={styles.sectionHeadingLabel}>Select Active Tracking Month ({new Date().getFullYear()})</Text>
      <View style={[styles.pillScrollFrame, { marginBottom: 14 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {availableMonths.map((month) => (
            <TouchableOpacity 
              key={month} 
              style={[styles.monthFilterPill, selectedMonthFilter === month && styles.activeMonthFilterPill]} 
              onPress={() => setSelectedMonthFilter(month)}
            >
              <Text style={[styles.monthFilterPillText, selectedMonthFilter === month && styles.activeMonthFilterPillText]}>
                📅 {month}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* CHRONOLOGICAL LOG FEED */}
      <Text style={styles.sectionHeadingLabel}>{selectedMonthFilter} Verification Stream</Text>
      
      {isLoading ? (
        <View style={styles.loaderCenterFrame}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loaderLabelSub}>Compiling shift logs framework...</Text>
        </View>
      ) : filteredLogs.length === 0 ? (
        <View style={styles.emptyCardFrame}>
          <Text style={styles.emptyTextMessage}>No log items recorded inside {selectedMonthFilter} {new Date().getFullYear()}.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {filteredLogs.map((logItem) => {
            const isExpanded = expandedLogId === logItem._id;
            const hasInPhoto = !!logItem.capturedPhotoInUri;
            const hasOutPhoto = !!logItem.capturedPhotoOutUri;
            const isAbsent = logItem.loginTime === 'ABSENT' || logItem.logoutTime === 'ABSENT';

            return (
              <View key={logItem._id} style={styles.dayGroupCardWrapper}>
                
                <TouchableOpacity
                  activeOpacity={0.75}
                  style={[
                    styles.dataLogCard, 
                    isExpanded && styles.dataLogCardExpanded,
                    isAbsent && styles.dataLogCardAbsent
                  ]}
                  onPress={() => !isAbsent && handleToggleLogDrawer(logItem._id)}
                >
                  <View style={styles.logCardHeader}>
                    <View>
                      <Text style={styles.logEmployeeIdentity}>{logItem.employeeName}</Text>
                      <Text style={styles.logEmployeeIdSub}>ID reference: {logItem.employeeIdReference}</Text>
                    </View>
                    
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={[styles.dateBadge, isAbsent && { backgroundColor: '#FED7D7', borderColor: '#FEB2B2' }]}>
                        <Text style={[styles.dateBadgeText, isAbsent && { color: '#9B2C2C' }]}>{logItem.date}</Text>
                      </View>
                      {(hasInPhoto || hasOutPhoto) && !isAbsent && (
                        <View style={styles.photoLoggedBadge}>
                          <Text style={styles.photoLoggedBadgeText}>📸 Photos Ready</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  
                  <View style={styles.punchMetricsRow}>
                    <View style={[styles.metricBox, { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' }, isAbsent && { backgroundColor: '#FFF5F5', borderColor: '#FED7D7' }]}>
                      <Text style={[styles.metricLabel, { color: '#16A34A' }, isAbsent && { color: '#E53E3E' }]}>DURATION</Text>
                      <Text style={[styles.metricTime, { color: '#15803D' }, isAbsent && { color: '#E53E3E' }]}>
                        {calculateWorkingHours(logItem.loginTime, logItem.logoutTime)}
                      </Text>
                    </View>

                    <View style={[styles.metricBox, isAbsent && { borderColor: '#FEB2B2', backgroundColor: '#FFF5F5' }]}>
                      <Text style={styles.metricLabel}>PUNCH IN</Text>
                      <Text style={[styles.metricTime, isAbsent ? { color: '#E53E3E' } : { color: '#2F855A' }]}>
                        {logItem.loginTime}
                      </Text>
                    </View>
                    <View style={[styles.metricBox, isAbsent && { borderColor: '#FEB2B2', backgroundColor: '#FFF5F5' }]}>
                      <Text style={styles.metricLabel}>PUNCH OUT</Text>
                      <Text style={[styles.metricTime, isAbsent ? { color: '#E53E3E' } : { color: '#4A5568' }]}>
                        {logItem.logoutTime}
                      </Text>
                    </View>
                  </View>

                  {(hasInPhoto || hasOutPhoto) && !isExpanded && !isAbsent && (
                    <Text style={styles.expandTipText}>Tap card to inspect compliance captures ▼</Text>
                  )}
                </TouchableOpacity>

                {/* EXPANDABLE DUAL PHOTO DRAWER WITH GEOTAG OVERLAY STAMP */}
                {isExpanded && !isAbsent && (
                  <View style={styles.photoDrawerContainer}>
                    <Text style={styles.drawerLabelTitle}>Biometric Verification Snapshots:</Text>
                    <View style={styles.photoGridRow}>
                      
                      {/* 📥 PUNCH IN THUMBNAIL */}
                      <View style={styles.photoBlock}>
                        <Text style={styles.photoGridLabel}>📥 Punch In Capture:</Text>
                        {hasInPhoto ? (
                          <TouchableOpacity 
                            activeOpacity={0.85}
                            onPress={() => openPhotoModal(logItem.capturedPhotoInUri!, logItem.locationInAddress, 'LOGIN', logItem.date, logItem.loginTime)}
                            style={styles.imageOverlayWrapper}
                          >
                            <Image source={{ uri: logItem.capturedPhotoInUri }} style={styles.drawerSelfiePreviewImage} />
                            <View style={styles.thumbnailGeotagStamp}>
                              <Ionicons name="location-sharp" size={9} color="#FFD700" style={{ marginRight: 2 }} />
                              <Text style={styles.thumbnailGeotagText} numberOfLines={1}>
                                {logItem.locationInAddress || ''}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.noImageDashedPlaceholder}>
                            <Text style={styles.noImagePlaceholderText}>No Punch In Photo</Text>
                          </View>
                        )}
                      </View>

                      {/* 📤 PUNCH OUT THUMBNAIL */}
                      <View style={styles.photoBlock}>
                        <Text style={styles.photoGridLabel}>📤 Punch Out Capture:</Text>
                        {hasOutPhoto ? (
                          <TouchableOpacity 
                            activeOpacity={0.85}
                            onPress={() => openPhotoModal(logItem.capturedPhotoOutUri!, logItem.locationOutAddress, 'LOGOUT', logItem.date, logItem.logoutTime)}
                            style={styles.imageOverlayWrapper}
                          >
                            <Image source={{ uri: logItem.capturedPhotoOutUri }} style={styles.drawerSelfiePreviewImage} />
                            <View style={styles.thumbnailGeotagStamp}>
                              <Ionicons name="location-sharp" size={9} color="#FFD700" style={{ marginRight: 2 }} />
                              <Text style={styles.thumbnailGeotagText} numberOfLines={1}>
                                {logItem.locationOutAddress || ''}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.noImageDashedPlaceholder}>
                            <Text style={styles.noImagePlaceholderText}>No Punch Out Photo</Text>
                          </View>
                        )}
                      </View>

                    </View>
                  </View>
                )}

              </View>
            );
          })}
        </ScrollView>
      )}

      {/* POPUP MODAL EXCLUSIVELY RENDERS EXACT CAPTURED GEOLOCATION */}
      <Modal
        visible={modalState.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={closePhotoModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCardContainer}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={closePhotoModal}>
              <Ionicons name="close-circle" size={32} color="#FFFFFF" />
            </TouchableOpacity>

            {modalState.imageUri && (
              <View style={styles.geotagPhotoFrame}>
                <Image source={{ uri: modalState.imageUri }} style={styles.modalFullImage} />

                <View style={styles.geotagStampOverlay}>
                  <View style={styles.geotagStampHeader}>
                    <Ionicons name="location" size={13} color="#FFD700" />
                    <Text style={styles.geotagStampTitle}>GPS MAP CAMERA</Text>
                  </View>
                  
                  <Text style={styles.geotagStampAddress}>
                    {modalState.location}
                  </Text>
                  
                  <View style={styles.geotagStampMetaRow}>
                    <Text style={styles.geotagStampMetaText}>
                      {modalState.date} • {modalState.time} • {modalState.type} VERIFIED
                    </Text>
                  </View>
                </View>

              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA', paddingHorizontal: 16, paddingTop: 50 },
  headerHeroCard: { backgroundColor: '#1A202C', padding: 20, borderRadius: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerInfoBlock: { flex: 1 },
  headerSubtitle: { color: '#A0AEC0', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 2 },
  exitBadgeBtn: { backgroundColor: '#4A5568', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  exitBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  sectionHeadingLabel: { fontSize: 11, fontWeight: '800', color: '#2B6CB0', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 4, paddingLeft: 2 },
  summaryGridContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 14 },
  statBoxSummary: { width: '31.5%', borderRadius: 16, padding: 12, borderWidth: 1, backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderLeftWidth: 4 },
  statBoxNumber: { fontSize: 19, fontWeight: '800', color: '#1A202C' },
  statBoxLabel: { fontSize: 9, fontWeight: '700', color: '#718096', marginTop: 3 },
  pillScrollFrame: { maxHeight: 44, marginBottom: 12 },
  filterPill: { backgroundColor: '#E2E8F0', paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderRadius: 14, marginRight: 6, height: 36, borderWidth: 1, borderColor: '#CBD5E0' },
  activeFilterPill: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  filterPillText: { fontSize: 12, color: '#4A5568', fontWeight: '700' },
  activeFilterPillText: { color: '#FFFFFF' },
  monthFilterPill: { backgroundColor: '#EDF2F7', paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderRadius: 14, marginRight: 6, height: 36, borderWidth: 1, borderColor: '#E2E8F0' },
  activeMonthFilterPill: { backgroundColor: '#805AD5', borderColor: '#805AD5' },
  monthFilterPillText: { fontSize: 12, color: '#4A5568', fontWeight: '700' },
  activeMonthFilterPillText: { color: '#FFFFFF' },
  dayGroupCardWrapper: { marginBottom: 12 },
  dataLogCard: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 5 },
  dataLogCardExpanded: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0, borderColor: '#CBD5E0' },
  dataLogCardAbsent: { backgroundColor: '#FFF5F5', borderColor: '#FED7D7' },
  logCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#EDF2F7', paddingBottom: 10, marginBottom: 12 },
  logEmployeeIdentity: { fontSize: 14, fontWeight: '800', color: '#2D3748' },
  logEmployeeIdSub: { fontSize: 11, fontWeight: '600', color: '#A0AEC0', marginTop: 1 },
  dateBadge: { backgroundColor: '#F7FAFC', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  dateBadgeText: { fontSize: 11, color: '#4A5568', fontWeight: '700' },
  photoLoggedBadge: { backgroundColor: '#EBF8FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#BEE3F8', marginTop: 4, alignSelf: 'flex-end' },
  photoLoggedBadgeText: { color: '#2B6CB0', fontSize: 9, fontWeight: '700' },
  punchMetricsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metricBox: { flex: 1, backgroundColor: '#F7FAFC', padding: 10, borderRadius: 12, alignItems: 'center', marginHorizontal: 2, borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabel: { fontSize: 9, fontWeight: '800', color: '#A0AEC0', marginBottom: 2 },
  metricTime: { fontSize: 12, fontWeight: '800' },
  expandTipText: { fontSize: 10, color: '#A0AEC0', fontWeight: '600', textAlign: 'center', marginTop: 10, letterSpacing: 0.1 },
  photoDrawerContainer: { backgroundColor: '#F8FAFC', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, borderWidth: 1, borderColor: '#CBD5E0', padding: 14 },
  drawerLabelTitle: { fontSize: 11, fontWeight: '800', color: '#4A5568', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
  photoGridRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  photoBlock: { width: '48%' },
  photoGridLabel: { fontSize: 10, fontWeight: '700', color: '#718096', marginBottom: 4 },
  
  imageOverlayWrapper: { position: 'relative', overflow: 'hidden', borderRadius: 12 },
  drawerSelfiePreviewImage: { width: '100%', height: 140, backgroundColor: '#EDF2F7', resizeMode: 'cover' },
  thumbnailGeotagStamp: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', paddingVertical: 4, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center' },
  thumbnailGeotagText: { color: '#FFFFFF', fontSize: 8, fontWeight: '700', flex: 1 },

  noImageDashedPlaceholder: { width: '100%', height: 140, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E0', justifyContent: 'center', alignItems: 'center' },
  noImagePlaceholderText: { color: '#A0AEC0', fontSize: 11, fontWeight: '600', fontStyle: 'italic' },
  loaderCenterFrame: { paddingVertical: 50, alignItems: 'center', justifyContent: 'center' },
  loaderLabelSub: { color: '#718096', fontSize: 13, fontWeight: '600', marginTop: 12 },
  emptyCardFrame: { backgroundColor: '#FFFFFF', padding: 30, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  emptyTextMessage: { color: '#A0AEC0', fontSize: 13, fontStyle: 'italic', fontWeight: '600', textAlign: 'center' },

  /* POPUP MODAL & GEOTAG OVERLAY STYLES */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCardContainer: { width: '100%', maxWidth: 360, alignItems: 'center', position: 'relative' },
  modalCloseButton: { position: 'absolute', top: -45, right: 0, zIndex: 10 },
  
  geotagPhotoFrame: { width: '100%', height: 460, borderRadius: 20, overflow: 'hidden', position: 'relative', backgroundColor: '#000', borderWidth: 2, borderColor: '#FFFFFF' },
  modalFullImage: { width: '100%', height: '100%', resizeMode: 'cover' },

  geotagStampOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(18, 18, 18, 0.88)',
    padding: 12,
  },
  geotagStampHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  geotagStampTitle: { color: '#FFD700', fontSize: 10, fontWeight: '900', marginLeft: 5, letterSpacing: 0.8 },
  geotagStampAddress: { color: '#FFFFFF', fontSize: 10, fontWeight: '600', lineHeight: 14, marginBottom: 8 },
  geotagStampMetaRow: { borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.2)', paddingTop: 6 },
  geotagStampMetaText: { color: '#E2E8F0', fontSize: 9, fontWeight: '700', letterSpacing: 0.2 }
});