import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Image, Modal } from 'react-native';
import { useAuth, API_BASE_URL } from '../_layout';
import { Ionicons } from '@expo/vector-icons';

interface BackendLog {
  _id: string;
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

export default function HistoryScreen() {
  const { currentUser } = useAuth();
  const [cloudLogs, setCloudLogs] = useState<BackendLog[]>([]);
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

  const calculateWorkingHours = (inTime: string, outTime: string) => {
    if (!inTime || !outTime || inTime === '--:--' || outTime === '--:--' || inTime === 'ABSENT' || outTime === 'ABSENT') {
      return '--';
    }
    try {
      const parseTimeToMinutes = (timeStr: string) => {
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
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

  const fetchPermanentCloudHistory = async () => {
    if (!currentUser?.name) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/attendance-sheet?employeeName=${currentUser.name}`);
      if (response.ok) {
        const data = await response.json();
        setCloudLogs(data);
      }
    } catch (error) {
      console.error('Error syncing permanent log timeline:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPermanentCloudHistory();
  }, [currentUser]);

  const handleToggleDrawer = (id: string) => {
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
      location: location || '', // 🚀 Raw address string directly from backend
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
      <View style={styles.headerTitleRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="time-outline" size={18} color="#1A202C" />
          <Text style={styles.sectionTitle}>Attendance Logs Timeline</Text>
        </View>
        <TouchableOpacity style={styles.refreshIconBtn} onPress={fetchPermanentCloudHistory}>
          <Ionicons name="refresh-outline" size={13} color="#2B6CB0" style={{ marginRight: 4 }} />
          <Text style={styles.refreshIconText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={[styles.emptyText, { marginTop: 10 }]}>Syncing with cloud database...</Text>
        </View>
      ) : cloudLogs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="calendar-outline" size={24} color="#718096" />
          </View>
          <Text style={styles.emptyText}>No active history logs available.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          {cloudLogs.map((item) => {
            const isExpanded = expandedLogId === item._id;
            const hasInPhoto = !!item.capturedPhotoInUri;
            const hasOutPhoto = !!item.capturedPhotoOutUri;
            const isAbsent = item.loginTime === 'ABSENT' || item.logoutTime === 'ABSENT';

            return (
              <View key={item._id} style={styles.dayGroupCardWrapper}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  style={[
                    styles.dayGroupCard, 
                    isExpanded && styles.dayGroupCardExpanded,
                    isAbsent && styles.dayGroupCardAbsent
                  ]}
                  onPress={() => handleToggleDrawer(item._id)}
                >
                  <View style={styles.dayHeader}>
                    <View>
                      <Text style={[styles.dayText, isAbsent && { color: '#E53E3E' }]}>{item.dayOfWeek}</Text>
                      <Text style={styles.dateText}>{item.date}</Text>
                    </View>
                    {(hasInPhoto || hasOutPhoto) && !isAbsent && (
                      <View style={styles.photoLoggedBadge}>
                        <Ionicons name="camera" size={11} color="#007AFF" style={{ marginRight: 3 }} />
                        <Text style={styles.photoLoggedBadgeText}>Photos Logged</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.punchRow}>
                    <View style={[styles.punchItem, { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' }, isAbsent && { backgroundColor: '#FFF5F5', borderColor: '#FED7D7' }]}>
                      <Text style={[styles.punchLabel, { color: '#16A34A' }, isAbsent && { color: '#E53E3E' }]}>DURATION</Text>
                      <Text style={[styles.punchTime, { color: '#15803D' }, isAbsent && { color: '#E53E3E' }]}>
                        {calculateWorkingHours(item.loginTime, item.logoutTime)}
                      </Text>
                    </View>

                    <View style={[styles.punchItem, isAbsent && styles.punchItemAbsent]}>
                      <Text style={styles.punchLabel}>PUNCH IN</Text>
                      <Text style={[styles.punchTime, item.loginTime === 'ABSENT' ? styles.absentColor : item.loginTime !== '--:--' ? styles.loginColor : styles.emptyColor]}>
                        {item.loginTime}
                      </Text>
                    </View>

                    <View style={[styles.punchItem, isAbsent && styles.punchItemAbsent]}>
                      <Text style={styles.punchLabel}>PUNCH OUT</Text>
                      <Text style={[styles.punchTime, item.logoutTime === 'ABSENT' ? styles.absentColor : item.logoutTime !== '--:--' ? styles.logoutColor : styles.emptyColor]}>
                        {item.logoutTime}
                      </Text>
                    </View>
                  </View>

                  {(hasInPhoto || hasOutPhoto) && !isExpanded && !isAbsent && (
                    <Text style={styles.expandTipText}>Tap card to inspect compliance captures ▼</Text>
                  )}
                </TouchableOpacity>

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
                            onPress={() => openPhotoModal(item.capturedPhotoInUri!, item.locationInAddress, 'LOGIN', item.date, item.loginTime)}
                            style={styles.imageOverlayWrapper}
                          >
                            <Image source={{ uri: item.capturedPhotoInUri }} style={styles.drawerSelfiePreviewImage} />
                            
                            <View style={styles.thumbnailGeotagStamp}>
                              <Ionicons name="location-sharp" size={9} color="#FFD700" style={{ marginRight: 2 }} />
                              <Text style={styles.thumbnailGeotagText} numberOfLines={1}>
                                {item.locationInAddress || ''}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.noImageDashedPlaceholder}>
                            <Ionicons name="image-outline" size={20} color="#A0AEC0" style={{ marginBottom: 4 }} />
                            <Text style={styles.noImagePlaceholderText}>No Photo Saved</Text>
                          </View>
                        )}
                      </View>

                      {/* 📤 PUNCH OUT THUMBNAIL */}
                      <View style={styles.photoBlock}>
                        <Text style={styles.photoGridLabel}>📤 Punch Out Capture:</Text>
                        {hasOutPhoto ? (
                          <TouchableOpacity 
                            activeOpacity={0.85}
                            onPress={() => openPhotoModal(item.capturedPhotoOutUri!, item.locationOutAddress, 'LOGOUT', item.date, item.logoutTime)}
                            style={styles.imageOverlayWrapper}
                          >
                            <Image source={{ uri: item.capturedPhotoOutUri }} style={styles.drawerSelfiePreviewImage} />
                            
                            <View style={styles.thumbnailGeotagStamp}>
                              <Ionicons name="location-sharp" size={9} color="#FFD700" style={{ marginRight: 2 }} />
                              <Text style={styles.thumbnailGeotagText} numberOfLines={1}>
                                {item.locationOutAddress || ''}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.noImageDashedPlaceholder}>
                            <Ionicons name="image-outline" size={20} color="#A0AEC0" style={{ marginBottom: 4 }} />
                            <Text style={styles.noImagePlaceholderText}>No Photo Saved</Text>
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

      {/* POPUP MODAL */}
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
                  
                  {/* EXACT LOCATION TEXT CAPTURED */}
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
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingTop: 20 },
  headerTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#1A202C', marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  refreshIconBtn: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.01, shadowRadius: 2, elevation: 1 },
  refreshIconText: { color: '#4A5568', fontSize: 11, fontWeight: '700' },
  
  dayGroupCardWrapper: { marginBottom: 10 },
  dayGroupCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1 },
  dayGroupCardExpanded: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0, borderColor: '#CBD5E0', shadowOpacity: 0, elevation: 0 },
  dayGroupCardAbsent: { backgroundColor: '#FFF5F5', borderColor: '#FED7D7' },
  
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#EDF2F7', paddingBottom: 10, marginBottom: 12 },
  dayText: { fontSize: 14, fontWeight: '800', color: '#007AFF' },
  dateText: { fontSize: 12, fontWeight: '600', color: '#A0AEC0', marginTop: 1 },
  photoLoggedBadge: { backgroundColor: '#EBF4FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#BEE3F8', flexDirection: 'row', alignItems: 'center' },
  photoLoggedBadgeText: { color: '#007AFF', fontSize: 10, fontWeight: '700' },
  
  punchRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  punchItem: { width: '31.5%', backgroundColor: '#F7FAFC', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  punchItemAbsent: { backgroundColor: '#FFF5F5', borderColor: '#FED7D7' },
  punchLabel: { fontSize: 9, fontWeight: '800', color: '#A0AEC0', marginBottom: 4 },
  punchTime: { fontSize: 12, fontWeight: '800' },
  
  loginColor: { color: '#38A169' },
  logoutColor: { color: '#4A5568' },
  absentColor: { color: '#E53E3E' },
  emptyColor: { color: '#A0AEC0', fontWeight: '400' },
  expandTipText: { fontSize: 10, color: '#A0AEC0', fontWeight: '600', textAlign: 'center', marginTop: 10, letterSpacing: 0.1 },
  
  photoDrawerContainer: { backgroundColor: '#F8FAFC', borderBottomLeftRadius: 16, borderBottomRightRadius: 16, borderWidth: 1, borderColor: '#CBD5E0', padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1 },
  drawerLabelTitle: { fontSize: 11, fontWeight: '800', color: '#718096', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
  photoGridRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  photoBlock: { width: '48%' },
  photoGridLabel: { fontSize: 10, fontWeight: '700', color: '#718096', marginBottom: 4 },
  
  imageOverlayWrapper: { position: 'relative', overflow: 'hidden', borderRadius: 12 },
  drawerSelfiePreviewImage: { width: '100%', height: 140, backgroundColor: '#EDF2F7', resizeMode: 'cover' },
  
  thumbnailGeotagStamp: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', paddingVertical: 4, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center' },
  thumbnailGeotagText: { color: '#FFFFFF', fontSize: 8, fontWeight: '700', flex: 1 },

  noImageDashedPlaceholder: { width: '100%', paddingVertical: 36, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E0', justifyContent: 'center', alignItems: 'center' },
  noImagePlaceholderText: { color: '#A0AEC0', fontSize: 11, fontWeight: '600', fontStyle: 'italic' },
  
  emptyContainer: { flex: 0.8, justifyContent: 'center', alignItems: 'center', minHeight: 300 },
  emptyIconCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#EDF2F7', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  emptyText: { color: '#718096', fontSize: 14, fontWeight: '600' },

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