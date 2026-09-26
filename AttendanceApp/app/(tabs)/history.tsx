import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Image, Modal } from 'react-native';
import { useAuth, API_BASE_URL } from '../_layout';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BackendLog {
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
  isSundayPlaceholder?: boolean;
  isHolidayPlaceholder?: boolean;
  isCasualLeave?: boolean;
  holidayTitle?: string;
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
  const insets = useSafeAreaInsets();
  const [cloudLogs, setCloudLogs] = useState<BackendLog[]>([]);
  const [holidaysMap, setHolidaysMap] = useState<{ [key: string]: string }>({});
  const [employeeLunchMins, setEmployeeLunchMins] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long' });
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>(currentMonthName);

  const availableMonths = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthNameToIndex: { [key: string]: number } = {
    January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
    July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
  };

  const [isCalendarVisible, setIsCalendarVisible] = useState<boolean>(false);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());

  const [modalState, setModalState] = useState<PhotoModalState>({
    visible: false,
    imageUri: null,
    location: '',
    type: 'LOGIN',
    date: '',
    time: ''
  });

  const calculateWorkingHours = (inTime: string, outTime: string, lunchBreakMinutes: number = 0) => {
    if (!inTime || !outTime || inTime === '--:--' || outTime === '--:--' || inTime === 'ABSENT' || outTime === 'ABSENT' || inTime === 'CASUAL LEAVE') {
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

      const netMinutes = grossMinutes >= lunchBreakMinutes ? grossMinutes - lunchBreakMinutes : 0;

      return `${Math.floor(netMinutes / 60)}h ${netMinutes % 60}m`;
    } catch (e) {
      return '--';
    }
  };

  const fetchEmployeeLunchProfile = async () => {
    if (!currentUser) return;
    try {
      const response = await fetch(`${API_BASE_URL}/admin/employees`);
      if (response.ok) {
        const data = await response.json();
        
        const cleanCurrentName = currentUser.name?.toLowerCase().trim();
        const cleanCurrentId = currentUser.employeeId?.toLowerCase().trim();

        const currentProfile = data.find((e: any) => {
          const eName = e.name?.toLowerCase().trim();
          const eId = e.employeeId?.toLowerCase().trim();
          return (cleanCurrentId && eId === cleanCurrentId) || (cleanCurrentName && eName === cleanCurrentName);
        });

        if (currentProfile && currentProfile.lunchBreakMinutes !== undefined) {
          setEmployeeLunchMins(Number(currentProfile.lunchBreakMinutes));
        } else {
          setEmployeeLunchMins(0);
        }
      }
    } catch (e) {
      console.error('Error fetching employee lunch profile:', e);
    }
  };

  const fetchHolidaysData = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/holidays`);
      if (res.ok) {
        const data = await res.json();
        const map: { [key: string]: string } = {};
        data.forEach((h: any) => {
          if (h.date) {
            const cleanDate = h.date.replace(',', '').replace(/\s+/g, ' ').toLowerCase().trim();
            map[cleanDate] = h.title;
          }
        });
        setHolidaysMap(map);
      }
    } catch (e) {
      console.error('Error fetching holidays:', e);
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
    fetchEmployeeLunchProfile();
    fetchPermanentCloudHistory();
    fetchHolidaysData();
  }, [currentUser]);

  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    setCalendarViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarViewDate(new Date(year, month + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const selectedObj = new Date(year, month, day);
    const formatted = selectedObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    setSelectedDate(formatted);
    setIsCalendarVisible(false);
  };

  const parseDateToTimestamp = (dateStr: string): number => {
    if (!dateStr) return 0;
    const cleanStr = dateStr.replace(',', '').trim();
    const parts = cleanStr.split(/\s+/);
    
    if (parts.length >= 3) {
      const monthName = parts[0];
      const dayNum = parseInt(parts[1], 10);
      const yearNum = parseInt(parts[2], 10);
      
      const mIndex = monthNameToIndex[monthName];
      if (mIndex !== undefined && !isNaN(dayNum) && !isNaN(yearNum)) {
        return new Date(yearNum, mIndex, dayNum).getTime();
      }
    }

    const fallback = new Date(dateStr).getTime();
    return isNaN(fallback) ? 0 : fallback;
  };

  const getCombinedLogsWithSundaysAndHolidays = () => {
    const currentYear = new Date().getFullYear();
    const targetMonthIndex = monthNameToIndex[selectedMonthFilter] ?? new Date().getMonth();
    
    const totalDays = new Date(currentYear, targetMonthIndex + 1, 0).getDate();
    const today = new Date();

    const allDaysMap = new Map<string, BackendLog>();

    for (let day = 1; day <= totalDays; day++) {
      const dateObj = new Date(currentYear, targetMonthIndex, day);
      if (dateObj > today) break; 

      const formattedDateStr = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const formattedDayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
      const isSunday = dateObj.getDay() === 0;

      const cleanFormattedDateStr = formattedDateStr.replace(',', '').replace(/\s+/g, ' ').toLowerCase().trim();
      const holidayTitle = holidaysMap[cleanFormattedDateStr];

      if (holidayTitle) {
        allDaysMap.set(formattedDateStr, {
          _id: `holiday-${formattedDateStr}`,
          employeeIdReference: currentUser?.employeeId || 'N/A',
          employeeName: currentUser?.name || 'Employee',
          date: formattedDateStr,
          dayOfWeek: formattedDayName,
          loginTime: 'HOLIDAY',
          logoutTime: 'HOLIDAY',
          isHolidayPlaceholder: true,
          holidayTitle: holidayTitle
        });
      } else if (isSunday) {
        allDaysMap.set(formattedDateStr, {
          _id: `sunday-${formattedDateStr}`,
          employeeIdReference: currentUser?.employeeId || 'N/A',
          employeeName: currentUser?.name || 'Employee',
          date: formattedDateStr,
          dayOfWeek: formattedDayName,
          loginTime: 'OFF',
          logoutTime: 'OFF',
          isSundayPlaceholder: true
        });
      }
    }

    cloudLogs.forEach(log => {
      if (log.date) {
        const timestamp = parseDateToTimestamp(log.date);
        if (timestamp > 0) {
          const standardizedDateStr = new Date(timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          allDaysMap.set(standardizedDateStr, log);
        } else {
          allDaysMap.set(log.date, log);
        }
      }
    });

    const combined = Array.from(allDaysMap.values());
    combined.sort((a, b) => {
      const timeA = parseDateToTimestamp(a.date);
      const timeB = parseDateToTimestamp(b.date);
      return timeB - timeA; 
    });

    return combined;
  };

  const allLogsWithExtras = getCombinedLogsWithSundaysAndHolidays();

  // Helper map for calendar cell color coding lookup
  const getDayStatusStyle = (cellDateObj: Date) => {
    const formattedDateStr = cellDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const cleanDateStr = formattedDateStr.replace(',', '').replace(/\s+/g, ' ').toLowerCase().trim();
    
    // Check if future date
    if (cellDateObj > new Date()) {
      return { bg: '#F1F5F9', text: '#94A3B8' }; // Future/Disabled
    }

    // Check holiday
    if (holidaysMap[cleanDateStr]) {
      return { bg: '#FEF3C7', text: '#D97706', border: '#F59E0B' }; // Holiday (Yellow/Orange)
    }

    // Check Sunday
    if (cellDateObj.getDay() === 0) {
      return { bg: '#FEF08A', text: '#CA8A04', border: '#EAB308' }; // Sunday (Light Gold)
    }

    // Find log for this day
    const matchedLog = allLogsWithExtras.find(l => {
      const t = parseDateToTimestamp(l.date);
      if (t > 0) {
        return new Date(t).toDateString() === cellDateObj.toDateString();
      }
      return l.date === formattedDateStr;
    });

    if (matchedLog) {
      if (matchedLog.loginTime === 'ABSENT' || matchedLog.logoutTime === 'ABSENT') {
        return { bg: '#FEE2E2', text: '#DC2626', border: '#EF4444' }; // Absent (Red)
      }
      if (matchedLog.loginTime === 'CASUAL LEAVE' || matchedLog.isCasualLeave) {
        return { bg: '#DCFCE7', text: '#16A34A', border: '#22C55E' }; // Casual Leave (Green)
      }
      if (matchedLog.loginTime && matchedLog.loginTime !== '--:--' && matchedLog.loginTime !== 'OFF') {
        return { bg: '#DBEAFE', text: '#2563EB', border: '#3B82F6' }; // Present (Blue)
      }
    }

    return { bg: '#F8FAFC', text: '#64748B' }; // Default / Unrecorded
  };

  const filteredLogs = allLogsWithExtras.filter((item) => {
    if (!item.date) return false;
    const currentYearString = new Date().getFullYear().toString();
    const logDateLower = item.date.toLowerCase();

    if (selectedDate) {
      return logDateLower.includes(selectedDate.trim().toLowerCase());
    }

    const matchesMonth = logDateLower.includes(selectedMonthFilter.toLowerCase());
    const matchesYear = logDateLower.includes(currentYearString);
    return matchesMonth && matchesYear;
  });

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
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.headerTitleRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="time-outline" size={18} color="#1A202C" />
          <Text style={styles.sectionTitle}>Attendance Logs Timeline</Text>
        </View>
        <TouchableOpacity style={styles.refreshIconBtn} onPress={() => { fetchEmployeeLunchProfile(); fetchPermanentCloudHistory(); fetchHolidaysData(); }}>
          <Ionicons name="refresh-outline" size={13} color="#2B6CB0" style={{ marginRight: 4 }} />
          <Text style={styles.refreshIconText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeaderRowInline}>
        <Ionicons name="calendar-outline" size={14} color="#2B6CB0" />
        <Text style={styles.sectionHeadingLabelInline}>Select Tracking Month ({new Date().getFullYear()})</Text>
      </View>
      <View style={styles.pillScrollFrame}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {availableMonths.map((mName) => (
            <TouchableOpacity 
              key={mName} 
              style={[styles.monthFilterPill, selectedMonthFilter === mName && styles.activeMonthFilterPill]} 
              onPress={() => { setSelectedMonthFilter(mName); setSelectedDate(null); }}
            >
              <Text style={[styles.monthFilterPillText, selectedMonthFilter === mName && styles.activeMonthFilterPillText]}>📅 {mName}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.calendarFilterBarContainer}>
        <TouchableOpacity 
          style={styles.calendarPickerBtn}
          activeOpacity={0.8}
          onPress={() => setIsCalendarVisible(true)}
        >
          <Ionicons name="calendar-sharp" size={18} color="#007AFF" style={{ marginRight: 8 }} />
          <Text style={[styles.calendarPickerBtnText, selectedDate && styles.calendarPickerSelectedText]}>
            {selectedDate ? `Exact Date Filter: ${selectedDate}` : 'Or Pick Exact Date from Color-Coded Calendar'}
          </Text>
        </TouchableOpacity>

        {selectedDate && (
          <TouchableOpacity 
            style={styles.clearDateFilterBtn} 
            onPress={() => setSelectedDate(null)}
          >
            <Ionicons name="close-circle" size={20} color="#E53E3E" />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={[styles.emptyText, { marginTop: 10 }]}>Syncing with cloud database...</Text>
        </View>
      ) : filteredLogs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="calendar-outline" size={24} color="#718096" />
          </View>
          <Text style={styles.emptyText}>
            {selectedDate ? `No attendance logs recorded for ${selectedDate}.` : `No active history logs available for ${selectedMonthFilter}.`}
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
          {filteredLogs.map((item) => {
            const isExpanded = expandedLogId === item._id;
            const hasInPhoto = !!item.capturedPhotoInUri;
            const hasOutPhoto = !!item.capturedPhotoOutUri;
            const isAbsent = item.loginTime === 'ABSENT' || item.logoutTime === 'ABSENT';
            const isSunday = item.isSundayPlaceholder || item.dayOfWeek?.toLowerCase() === 'sunday' || new Date(item.date).getDay() === 0;
            const isHoliday = item.isHolidayPlaceholder;
            const isCL = item.isCasualLeave || item.loginTime === 'CASUAL LEAVE';

            return (
              <View key={item._id} style={styles.dayGroupCardWrapper}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  style={[
                    styles.dayGroupCard, 
                    isExpanded && styles.dayGroupCardExpanded,
                    isAbsent && styles.dayGroupCardAbsent,
                    isSunday && { backgroundColor: '#F7FAFC', borderColor: '#CBD5E0' },
                    isHoliday && { backgroundColor: '#FFFAF0', borderColor: '#FBD38D' },
                    isCL && { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }
                  ]}
                  onPress={() => !isSunday && !isHoliday && !isCL && handleToggleDrawer(item._id)}
                >
                  <View style={styles.dayHeader}>
                    <View>
                      <Text style={[styles.dayText, isAbsent && { color: '#E53E3E' }, isSunday && { color: '#4A5568' }, isHoliday && { color: '#DD6B20' }, isCL && { color: '#16A34A' }]}>
                        {isHoliday ? item.holidayTitle : isCL ? 'Casual Leave (CL)' : (item.dayOfWeek || 'Sunday')}
                      </Text>
                      <Text style={styles.dateText}>{item.date}</Text>
                    </View>
                    {isHoliday ? (
                      <View style={[styles.photoLoggedBadge, { backgroundColor: '#FFFAF0', borderColor: '#FBD38D' }]}>
                        <Text style={[styles.photoLoggedBadgeText, { color: '#DD6B20' }]}>🎉 Company Holiday</Text>
                      </View>
                    ) : isCL ? (
                      <View style={[styles.photoLoggedBadge, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                        <Text style={[styles.photoLoggedBadgeText, { color: '#16A34A' }]}>🌿 Casual Leave</Text>
                      </View>
                    ) : isSunday ? (
                      <View style={[styles.photoLoggedBadge, { backgroundColor: '#EDF2F7', borderColor: '#CBD5E0' }]}>
                        <Text style={[styles.photoLoggedBadgeText, { color: '#4A5568' }]}>🏖️ Weekend Off</Text>
                      </View>
                    ) : (hasInPhoto || hasOutPhoto) && !isAbsent && (
                      <View style={styles.photoLoggedBadge}>
                        <Ionicons name="camera" size={11} color="#007AFF" style={{ marginRight: 3 }} />
                        <Text style={styles.photoLoggedBadgeText}>Photos Logged</Text>
                      </View>
                    )}
                  </View>

                  {isHoliday ? (
                    <View style={[styles.punchItem, { backgroundColor: '#FFFAF0', borderColor: '#FBD38D', width: '100%', alignItems: 'center', paddingVertical: 10 }]}>
                      <Text style={[styles.punchLabel, { color: '#DD6B20' }]}>STATUS</Text>
                      <Text style={[styles.punchTime, { color: '#7B341E' }]}>{item.holidayTitle} - Holiday / Leave</Text>
                    </View>
                  ) : isCL ? (
                    <View style={[styles.punchItem, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', width: '100%', alignItems: 'center', paddingVertical: 10 }]}>
                      <Text style={[styles.punchLabel, { color: '#16A34A' }]}>STATUS</Text>
                      <Text style={[styles.punchTime, { color: '#15803D' }]}>Casual Leave (CL) - Approved</Text>
                    </View>
                  ) : isSunday ? (
                    <View style={[styles.punchItem, { backgroundColor: '#EDF2F7', borderColor: '#CBD5E0', width: '100%', alignItems: 'center', paddingVertical: 10 }]}>
                      <Text style={[styles.punchLabel, { color: '#4A5568' }]}>STATUS</Text>
                      <Text style={[styles.punchTime, { color: '#2D3748' }]}>Sunday - Non-Working Day</Text>
                    </View>
                  ) : (
                    <View style={styles.punchRow}>
                      <View style={[styles.punchItem, { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' }, isAbsent && { backgroundColor: '#FFF5F5', borderColor: '#FED7D7' }]}>
                        <Text style={[styles.punchLabel, { color: '#16A34A' }, isAbsent && { color: '#E53E3E' }]}>DURATION</Text>
                        <Text style={[styles.punchTime, { color: '#15803D' }, isAbsent && { color: '#E53E3E' }]}>
                          {calculateWorkingHours(item.loginTime, item.logoutTime, employeeLunchMins)}
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
                  )}

                  {(hasInPhoto || hasOutPhoto) && !isExpanded && !isAbsent && !isSunday && !isHoliday && !isCL && (
                    <Text style={styles.expandTipText}>Tap card to inspect compliance captures ▼</Text>
                  )}
                </TouchableOpacity>

                {isExpanded && !isAbsent && !isSunday && !isHoliday && !isCL && (
                  <View style={styles.photoDrawerContainer}>
                    <Text style={styles.drawerLabelTitle}>Biometric Verification Snapshots:</Text>
                    <View style={styles.photoGridRow}>
                      
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

      {/* 🌟 COLOR-CODED CALENDAR POPUP MODAL */}
      <Modal
        visible={isCalendarVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsCalendarVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.calendarModalCard}>
            
            <View style={styles.calendarHeaderRow}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.calNavBtn}>
                <Ionicons name="chevron-back" size={20} color="#2D3748" />
              </TouchableOpacity>
              
              <Text style={styles.calMonthTitle}>
                {monthNames[month]} {year}
              </Text>
              
              <TouchableOpacity onPress={handleNextMonth} style={styles.calNavBtn}>
                <Ionicons name="chevron-forward" size={20} color="#2D3748" />
              </TouchableOpacity>
            </View>

            {/* Legend guide */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} /><Text style={styles.legendText}>Present</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} /><Text style={styles.legendText}>Absent</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} /><Text style={styles.legendText}>CL</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#EAB308' }]} /><Text style={styles.legendText}>Sun</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} /><Text style={styles.legendText}>Holiday</Text></View>
            </View>

            <View style={styles.weekDaysRow}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, index) => (
                <Text key={index} style={styles.weekDayText}>{d}</Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {Array.from({ length: firstDayIndex }).map((_, idx) => (
                <View key={`empty-${idx}`} style={styles.dayCell} />
              ))}

              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const cellObj = new Date(year, month, dayNum);
                const cellFormatted = cellObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                const isSelected = selectedDate === cellFormatted;
                const statusStyle = getDayStatusStyle(cellObj);

                return (
                  <TouchableOpacity
                    key={dayNum}
                    style={[
                      styles.dayCell, 
                      { backgroundColor: statusStyle.bg },
                      isSelected && { borderWidth: 2, borderColor: '#000000' }
                    ]}
                    onPress={() => handleSelectDay(dayNum)}
                  >
                    <Text style={[styles.dayCellText, { color: statusStyle.text }]}>
                      {dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.calModalFooterRow}>
              {selectedDate && (
                <TouchableOpacity 
                  style={styles.calResetBtn} 
                  onPress={() => { setSelectedDate(null); setIsCalendarVisible(false); }}
                >
                  <Text style={styles.calResetBtnText}>Clear Date Filter</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={styles.calCloseBtn} 
                onPress={() => setIsCalendarVisible(false)}
              >
                <Text style={styles.calCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

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
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 16 },
  headerTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#1A202C', marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  refreshIconBtn: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.01, shadowRadius: 2, elevation: 1 },
  refreshIconText: { color: '#4A5568', fontSize: 11, fontWeight: '700' },
  
  sectionHeaderRowInline: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingLeft: 2 },
  sectionHeadingLabelInline: { fontSize: 11, fontWeight: '800', color: '#4A5568', textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 6 },
  pillScrollFrame: { maxHeight: 40, marginBottom: 10 },
  monthFilterPill: { backgroundColor: '#EDF2F7', paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderRadius: 14, marginRight: 6, height: 34, borderWidth: 1, borderColor: '#E2E8F0' },
  activeMonthFilterPill: { backgroundColor: '#805AD5', borderColor: '#805AD5' },
  monthFilterPillText: { fontSize: 11, color: '#4A5568', fontWeight: '700' },
  activeMonthFilterPillText: { color: '#FFFFFF' },

  calendarFilterBarContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  calendarPickerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 14, height: 42, borderWidth: 1, borderColor: '#CBD5E0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 3, elevation: 1 },
  calendarPickerBtnText: { fontSize: 12, color: '#718096', fontWeight: '600' },
  calendarPickerSelectedText: { color: '#007AFF', fontWeight: '800' },
  clearDateFilterBtn: { marginLeft: 8, padding: 4 },
  
  calendarModalCard: { width: '100%', maxWidth: 350, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 15, elevation: 10 },
  calendarHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calNavBtn: { padding: 6, backgroundColor: '#EDF2F7', borderRadius: 10 },
  calMonthTitle: { fontSize: 15, fontWeight: '800', color: '#1A202C' },
  
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legendText: { fontSize: 9, fontWeight: '700', color: '#64748B' },

  weekDaysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  weekDayText: { width: '14.28%', textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#A0AEC0' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  dayCell: { width: '14.28%', height: 38, justifyContent: 'center', alignItems: 'center', marginVertical: 2, borderRadius: 8 },
  dayCellText: { fontSize: 12, fontWeight: '800' },
  
  calModalFooterRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, borderTopWidth: 1, borderTopColor: '#EDF2F7', paddingTop: 12 },
  calResetBtn: { backgroundColor: '#FFF5F5', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginRight: 8, borderWidth: 1, borderColor: '#FED7D7' },
  calResetBtnText: { color: '#E53E3E', fontSize: 12, fontWeight: '700' },
  calCloseBtn: { backgroundColor: '#EDF2F7', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  calCloseBtnText: { color: '#4A5568', fontSize: 12, fontWeight: '700' },

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
  geotagStampOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(18, 18, 18, 0.88)', padding: 12 },
  geotagStampHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  geotagStampTitle: { color: '#FFD700', fontSize: 10, fontWeight: '900', marginLeft: 5, letterSpacing: 0.8 },
  geotagStampAddress: { color: '#FFFFFF', fontSize: 10, fontWeight: '600', lineHeight: 14, marginBottom: 8 },
  geotagStampMetaRow: { borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.2)', paddingTop: 6 },
  geotagStampMetaText: { color: '#E2E8F0', fontSize: 9, fontWeight: '700', letterSpacing: 0.2 }
});