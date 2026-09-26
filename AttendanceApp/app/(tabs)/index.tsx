import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, RefreshControl, Dimensions, Image, Platform, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, API_BASE_URL } from '../_layout';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface EmployeeProfile {
  _id: string;
  name: string;
  employeeId: string;
  designation: string;
  email: string;
  lunchBreakMinutes?: number;
  monthlyCasualLeaveLimit?: number;
  role?: string[];
}

const getSundaysCountForMonth = (monthIndex: number, year: number) => {
  const now = new Date();
  const todayDate = (monthIndex === now.getMonth() && year === now.getFullYear()) ? now.getDate() : new Date(year, monthIndex + 1, 0).getDate();
  
  let sundayCount = 0;
  for (let day = 1; day <= todayDate; day++) {
    const date = new Date(year, monthIndex, day);
    if (date.getDay() === 0) {
      sundayCount++;
    }
  }
  return sundayCount;
};

export default function HomeScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [presentCount, setPresentCount] = useState<number>(0);
  const [absentCount, setAbsentCount] = useState<number>(0);
  const [clCount, setClCount] = useState<number>(0);
  const [holidayCount, setHolidayCount] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [todayPunch, setTodayPunch] = useState({ in: '--:--', out: '--:--' });
  const [employeesList, setEmployeesList] = useState<EmployeeProfile[]>([]);
  const [showMonthPickerModal, setShowMonthPickerModal] = useState<boolean>(false);

  const availableMonths = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthNameToIndex: { [key: string]: number } = {
    January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
    July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
  };

  const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long' });
  const [selectedDashboardMonth, setSelectedDashboardMonth] = useState<string>(currentMonthName);

  const selectedMonthIndex = monthNameToIndex[selectedDashboardMonth] ?? new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const sundayCount = getSundaysCountForMonth(selectedMonthIndex, currentYear);

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

  const fetchEmployeesList = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/employees`);
      if (response.ok) {
        const data = await response.json();
        setEmployeesList(data);
      }
    } catch (error) {
      console.error('Failed fetching employees registry:', error);
    }
  };

  const fetchHolidaysCountForSelectedMonth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/holidays`);
      if (response.ok) {
        const data = await response.json();
        const now = new Date();
        const todayDateNum = (selectedMonthIndex === now.getMonth() && currentYear === now.getFullYear()) ? now.getDate() : new Date(currentYear, selectedMonthIndex + 1, 0).getDate();

        let count = 0;
        data.forEach((h: any) => {
          if (h.date) {
            const cleanStr = String(h.date).replace(',', '').trim();
            const parts = cleanStr.split(/\s+/);
            
            let hDate: Date | null = null;
            if (parts.length >= 3 && monthNameToIndex[parts[0]] !== undefined) {
              const mIndex = monthNameToIndex[parts[0]];
              const dayNum = parseInt(parts[1], 10);
              const yearNum = parseInt(parts[2], 10);
              if (!isNaN(dayNum) && !isNaN(yearNum)) {
                hDate = new Date(yearNum, mIndex, dayNum);
              }
            }

            if (!hDate || isNaN(hDate.getTime())) {
              hDate = new Date(h.date);
            }

            if (
              hDate &&
              !isNaN(hDate.getTime()) &&
              hDate.getFullYear() === currentYear &&
              hDate.getMonth() === selectedMonthIndex &&
              (selectedMonthIndex !== now.getMonth() || hDate.getDate() <= todayDateNum)
            ) {
              count++;
            }
          }
        });
        setHolidayCount(count);
      }
    } catch (e) {
      console.error('Error fetching holidays count:', e);
    }
  };

  const calculateWorkingHours = (inTime: string, outTime: string) => {
    if (!inTime || !outTime || inTime === '--:--' || outTime === '--:--' || inTime === 'ABSENT' || outTime === 'ABSENT' || inTime === 'HOLIDAY' || inTime === 'CASUAL LEAVE') {
      return '--';
    }
    try {
      const parseTimeToMinutes = (timeStr: string) => {
        const cleanTime = timeStr.trim().toUpperCase();
        const isPM = cleanTime.includes('PM');
        const isAM = cleanTime.includes('AM');
        
        const timeOnly = cleanTime.replace(/(AM|PM)/g, '').trim();
        const parts = timeOnly.split(/[:\.]/).map(Number);
        
        let hours = parts[0] || 0;
        const minutes = parts[1] || 0;

        if (isPM && hours < 12) hours += 12;
        if (isAM && hours === 12) hours = 0;

        return hours * 60 + minutes;
      };

      const inMins = parseTimeToMinutes(inTime);
      const outMins = parseTimeToMinutes(outTime);

      const grossMinutes = outMins - inMins;
      if (grossMinutes <= 0) return '0h 0m';

      const cleanCurrentId = currentUser?.employeeId?.toLowerCase().trim();
      const cleanCurrentName = currentUser?.name?.toLowerCase().trim();

      const matchedEmp = employeesList.find(e => 
        (cleanCurrentId && e.employeeId?.toLowerCase().trim() === cleanCurrentId) ||
        (cleanCurrentName && e.name?.toLowerCase().trim() === cleanCurrentName)
      );

      const lunchDeduction = matchedEmp?.lunchBreakMinutes !== undefined 
        ? Number(matchedEmp.lunchBreakMinutes) 
        : 0;

      const netMinutes = grossMinutes >= lunchDeduction ? grossMinutes - lunchDeduction : 0;

      return `${Math.floor(netMinutes / 60)}h ${netMinutes % 60}m`;
    } catch (e) {
      return '--';
    }
  };

  const syncDashboardMetricsData = async () => {
    if (!currentUser?.name) return;
    try {
      await fetchEmployeesList();
      await fetchHolidaysCountForSelectedMonth();
      const response = await fetch(`${API_BASE_URL}/admin/attendance-sheet?employeeName=${currentUser.name}`);
      if (response.ok) {
        const logs = await response.json();
        
        let totalPresents = 0;
        let totalAbsents = 0;
        let totalCl = 0;

        logs.forEach((log: any) => {
          const matchesSelectedMonth = log.date && log.date.toLowerCase().includes(selectedDashboardMonth.toLowerCase());
          
          if (matchesSelectedMonth) {
            if (log.loginTime === 'ABSENT' || log.logoutTime === 'ABSENT') {
              totalAbsents += 1;
            } else if (log.loginTime === 'CASUAL LEAVE' || log.isCasualLeave) {
              totalCl += 1;
            } else if (log.loginTime !== '--:--' && log.loginTime !== 'HOLIDAY' && log.loginTime !== 'OFF') {
              totalPresents += 1;
            }
          }
        });

        setPresentCount(totalPresents);
        setAbsentCount(totalAbsents);
        setClCount(totalCl);

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
  }, [currentUser, selectedDashboardMonth]);

  const totalLogs = presentCount + absentCount + clCount;
  const ratio = totalLogs > 0 ? Math.round(((presentCount + clCount) / totalLogs) * 100) : 0;

  return (
    <ScrollView 
      style={[styles.container, { paddingTop: insets.top + 12 }]} 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 110, flexGrow: 1 }}
      refreshControl={
        <RefreshControl 
          refreshing={isRefreshing} 
          onRefresh={handlePullToRefresh} 
          colors={["#007AFF"]}
          tintColor="#007AFF"
          progressViewOffset={insets.top}
        />
      }
    >
      <View style={styles.screenTitleRow}>
        <Text style={styles.screenTitleText}>Dashboard</Text>
        <Text style={styles.screenSubtitleText}>Your attendance overview at a glance</Text>
      </View>

      <View style={styles.dashboardHeroCard}>
        <View style={styles.heroHeaderRow}>
          <View style={styles.logoBadgeFrame}>
            <Image 
              source={require('../../assets/images/medini new logo.jpeg')} 
              style={styles.mediniLogoImage} 
              resizeMode="contain"
            />
          </View>
          <View style={styles.heroTextGroup}>
            <Text style={styles.heroTimeLabel}>{getGreetingSegmentText()}</Text>
            <Text style={styles.heroNameHeading} numberOfLines={1}>{employeeName}</Text>
            <Text style={styles.heroRoleTag}>{employeeRole}</Text>
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

      {/* 📅 CALENDAR MONTH PICKER TRIGGER BUTTON */}
      <View style={styles.sectionHeaderRow}>
        <Ionicons name="calendar-sharp" size={16} color="#2B6CB0" />
        <Text style={styles.sectionHeadingLabel}>Dashboard Active Period</Text>
      </View>

      <TouchableOpacity 
        style={styles.calendarPickerCardBtn} 
        activeOpacity={0.8}
        onPress={() => setShowMonthPickerModal(true)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.calendarIconSquare}>
            <Ionicons name="calendar-outline" size={18} color="#007AFF" />
          </View>
          <View>
            <Text style={styles.calendarPickerSubtitle}>Selected Month & Year</Text>
            <Text style={styles.calendarPickerTitleText}>{selectedDashboardMonth} {currentYear}</Text>
          </View>
        </View>
        <Ionicons name="chevron-down" size={18} color="#718096" />
      </TouchableOpacity>

      {/* 📊 GRID METRICS HUB */}
      <View style={styles.sectionHeaderRow}>
        <Ionicons name="analytics" size={16} color="#2B6CB0" />
        <Text style={styles.sectionHeadingLabel}>Performance Metrics ({selectedDashboardMonth})</Text>
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

      {/* 🏖️ DEDICATED SUNDAYS CARD */}
      <View style={styles.sundayCardBox}>
        <View style={styles.sundayCardLeft}>
          <View style={styles.sundayIconCircle}>
            <Ionicons name="sunny-outline" size={20} color="#D69E2E" />
          </View>
          <View>
            <Text style={styles.sundayCardTitle}>Sundays Elapsed</Text>
            <Text style={styles.sundayCardSubtitle}>Non-working weekend days</Text>
          </View>
        </View>
        <Text style={styles.sundayCardValue}>{sundayCount}</Text>
      </View>

      {/* 🌿 DEDICATED CASUAL LEAVE (CL) CARD */}
      <View style={[styles.holidayCardBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', borderLeftColor: '#16A34A' }]}>
        <View style={styles.sundayCardLeft}>
          <View style={[styles.sundayIconCircle, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
            <Ionicons name="calendar-number-outline" size={20} color="#16A34A" />
          </View>
          <View>
            <Text style={[styles.sundayCardTitle, { color: '#166534' }]}>Casual Leave (CL) Used</Text>
            <Text style={[styles.sundayCardSubtitle, { color: '#15803D' }]}>Admin allocated CL days</Text>
          </View>
        </View>
        <Text style={[styles.sundayCardValue, { color: '#166534' }]}>{clCount}</Text>
      </View>

      {/* 🎉 COMPANY HOLIDAYS CARD */}
      <View style={[styles.holidayCardBox, { backgroundColor: '#FFFAF0', borderColor: '#FEEBC8', borderLeftColor: '#DD6B20' }]}>
        <View style={styles.sundayCardLeft}>
          <View style={[styles.sundayIconCircle, { backgroundColor: '#FFFAF0', borderColor: '#FEEBC8' }]}>
            <Ionicons name="gift-outline" size={20} color="#DD6B20" />
          </View>
          <View>
            <Text style={[styles.sundayCardTitle, { color: '#9C4221' }]}>Company Holidays</Text>
            <Text style={[styles.sundayCardSubtitle, { color: '#C05621' }]}>Declared official holidays</Text>
          </View>
        </View>
        <Text style={[styles.sundayCardValue, { color: '#9C4221' }]}>{holidayCount}</Text>
      </View>

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

      <View style={styles.noticeBoardCardFrame}>
        <View style={styles.noticeHeaderRow}>
          <Ionicons name="information-circle" size={18} color="#2B6CB0" style={{ marginRight: 6 }} />
          <Text style={styles.noticeCardTitleText}>Month Lifecycle Synced</Text>
        </View>
        <Text style={styles.noticeCardBodyText}>
          Tap the calendar period card above to switch between months and review past performance metrics. Swipe down to refresh data streams.
        </Text>
      </View>

      <TouchableOpacity 
        style={styles.masterActionButtonLauncher}
        activeOpacity={0.85}
        onPress={() => router.push('/attendance')}
      >
        <FontAwesome5 name="map-marker-alt" size={14} color="#FFFFFF" style={{ marginRight: 8 }} />
        <Text style={styles.masterActionButtonLauncherText}>Open GPS Verification Desk</Text>
      </TouchableOpacity>

      {/* 📅 CALENDAR MONTH PICKER POPUP MODAL */}
      <Modal
        visible={showMonthPickerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMonthPickerModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          activeOpacity={1} 
          onPress={() => setShowMonthPickerModal(false)}
        >
          <View style={styles.monthPickerModalCard}>
            <Text style={styles.monthPickerModalTitle}>Select Dashboard Month ({currentYear})</Text>
            
            <View style={styles.monthsGridContainer}>
              {availableMonths.map((m) => {
                const isSelected = selectedDashboardMonth === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.monthCellItem, isSelected && styles.selectedMonthCellItem]}
                    onPress={() => {
                      setSelectedDashboardMonth(m);
                      setShowMonthPickerModal(false);
                    }}
                  >
                    <Text style={[styles.monthCellText, isSelected && styles.selectedMonthCellText]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity 
              style={styles.modalCloseBtn} 
              onPress={() => setShowMonthPickerModal(false)}
            >
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 16 },
  screenTitleRow: { marginBottom: 16, paddingLeft: 2 },
  screenTitleText: { fontSize: 26, fontWeight: '800', color: '#1A202C', letterSpacing: 0.2 },
  screenSubtitleText: { fontSize: 13, fontWeight: '600', color: '#718096', marginTop: 2 },
  dashboardHeroCard: { backgroundColor: '#007AFF', padding: 20, borderRadius: 20, shadowColor: '#007AFF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 3, marginTop: 10, marginBottom: 16 },
  heroHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  logoBadgeFrame: { width: 68, height: 68, borderRadius: 16, backgroundColor: '#FFFFFF', padding: 6, justifyContent: 'center', alignItems: 'center', marginRight: 14, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  mediniLogoImage: { width: '100%', height: '100%' },
  heroTextGroup: { flex: 1 },
  heroTimeLabel: { color: '#E0F0FF', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroNameHeading: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 2 },
  heroRoleTag: { color: '#B3D7FF', fontSize: 12, fontWeight: '600', marginTop: 2 },
  heroDividerLine: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 14 },
  heroFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaBadgeItem: { flexDirection: 'row', alignItems: 'center' },
  heroIdBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', opacity: 0.9, marginLeft: 5 },
  dateBadgePill: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  dateBadgePillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  
  calendarPickerCardBtn: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: '#CBD5E0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 3, elevation: 1 },
  calendarIconSquare: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#EBF8FF', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: '#BEE3F8' },
  calendarPickerSubtitle: { fontSize: 10, fontWeight: '700', color: '#718096', textTransform: 'uppercase', letterSpacing: 0.3 },
  calendarPickerTitleText: { fontSize: 15, fontWeight: '800', color: '#1A202C', marginTop: 1 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  monthPickerModalCard: { width: '100%', maxWidth: 340, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', elevation: 10 },
  monthPickerModalTitle: { fontSize: 14, fontWeight: '800', color: '#1A202C', textTransform: 'uppercase', textAlign: 'center', marginBottom: 16, letterSpacing: 0.4 },
  monthsGridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  monthCellItem: { width: '31%', paddingVertical: 12, backgroundColor: '#F7FAFC', borderRadius: 12, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  selectedMonthCellItem: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  monthCellText: { fontSize: 12, fontWeight: '700', color: '#4A5568' },
  selectedMonthCellText: { color: '#FFFFFF', fontWeight: '900' },
  modalCloseBtn: { backgroundColor: '#EDF2F7', paddingVertical: 10, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  modalCloseBtnText: { color: '#4A5568', fontSize: 13, fontWeight: '700' },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingLeft: 2 },
  sectionHeadingLabel: { fontSize: 12, fontWeight: '800', color: '#4A5568', textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 6 },
  metricsGridRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 12 },
  metricCardBox: { backgroundColor: '#FFFFFF', width: '48.5%', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1 },
  iconContainer: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  metricCardCountValue: { fontSize: 22, fontWeight: '800', color: '#1A202C' },
  metricCardSublabel: { fontSize: 11, fontWeight: '700', color: '#718096', marginTop: 2 },
  
  sundayCardBox: { backgroundColor: '#FEFCBF', borderWidth: 1, borderColor: '#FAF089', borderLeftWidth: 4, borderLeftColor: '#D69E2E', padding: 14, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1 },
  holidayCardBox: { backgroundColor: '#FFFAF0', borderWidth: 1, borderColor: '#FEEBC8', borderLeftWidth: 4, borderLeftColor: '#DD6B20', padding: 14, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1 },
  sundayCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  sundayIconCircle: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FFFFF0', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: '#FEEBC8' },
  sundayCardTitle: { fontSize: 13, fontWeight: '800', color: '#744210' },
  sundayCardSubtitle: { fontSize: 11, fontWeight: '600', color: '#975A16', marginTop: 2 },
  sundayCardValue: { fontSize: 18, fontWeight: '800', color: '#744210' },

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