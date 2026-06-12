import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useAuth, API_BASE_URL } from '../_layout'; // Hook into permanent cloud credentials context

interface BackendLog {
  _id: string;
  date: string;
  dayOfWeek: string;
  loginTime: string;
  logoutTime: string;
  capturedPhotoInUri?: string;
  capturedPhotoOutUri?: string;
}

export default function HistoryScreen() {
  const { currentUser } = useAuth(); // Safely access the active logged-in worker data
  const [cloudLogs, setCloudLogs] = useState<BackendLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Pull permanent historical entries from MongoDB Atlas cluster
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

  // Re-run the network synchronization engine automatically on load
  useEffect(() => {
    fetchPermanentCloudHistory();
  }, [currentUser]);

  const handleToggleDrawer = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerTitleRow}>
        <Text style={styles.sectionTitle}>Attendance Logs Timeline</Text>
        <TouchableOpacity style={styles.refreshIconBtn} onPress={fetchPermanentCloudHistory}>
          <Text style={styles.refreshIconText}>Refresh 🔄</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={[styles.emptyText, { marginTop: 10 }]}>Syncing with cloud database...</Text>
        </View>
      ) : cloudLogs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Text style={{ fontSize: 32 }}>📅</Text>
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
                  {/* Day and Date Header Summary */}
                  <View style={styles.dayHeader}>
                    <View>
                      <Text style={[styles.dayText, isAbsent && { color: '#C53030' }]}>{item.dayOfWeek}</Text>
                      <Text style={styles.dateText}>{item.date}</Text>
                    </View>
                    {(hasInPhoto || hasOutPhoto) && !isAbsent && (
                      <View style={styles.photoLoggedBadge}>
                        <Text style={styles.photoLoggedBadgeText}>📸 Photos Logged</Text>
                      </View>
                    )}
                  </View>

                  {/* Verified Punch In / Punch Out Metadata Box */}
                  <View style={styles.punchRow}>
                    {/* Punch In */}
                    <View style={[styles.punchItem, isAbsent && styles.punchItemAbsent]}>
                      <Text style={styles.punchLabel}>📥 Punch In</Text>
                      <Text style={[styles.punchTime, item.loginTime === 'ABSENT' ? styles.absentColor : item.loginTime !== '--:--' ? styles.loginColor : styles.emptyColor]}>
                        {item.loginTime}
                      </Text>
                    </View>

                    {/* Punch Out */}
                    <View style={[styles.punchItem, isAbsent && styles.punchItemAbsent]}>
                      <Text style={styles.punchLabel}>📤 Punch Out</Text>
                      <Text style={[styles.punchTime, item.logoutTime === 'ABSENT' ? styles.absentColor : item.logoutTime !== '--:--' ? styles.logoutColor : styles.emptyColor]}>
                        {item.logoutTime}
                      </Text>
                    </View>
                  </View>

                  {(hasInPhoto || hasOutPhoto) && !isExpanded && !isAbsent && (
                    <Text style={styles.expandTipText}>Tap record card to inspect compliance captures ▼</Text>
                  )}
                </TouchableOpacity>

                {/* Expandable Dual Photo Drawer Layout */}
                {isExpanded && !isAbsent && (
                  <View style={styles.photoDrawerContainer}>
                    <Text style={styles.drawerLabelTitle}>Biometric Verification Snapshots:</Text>
                    <View style={styles.photoGridRow}>
                      
                      {/* Punch In Image Block */}
                      <View style={styles.photoBlock}>
                        <Text style={styles.photoGridLabel}>📥 Punch In Capture:</Text>
                        {hasInPhoto ? (
                          <Image source={{ uri: item.capturedPhotoInUri }} style={styles.drawerSelfiePreviewImage} />
                        ) : (
                          <View style={styles.noImageDashedPlaceholder}>
                            <Text style={styles.noImagePlaceholderText}>No Punch In Photo</Text>
                          </View>
                        )}
                      </View>

                      {/* Punch Out Image Block */}
                      <View style={{ width: '48%' }}>
                        <Text style={styles.photoGridLabel}>📤 Punch Out Capture:</Text>
                        {hasOutPhoto ? (
                          <Image source={{ uri: item.capturedPhotoOutUri }} style={styles.drawerSelfiePreviewImage} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA', paddingHorizontal: 16, paddingTop: 15 },
  headerTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A202C', letterSpacing: 0.2 },
  refreshIconBtn: { backgroundColor: '#EBF8FF', borderWidth: 1, borderColor: '#BEE3F8', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  refreshIconText: { color: '#2B6CB0', fontSize: 12, fontWeight: '700' },
  
  dayGroupCardWrapper: { marginBottom: 12 },
  dayGroupCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10, elevation: 2 },
  dayGroupCardExpanded: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0, borderColor: '#CBD5E0' },
  dayGroupCardAbsent: { backgroundColor: '#FFF5F5', borderColor: '#FED7D7' },
  
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#EDF2F7', paddingBottom: 10, marginBottom: 12 },
  dayText: { fontSize: 16, fontWeight: '800', color: '#2B6CB0' },
  dateText: { fontSize: 12, fontWeight: '600', color: '#A0AEC0', marginTop: 1 },
  photoLoggedBadge: { backgroundColor: '#EBF8FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#BEE3F8' },
  photoLoggedBadgeText: { color: '#2B6CB0', fontSize: 10, fontWeight: '700' },
  
  punchRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  punchItem: { width: '48%', backgroundColor: '#F7FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  punchItemAbsent: { backgroundColor: '#FFF5F5', borderColor: '#FED7D7' },
  punchLabel: { fontSize: 11, fontWeight: '700', color: '#718096', marginBottom: 4 },
  punchTime: { fontSize: 14, fontWeight: '800' },
  
  loginColor: { color: '#38A169' },
  logoutColor: { color: '#4A5568' },
  absentColor: { color: '#E53E3E' },
  emptyColor: { color: '#A0AEC0', fontWeight: '400' },
  expandTipText: { fontSize: 10, color: '#A0AEC0', fontWeight: '600', textAlign: 'center', marginTop: 10, letterSpacing: 0.1 },
  
  // Expandable Drawer Styles
  photoDrawerContainer: { backgroundColor: '#F8FAFC', borderBottomLeftRadius: 16, borderBottomRightRadius: 16, borderWidth: 1, borderColor: '#CBD5E0', padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 5 },
  drawerLabelTitle: { fontSize: 11, fontWeight: '800', color: '#4A5568', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
  photoGridRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  photoBlock: { width: '48%' },
  photoGridLabel: { fontSize: 10, fontWeight: '700', color: '#718096', marginBottom: 4 },
  drawerSelfiePreviewImage: { width: '100%', height: 150, borderRadius: 12, backgroundColor: '#EDF2F7', resizeMode: 'cover' },
  noImageDashedPlaceholder: { width: '100%', height: 150, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E0', justifyContent: 'center', alignItems: 'center' },
  noImagePlaceholderText: { color: '#A0AEC0', fontSize: 11, fontWeight: '600', fontStyle: 'italic' },
  
  emptyContainer: { flex: 0.8, justifyContent: 'center', alignItems: 'center' },
  emptyIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#EDF2F7', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  emptyText: { color: '#718096', fontSize: 15, fontWeight: '600' }
});