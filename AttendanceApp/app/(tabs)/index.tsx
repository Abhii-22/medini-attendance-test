import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, RefreshControl, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, API_BASE_URL } from '../_layout';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  
  const [presentCount, setPresentCount] = useState<number>(0);
  const [absentCount, setAbsentCount] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [todayPunch, setTodayPunch] = useState({ in: '--:--', out: '--:--' });

  const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long' });

  const employeeName = currentUser?.name || 'Employee';
  const employeeRole = currentUser?.designation || 'Staff Member';
  const employeeId = currentUser?.employeeId || 'N/A';

  const getGreetingSegmentText = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good Morning';
    if (hr < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getTodayDateString = () => {
    return new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // ⏱️ CENTRAL PARSING ENGINE TO CALCULATE WORK HOURS ON THE FLY
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

  const syncDashboardMetricsData = async () => {
    if (!currentUser?.name) return;
    try {
      const response = await fetch(`${API_BASE_URL}/admin/attendance-sheet?employeeName=${currentUser.name}`);
      if (response.ok) {
        const logs = await response.json();
        
        let totalPresents = 0;
        let totalAbsents = 0;

        logs.forEach((log: any) => {
          const matchesCurrentMonth = log.date && log.date.toLowerCase().includes(currentMonthName.toLowerCase());
          
          if (matchesCurrentMonth) {
            if (log.loginTime === 'ABSENT' || log.logoutTime === 'ABSENT') {
              totalAbsents += 1;
            } else if (log.loginTime !== '--:--') {
              totalPresents += 1;
            }
          }
        });

        setPresentCount(totalPresents);
        setAbsentCount(totalAbsents);

        const todayStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const match = logs.find((log: any) => log.date === todayStr);
        if (match) {
          setTodayPunch({ in: match.loginTime, out: match.logoutTime });
        } else {
          setTodayPunch({ in: '--:--', out: '--:--' });
        }
      }
    } catch (error) {
      console.error('Dashboard metrics synchronization error:', error);
    }
  };

  const handlePullToRefresh = async () => {
    setIsRefreshing(true);
    await syncDashboardMetricsData();
    setIsRefreshing(false);
  };

  useEffect(() => {
    syncDashboardMetricsData();
  }, [currentUser]);

  const totalLogs = presentCount + absentCount;
  const ratio = totalLogs > 0 ? Math.round((presentCount / totalLogs) * 100) : 0;

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl 
          refreshing={isRefreshing} 
          onRefresh={handlePullToRefresh} 
          colors={["#007AFF"]}
          tintColor="#007AFF"
        />
      }
    >
      {/* 🟦 HEADER HERO CARD */}
      <View style={styles.dashboardHeroCard}>
        <View style={styles.heroHeaderRow}>
          <View style={styles.heroTextGroup}>
            <Text style={styles.heroTimeLabel}>{getGreetingSegmentText()}</Text>
            <Text style={styles.heroNameHeading} numberOfLines={1}>{employeeName}</Text>
            <Text style={styles.heroRoleTag}>{employeeRole}</Text>
          </View>
          <View style={styles.heroAvatarBadge}>
            <Text style={styles.heroAvatarText}>{employeeName.charAt(0).toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.heroDividerLine} />

        <View style={styles.heroFooterRow}>
          <View style={styles.metaBadgeItem}>
            <Ionicons name="id-card-outline" size={14} color="#B3D7FF" />
            <Text style={styles.heroIdBadgeText}>ID: {employeeId}</Text>
          </View>
          <View style={styles.dateBadgePill}>
            <Ionicons name="calendar-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.dateBadgePillText}>{getTodayDateString()}</Text>
          </View>
        </View>
      </View>

      {/* 📊 GRID METRICS HUB */}
      <View style={styles.sectionHeaderRow}>
        <Ionicons name="analytics" size={16} color="#2B6CB0" />
        <Text style={styles.sectionHeadingLabel}>Performance Metrics ({currentMonthName})</Text>
      </View>
      
      <View style={styles.metricsGridRow}>
        <View style={[styles.metricCardBox, { borderLeftColor: '#38A169' }]}>
          <View style={[styles.iconContainer, { backgroundColor: '#E6F4EA' }]}>
            <Ionicons name="checkmark-circle" size={20} color="#38A169" />
          </View>
          <Text style={styles.metricCardCountValue}>{presentCount}</Text>
          <Text style={styles.metricCardSublabel}>Days Present</Text>
        </View>

        <View style={[styles.metricCardBox, { borderLeftColor: '#E53E3E' }]}>
          <View style={[styles.iconContainer, { backgroundColor: '#FCE8E6' }]}>
            <Ionicons name="close-circle" size={20} color="#E53E3E" />
          </View>
          <Text style={styles.metricCardCountValue}>{absentCount}</Text>
          <Text style={styles.metricCardSublabel}>Days Absent</Text>
        </View>
      </View>

      {/* EFFICIENCY RATIO PANEL */}
      <View style={styles.ratioCard}>
        <View style={styles.ratioLeftFrame}>
          <View style={[styles.iconContainer, { backgroundColor: '#EBF8FF', marginRight: 12 }]}>
            <MaterialCommunityIcons name="speedometer" size={20} color="#007AFF" />
          </View>
          <Text style={styles.ratioLabel}>Monthly Duty Engagement</Text>
        </View>
        <Text style={[styles.ratioValue, ratio > 75 ? { color: '#38A169' } : { color: '#DD6B20' }]}>
          {ratio}%
        </Text>
      </View>

      {/* ⏱️ TODAY'S SHIFT REAL-TIME SUMMARY */}
      <View style={styles.sectionHeaderRow}>
        <Ionicons name="time" size={16} color="#2B6CB0" />
        <Text style={styles.sectionHeadingLabel}>Today's Shift Status</Text>
      </View>
      
      <View style={styles.statusTrackingPanel}>
        <View style={styles.statusBoxItem}>
          <View style={[styles.statusIndicator, todayPunch.in === 'ABSENT' ? { backgroundColor: '#E53E3E' } : todayPunch.in !== '--:--' ? { backgroundColor: '#38A169' } : { backgroundColor: '#CBD5E0' }]} />
          <View style={styles.statusMetaContainer}>
            <Text style={styles.statusBoxTitleLabel}>Punch In</Text>
            <Text style={[
              styles.statusBoxTimeDisplay, 
              todayPunch.in === 'ABSENT' ? { color: '#E53E3E' } : todayPunch.in !== '--:--' ? { color: '#2D3748' } : null
            ]}>
              {todayPunch.in}
            </Text>
          </View>
        </View>

        <View style={styles.statusBoxVerticalDivider} />

        <View style={styles.statusBoxItem}>
          <View style={[styles.statusIndicator, todayPunch.out === 'ABSENT' ? { backgroundColor: '#E53E3E' } : todayPunch.out !== '--:--' ? { backgroundColor: '#007AFF' } : { backgroundColor: '#CBD5E0' }]} />
          <View style={styles.statusMetaContainer}>
            <Text style={styles.statusBoxTitleLabel}>Punch Out</Text>
            <Text style={[
              styles.statusBoxTimeDisplay, 
              todayPunch.out === 'ABSENT' ? { color: '#E53E3E' } : todayPunch.out !== '--:--' ? { color: '#2D3748' } : null
            ]}>
              {todayPunch.out}
            </Text>
          </View>
        </View>
      </View>

      {/* ⏱️ DYNAMIC TODAY'S HOURS WORKED TICKER ACCUMULATOR */}
      <View style={[styles.ratioCard, { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' }]}>
        <View style={styles.ratioLeftFrame}>
          <View style={[styles.iconContainer, { backgroundColor: '#DCFCE7', marginRight: 12 }]}>
            <Ionicons name="timer-outline" size={20} color="#16A34A" />
          </View>
          <Text style={[styles.ratioLabel, { color: '#16A34A' }]}>Accumulated Work Hours Today</Text>
        </View>
        <Text style={[styles.ratioValue, { color: '#15803D' }]}>
          {calculateWorkingHours(todayPunch.in, todayPunch.out)}
        </Text>
      </View>

      {/* 📌 SYSTEM NOTICE ANNOUNCEMENT PLUG */}
      <View style={styles.noticeBoardCardFrame}>
        <View style={styles.noticeHeaderRow}>
          <Ionicons name="information-circle" size={18} color="#2B6CB0" style={{ marginRight: 6 }} />
          <Text style={styles.noticeCardTitleText}>Month Lifecycle Synced</Text>
        </View>
        <Text style={styles.noticeCardBodyText}>
          Your dynamic shift metric arrays reset cleanly at the close of each month cycle. Swipe down on the screen layout container to refresh data streams.
        </Text>
      </View>

      {/* 📍 FLOATING ACTION COMMAND BUTTON */}
      <TouchableOpacity 
        style={styles.masterActionButtonLauncher}
        activeOpacity={0.85}
        onPress={() => router.push('/attendance')}
      >
        <FontAwesome5 name="map-marker-alt" size={14} color="#FFFFFF" style={{ marginRight: 8 }} />
        <Text style={styles.masterActionButtonLauncherText}>Open GPS Verification Desk</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingTop: 20 },
  dashboardHeroCard: { backgroundColor: '#007AFF', padding: 20, borderRadius: 20, shadowColor: '#007AFF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 3, marginBottom: 20 },
  heroHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTextGroup: { flex: 1, paddingRight: 10 },
  heroTimeLabel: { color: '#E0F0FF', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroNameHeading: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 },
  heroRoleTag: { color: '#B3D7FF', fontSize: 13, fontWeight: '600', marginTop: 2 },
  heroAvatarBadge: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  heroAvatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  heroDividerLine: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 14 },
  heroFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaBadgeItem: { flexDirection: 'row', alignItems: 'center' },
  heroIdBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', opacity: 0.9, marginLeft: 5 },
  dateBadgePill: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  dateBadgePillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingLeft: 2 },
  sectionHeadingLabel: { fontSize: 12, fontWeight: '800', color: '#4A5568', textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 6 },
  metricsGridRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 12 },
  metricCardBox: { backgroundColor: '#FFFFFF', width: '48.5%', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1 },
  iconContainer: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  metricCardCountValue: { fontSize: 22, fontWeight: '800', color: '#1A202C' },
  metricCardSublabel: { fontSize: 11, fontWeight: '700', color: '#718096', marginTop: 2 },
  ratioCard: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1 },
  ratioLeftFrame: { flexDirection: 'row', alignItems: 'center' },
  ratioLabel: { fontSize: 13, fontWeight: '700', color: '#4A5568' },
  ratioValue: { fontSize: 15, fontWeight: '800' },
  statusTrackingPanel: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1, marginBottom: 14 },
  statusBoxItem: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  statusIndicator: { width: 4, height: 28, borderRadius: 2 },
  statusMetaContainer: { marginLeft: 10 },
  statusBoxTitleLabel: { color: '#718096', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.2 },
  statusBoxTimeDisplay: { fontSize: 15, fontWeight: '800', color: '#2D3748', marginTop: 2 },
  statusBoxVerticalDivider: { width: 1, height: 34, backgroundColor: '#EDF2F7' },
  noticeBoardCardFrame: { backgroundColor: '#EBF8FF', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#BEE3F8', marginBottom: 20 },
  noticeHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  noticeCardTitleText: { fontSize: 13, fontWeight: '700', color: '#2B6CB0' },
  noticeCardBodyText: { fontSize: 12, color: '#2C5282', lineHeight: 16, fontWeight: '500' },
  masterActionButtonLauncher: { backgroundColor: '#38A169', paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', shadowColor: '#38A169', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 2 },
  masterActionButtonLauncherText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' }
});