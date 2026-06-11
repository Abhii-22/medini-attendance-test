import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator } from 'react-native';
import { useAuth, API_BASE_URL } from '../_layout'; // Hook into permanent cloud credentials context

interface BackendLog {
  _id: string;
  date: string;
  dayOfWeek: string;
  loginTime: string;
  logoutTime: string;
}

export default function HistoryScreen() {
  const { currentUser } = useAuth(); // Safely access the active logged-in worker data
  const [cloudLogs, setCloudLogs] = useState<BackendLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 📥 Pull permanent historical entries from MongoDB Atlas cluster
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

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Attendance Logs Timeline</Text>

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
        <FlatList
          data={cloudLogs}
          keyExtractor={(item) => item._id} // Using MongoDB unique document hash IDs
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View style={styles.dayGroupCard}>
              
              {/* Day and Date Header Summary */}
              <View style={styles.dayHeader}>
                <Text style={styles.dayText}>{item.dayOfWeek}</Text>
                <Text style={styles.dateText}>{item.date}</Text>
              </View>

              {/* Verified Punch In / Punch Out Metadata Box */}
              <View style={styles.punchRow}>
                
                {/* Punch In */}
                <View style={styles.punchItem}>
                  <Text style={styles.punchLabel}>📥 Punch In</Text>
                  <Text style={[styles.punchTime, item.loginTime !== '--:--' ? styles.loginColor : styles.emptyColor]}>
                    {item.loginTime}
                  </Text>
                </View>

                {/* Punch Out */}
                <View style={styles.punchItem}>
                  <Text style={styles.punchLabel}>📤 Punch Out</Text>
                  <Text style={[styles.punchTime, item.logoutTime !== '--:--' ? styles.logoutColor : styles.emptyColor]}>
                    {item.logoutTime}
                  </Text>
                </View>

              </View>

            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA', paddingHorizontal: 16, paddingTop: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A202C', marginBottom: 15, letterSpacing: 0.2 },
  dayGroupCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EDF2F7', paddingBottom: 10, marginBottom: 12 },
  dayText: { fontSize: 17, fontWeight: '800', color: '#2B6CB0' },
  dateText: { fontSize: 13, fontWeight: '600', color: '#A0AEC0' },
  punchRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  punchItem: { width: '48%', backgroundColor: '#F7FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  punchLabel: { fontSize: 12, fontWeight: '700', color: '#718096', marginBottom: 4 },
  punchTime: { fontSize: 15, fontWeight: '800' },
  loginColor: { color: '#38A169' },
  logoutColor: { color: '#E53E3E' },
  emptyColor: { color: '#A0AEC0', fontWeight: '400' },
  emptyContainer: { flex: 0.8, justifyContent: 'center', alignItems: 'center' },
  emptyIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#EDF2F7', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  emptyText: { color: '#718096', fontSize: 15, fontWeight: '600' }
});