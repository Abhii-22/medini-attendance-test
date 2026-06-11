import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, API_BASE_URL } from '../_layout';

export default function HomeScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  
  // Dashboard analytic metric counters states
  const [presentCount, setPresentCount] = useState<number>(0);
  const [absentCount, setAbsentCount] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [todayPunch, setTodayPunch] = useState({ in: '--:--', out: '--:--' });

  // Fallback structural definitions for profile safety
  const employeeName = currentUser?.name || 'Employee';
  const employeeRole = currentUser?.designation || 'Staff Member';
  const employeeId = currentUser?.employeeId || 'N/A';

  const getGreetingSegmentText = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good Morning 🌅';
    if (hr < 17) return 'Good Afternoon ☀️';
    return 'Good Evening 🌙';
  };

  const getTodayDateString = () => {
    return new Date().toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Sync dashboard analytical widgets with database storage telemetry
  const syncDashboardMetricsData = async () => {
    if (!currentUser?.name) return;
    try {
      const response = await fetch(`${API_BASE_URL}/admin/attendance-sheet?employeeName=${currentUser.name}`);
      if (response.ok) {
        const logs = await response.json();
        
        // 📊 Calculate accurate Present vs Absent totals from permanent records
        let totalPresents = 0;
        let totalAbsents = 0;

        logs.forEach((log: any) => {
          if (log.loginTime === 'ABSENT' || log.logoutTime === 'ABSENT') {
            totalAbsents += 1;
          } else if (log.loginTime !== '--:--') {
            totalPresents += 1;
          }
        });

        setPresentCount(totalPresents);
        setAbsentCount(totalAbsents);

        // Extract today's punch data metrics if they exist
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

  // Calculate percentage dynamically based on shifts
  const totalLogs = presentCount + absentCount;
  const ratio = totalLogs > 0 ? Math.round((presentCount / totalLogs) * 100) : 0;

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 30 }}
      refreshControl={
        <RefreshControl 
          refreshing={isRefreshing} 
          onRefresh={handlePullToRefresh} 
          colors={["#007AFF"]}
          tintColor="#007AFF"
        />
      }
    >
      {/* 🟦 TOP LEVEL EXECUTIVE HERO BANNER */}
      <View style={styles.dashboardHeroCard}>
        <View style={styles.heroHeaderRow}>
          <View>
            <Text style={styles.heroTimeLabel}>{getGreetingSegmentText()}</Text>
            <Text style={styles.heroNameHeading}>{employeeName}</Text>
            <Text style={styles.heroRoleTag}>{employeeRole}</Text>
          </View>
          <View style={styles.heroAvatarBadge}>
            <Text style={styles.heroAvatarText}>{employeeName.charAt(0).toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.heroDividerLine} />

        <View style={styles.heroFooterRow}>
          <Text style={styles.heroIdBadgeText}>ID: {employeeId}</Text>
          <View style={styles.dateBadgePill}>
            <Text style={styles.dateBadgePillText}>🗓️ {getTodayDateString()}</Text>
          </View>
        </View>
      </View>

      {/* 📊 GRID METRICS HUB CONTAINER */}
      <Text style={styles.sectionHeadingLabel}>Performance Key Metrics</Text>
      <View style={styles.metricsGridRow}>
        <View style={[styles.metricCardBox, { borderLeftWidth: 5, borderLeftColor: '#38A169' }]}>
          <Text style={styles.metricCardEmoji}>✅</Text>
          <Text style={styles.metricCardCountValue}>{presentCount}</Text>
          <Text style={styles.metricCardSublabel}>Days Present</Text>
        </View>

        <View style={[styles.metricCardBox, { borderLeftWidth: 5, borderLeftColor: '#E53E3E' }]}>
          <Text style={styles.metricCardEmoji}>❌</Text>
          <Text style={styles.metricCardCountValue}>{absentCount}</Text>
          <Text style={styles.metricCardSublabel}>Days Absent</Text>
        </View>
      </View>

      {/* EFFICIENCY RATIO PANEL */}
      <View style={styles.ratioCard}>
        <Text style={styles.ratioLabel}>Total Duty Engagement Ratio</Text>
        <Text style={[styles.ratioValue, ratio > 75 ? { color: '#38A169' } : { color: '#DD6B20' }]}>
          {ratio}%
        </Text>
      </View>

      {/* ⏱️ TODAY'S SHIFT REAL-TIME SUMMARY */}
      <Text style={styles.sectionHeadingLabel}>Today's Shift Status</Text>
      <View style={styles.statusTrackingPanel}>
        <View style={styles.statusBoxItem}>
          <View style={[styles.statusIndicatorIndicator, todayPunch.in === 'ABSENT' ? { backgroundColor: '#E53E3E' } : { backgroundColor: '#4CAF50' }]} />
          <View style={styles.statusMetaContainer}>
            <Text style={styles.statusBoxTitleLabel}>Punch In Time</Text>
            <Text style={[
              styles.statusBoxTimeDisplay, 
              todayPunch.in === 'ABSENT' ? { color: '#E53E3E' } : todayPunch.in !== '--:--' ? { color: '#4CAF50' } : null
            ]}>
              {todayPunch.in}
            </Text>
          </View>
        </View>

        <View style={styles.statusBoxVerticalDivider} />

        <View style={styles.statusBoxItem}>
          <View style={[styles.statusIndicatorIndicator, todayPunch.out === 'ABSENT' ? { backgroundColor: '#E53E3E' } : { backgroundColor: '#8E8E93' }]} />
          <View style={styles.statusMetaContainer}>
            <Text style={styles.statusBoxTitleLabel}>Punch Out Time</Text>
            <Text style={[
              styles.statusBoxTimeDisplay, 
              todayPunch.out === 'ABSENT' ? { color: '#E53E3E' } : todayPunch.out !== '--:--' ? { color: '#E53E3E' } : null
            ]}>
              {todayPunch.out}
            </Text>
          </View>
        </View>
      </View>

      {/* 📌 SYSTEM NOTICE ANNOUNCEMENT PLUG */}
      <View style={styles.noticeBoardCardFrame}>
        <Text style={styles.noticeCardTitleText}>📌 System Announcement</Text>
        <Text style={styles.noticeCardBodyText}>
          Your structural metrics have synced permanently with MongoDB. Pull down to refresh your attendance metrics if you updated your shift info recently.
        </Text>
      </View>

      {/* 📍 FLOATING ACTION COMMAND PROMPT BUTTON */}
      <TouchableOpacity 
        style={styles.masterActionButtonLauncher}
        activeOpacity={0.85}
        onPress={() => router.push('/attendance')}
      >
        <Text style={styles.masterActionButtonLauncherText}>Launch GPS Verification Desk 📍</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA', paddingHorizontal: 20, paddingTop: 20 },
  
  // Executive Hero Card Styles
  dashboardHeroCard: { backgroundColor: '#007AFF', padding: 22, borderRadius: 24, shadowColor: '#007AFF', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 15, elevation: 4, marginBottom: 25 },
  heroHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTimeLabel: { color: '#E0F0FF', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroNameHeading: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginTop: 2 },
  heroRoleTag: { color: '#B3D7FF', fontSize: 14, fontWeight: '600', marginTop: 3 },
  heroAvatarBadge: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  heroAvatarText: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  heroDividerLine: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 16 },
  heroFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroIdBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', opacity: 0.9 },
  dateBadgePill: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  dateBadgePillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // Section Labels Styles
  sectionHeadingLabel: { fontSize: 13, fontWeight: '800', color: '#2B6CB0', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12, paddingLeft: 2 },

  // Analytics Grid Row Styles
  metricsGridRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 15 },
  metricCardBox: { backgroundColor: '#FFFFFF', width: '48%', borderRadius: 20, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 2 },
  metricCardEmoji: { fontSize: 22, marginBottom: 8 },
  metricCardCountValue: { fontSize: 24, fontWeight: '800', color: '#1A202C' },
  metricCardSublabel: { fontSize: 12, fontWeight: '700', color: '#A0AEC0', marginTop: 3 },

  // Ratio Metrics style
  ratioCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, borderWidth: 1, borderColor: '#E2E8F0' },
  ratioLabel: { fontSize: 13, fontWeight: '700', color: '#4A5568' },
  ratioValue: { fontSize: 18, fontWeight: '800' },

  // Tracking Panel Styles
  statusTrackingPanel: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 25 },
  statusBoxItem: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  statusIndicatorIndicator: { width: 6, height: 32, borderRadius: 3 },
  statusMetaContainer: { marginLeft: 12 },
  statusBoxTitleLabel: { color: '#718096', fontSize: 12, fontWeight: '700' },
  statusBoxTimeDisplay: { fontSize: 16, fontWeight: '800', color: '#2D3748', marginTop: 3 },
  statusBoxVerticalDivider: { width: 1, height: 40, backgroundColor: '#EDF2F7' },

  // System Announcements Box Styles
  noticeBoardCardFrame: { backgroundColor: '#EBF8FF', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#BEE3F8', marginBottom: 25 },
  noticeCardTitleText: { fontSize: 14, fontWeight: '700', color: '#2B6CB0', marginBottom: 4 },
  noticeCardBodyText: { fontSize: 13, color: '#2C5282', lineHeight: 18, fontWeight: '500' },

  // Bottom Interactive Action Button Styles
  masterActionButtonLauncher: { backgroundColor: '#4CAF50', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 2 },
  masterActionButtonLauncherText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }
});