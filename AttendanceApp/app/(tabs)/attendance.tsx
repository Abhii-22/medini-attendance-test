import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, Image, Dimensions, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { OFFICE_LOCATION } from '@/constants/Location';
import { useAttendance } from '@/constants/AttendanceContext';
import { useAuth, API_BASE_URL } from '../_layout'; 

const { width } = Dimensions.get('window');

interface BackendLog {
  _id: string;
  date: string;
  loginTime: string;
  logoutTime: string;
}

export default function AttendanceScreen() {
  const { currentUser } = useAuth(); 
  const { addPunch } = useAttendance();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [isLocationVerified, setIsLocationVerified] = useState<boolean>(false);
  const [attendanceType, setAttendanceType] = useState<'LOGIN' | 'LOGOUT' | 'ABSENT' | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState<boolean>(false);
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  
  // Permanent Cloud History State
  const [permanentHistory, setPermanentHistory] = useState<BackendLog[]>([]);
  
  const cameraRef = useRef<any>(null);

  // Safely extract active identity fallback names
  const employeeName = currentUser?.name || 'Employee';
  const employeeId = currentUser?.employeeId || 'N/A';
  const employeeDept = currentUser?.designation || 'Staff Member';

  // Fetch permanent history from MongoDB Atlas on screen load
  const fetchPermanentCloudHistory = async () => {
    if (!currentUser?.name) return;
    try {
      const response = await fetch(`${API_BASE_URL}/admin/attendance-sheet?employeeName=${currentUser.name}`);
      if (response.ok) {
        const data = await response.json();
        setPermanentHistory(data);
      }
    } catch (error) {
      console.error('Error syncing permanent history:', error);
    }
  };

  // Trigger sync loop whenever the logged in user changes
  useEffect(() => {
    fetchPermanentCloudHistory();
  }, [currentUser]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const handleVerifyLocation = async (type: 'LOGIN' | 'LOGOUT') => {
    setLoading(true);
    setAttendanceType(type);
    setCurrentDistance(null);
    setLoadingMessage('Initializing System Hardware...');

    try {
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus !== 'granted') {
        Alert.alert('Permission Denied', 'GPS tracking access authorization is required.');
        setLoading(false);
        return;
      }

      if (!cameraPermission?.granted) {
        const camStatus = await requestCameraPermission();
        if (!camStatus.granted) {
          Alert.alert('Permission Denied', 'Camera authorization access required.');
          setLoading(false);
          return;
        }
      }

      let bestCoords: any = null;
      let lowestAccuracy = 99999;

      for (let i = 0; i < 3; i++) {
        setLoadingMessage(`Calibrating Signal Precision (${i + 1}/3)...`);
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
        
        if (position.coords.accuracy && position.coords.accuracy < lowestAccuracy) {
          lowestAccuracy = position.coords.accuracy;
          bestCoords = position.coords;
        }
      }

      if (!bestCoords) throw new Error("GPS Timeout");

      const distance = calculateDistance(
        bestCoords.latitude,
        bestCoords.longitude,
        OFFICE_LOCATION.latitude,
        OFFICE_LOCATION.longitude
      );

      setCurrentDistance(distance);

      if (distance <= OFFICE_LOCATION.radiusInMeters) {
        setIsLocationVerified(true);
        setShowCamera(true);
      } else {
        Alert.alert(
          'Out of Range 📍',
          `Calculated: ${distance.toFixed(0)}m away from Bhoja Complex.\n\n` +
          `Boundary limit: ${OFFICE_LOCATION.radiusInMeters}m\n\n` +
          `Please step closer to the building perimeter or reconnect to the corporate Wi-Fi.`
        );
        resetState();
      }
    } catch (error) {
      Alert.alert('System Error', 'Unable to secure accurate spatial tracking locks.');
    } finally {
      setLoading(false);
    }
  };

  // Direct Submission Bypass for Absent declaration logs
  const handleMarkAbsent = () => {
    Alert.alert(
      'Confirm Absence 📋',
      'Are you sure you want to mark yourself as absent for today? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm Absent', 
          style: 'destructive',
          onPress: () => executeCloudAttendanceSubmission('ABSENT')
        }
      ]
    );
  };

  const takeSelfie = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        setCapturedPhoto(photo.uri);
        setShowCamera(false);
      } catch (err) {
        Alert.alert('Camera Error', 'Failed to hold image metrics.');
      }
    }
  };

  const handleSubmitAttendance = () => {
    if (attendanceType === 'LOGIN' || attendanceType === 'LOGOUT') {
      executeCloudAttendanceSubmission(attendanceType);
    }
  };

  // Core network delivery routing pipeline
  const executeCloudAttendanceSubmission = async (type: 'LOGIN' | 'LOGOUT' | 'ABSENT') => {
    setLoading(true);
    setLoadingMessage('Uploading shift metrics to database cluster...');

    try {
      const response = await fetch(`${API_BASE_URL}/attendance/punch-clock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employeeId,
          name: employeeName,
          type: type
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        if (type !== 'ABSENT') addPunch(type);
        Alert.alert('Success 🎉', `Log successfully synchronized permanently in backend for ${employeeName}`);
        resetState();
        fetchPermanentCloudHistory();
      } else {
        Alert.alert('Upload Failed', result.message || 'Server rejected storage process.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Punch upload error:', error);
      Alert.alert('Network Interruption 📡', 'Failed to reach cloud servers.');
      setLoading(false);
    }
  };

  const resetState = () => {
    setIsLocationVerified(false);
    setAttendanceType(null);
    setCapturedPhoto(null);
    setShowCamera(false);
    setLoading(false);
  };

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView style={StyleSheet.absoluteFillObject} facing="front" ref={cameraRef} />

        <View style={[StyleSheet.absoluteFillObject, styles.cameraOverlay]}>
          <View style={styles.topInfoBar}>
            <Text style={styles.topBarText}>Verification Profile: {attendanceType}</Text>
          </View>

          <View style={styles.reticleContainer}>
            <View style={styles.faceTargetRing} />
            <Text style={styles.cameraInstruction}>Position your face inside the green ring</Text>
          </View>

          <View style={styles.shutterControlBar}>
            <TouchableOpacity style={styles.closeCameraBtn} onPress={resetState}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.captureBtn} onPress={takeSelfie}>
              <View style={styles.captureBtnInner} />
            </TouchableOpacity>
            
            <View style={{ width: 60 }} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {/* PROFILE HEADER PANEL */}
      <View style={styles.premiumHeaderCard}>
        <View style={styles.avatarBadge}>
          <Text style={styles.avatarText}>{employeeName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.headerMeta}>
          <Text style={styles.employeeName}>{employeeName}</Text>
          <Text style={styles.employeeId}>ID: {employeeId}  •  {employeeDept}</Text>
        </View>
      </View>

      {/* LOADER ELEMENT */}
      {loading && (
        <View style={styles.modernLoaderContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.modernLoaderText}>{loadingMessage}</Text>
        </View>
      )}

      {/* ACTION DASHBOARD HUB */}
      {!isLocationVerified && !loading && !capturedPhoto && (
        <View style={styles.actionPanel}>
          <Text style={styles.panelSectionHeading}>Workplace Verification Desk</Text>
          <Text style={styles.panelSectionSubheading}>Execute verification checks to submit shift intervals:</Text>
          
          <View style={styles.gridRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.dashboardCardBtn, styles.cardBtnIn]}
              onPress={() => handleVerifyLocation('LOGIN')}
            >
              <View style={styles.cardIconCircle}>
                <Text style={{ fontSize: 22 }}>📥</Text>
              </View>
              <View>
                <Text style={styles.cardBtnMainText}>PUNCH IN</Text>
                <Text style={styles.cardBtnSubtext}>Start Shift</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.dashboardCardBtn, styles.cardBtnOut]}
              onPress={() => handleVerifyLocation('LOGOUT')}
            >
              <View style={styles.cardIconCircle}>
                <Text style={{ fontSize: 22 }}>📤</Text>
              </View>
              <View>
                <Text style={styles.cardBtnMainText}>PUNCH OUT</Text>
                <Text style={styles.cardBtnSubtext}>End Shift</Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.absentButtonLarge}
            activeOpacity={0.8}
            onPress={handleMarkAbsent}
          >
            <Text style={styles.absentButtonText}>❌ Mark As Absent Today</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* SNAPSHOT CONFIRMATION VIEW */}
      {capturedPhoto && !loading && (
        <View style={styles.reviewLayoutContainer}>
          <View style={styles.successStatusRibbon}>
            <Text style={styles.successRibbonText}>🛡️ SECURITY METRICS COMPLIANT</Text>
          </View>
          
          <Text style={styles.reviewMainHeading}>Confirm Sign-off Record</Text>
          <Text style={styles.reviewSubheading}>Location verified within allowable office bounds.</Text>

          <View style={styles.imagePreviewFrameShadow}>
            <Image source={{ uri: capturedPhoto }} style={styles.premiumPreviewImage} />
            <View style={styles.floatingModeTag}>
              <Text style={styles.floatingTagText}>{attendanceType} VERIFIED</Text>
            </View>
          </View>

          {currentDistance !== null && (
            <View style={styles.metricLabelRow}>
              <Text style={styles.metricLabelLabel}>Perimeter Tolerance Drift:</Text>
              <Text style={styles.metricLabelValue}>{currentDistance.toFixed(1)} meters</Text>
            </View>
          )}

          <View style={styles.formActionButtonGroup}>
            <TouchableOpacity style={styles.premiumRetakeBtn} onPress={() => setShowCamera(true)}>
              <Text style={styles.premiumRetakeBtnText}>Retake Photo 🔄</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.premiumSubmitBtn} onPress={handleSubmitAttendance}>
              <Text style={styles.premiumSubmitBtnText}>Submit Logs 🚀</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* PERMANENT CLOUD HISTORY VIEW */}
      {!loading && !showCamera && (
        <View style={styles.historySection}>
          <Text style={styles.historyHeading}>Permanent Cloud Shift Records</Text>
          {permanentHistory.length === 0 ? (
            <View style={styles.emptyHistoryCard}>
              <Text style={styles.emptyHistoryText}>No permanent cloud logs generated for this profile yet.</Text>
            </View>
          ) : (
            permanentHistory.map((log) => (
              <View key={log._id} style={styles.historyCard}>
                <View style={styles.historyCardLeft}>
                  <View style={styles.historyCalendarIconCircle}>
                    <Text style={{ fontSize: 16 }}>📅</Text>
                  </View>
                  <Text style={styles.historyDate}>{log.date}</Text>
                </View>
                
                <View style={styles.historyTimeRow}>
                  <View style={styles.timePillBadge}>
                    <Text style={styles.timePillLabel}>IN</Text>
                    <Text style={[styles.timePillValue, log.loginTime === 'ABSENT' ? { color: '#E53E3E' } : { color: '#38A169' }]}>
                      {log.loginTime}
                    </Text>
                  </View>
                  
                  <View style={[styles.timePillBadge, { marginLeft: 8 }]}>
                    <Text style={styles.timePillLabel}>OUT</Text>
                    <Text style={[styles.timePillValue, log.logoutTime === 'ABSENT' ? { color: '#E53E3E' } : { color: '#718096' }]}>
                      {log.logoutTime}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA', paddingHorizontal: 20, paddingTop: 20 },
  
  // Profile Top Card Styles
  premiumHeaderCard: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 20, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10, elevation: 2, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  avatarBadge: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EBF4FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#BEE3F8' },
  avatarText: { color: '#007AFF', fontSize: 18, fontWeight: '800' },
  headerMeta: { marginLeft: 14, flex: 1 },
  employeeName: { fontSize: 17, fontWeight: '800', color: '#1A202C' },
  employeeId: { fontSize: 12, fontWeight: '600', color: '#718096', marginTop: 2 },
  
  // Operational Grid Workspace Styles
  actionPanel: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10, elevation: 2, marginBottom: 20 },
  panelSectionHeading: { fontSize: 15, fontWeight: '800', color: '#1A202C', letterSpacing: 0.3, marginBottom: 4 },
  panelSectionSubheading: { fontSize: 12, color: '#718096', fontWeight: '500', marginBottom: 20 },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  dashboardCardBtn: { width: '48%', height: 130, borderRadius: 16, padding: 16, justifyContent: 'space-between', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 5, elevation: 1 },
  cardBtnIn: { backgroundColor: '#F6FDF9', borderColor: '#C6F6D5' },
  cardBtnOut: { backgroundColor: '#FFF5F5', borderColor: '#FED7D7' },
  cardIconCircle: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  cardBtnMainText: { fontSize: 14, fontWeight: '800', color: '#2D3748' },
  cardBtnSubtext: { fontSize: 11, color: '#718096', fontWeight: '600', marginTop: 1 },
  absentButtonLarge: { backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#E2E8F0', paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  absentButtonText: { color: '#E53E3E', fontSize: 14, fontWeight: '700' },
  
  // Camera Stack Layout Styles
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraOverlay: { justifyContent: 'space-between', paddingVertical: 40 },
  topInfoBar: { width: '100%', alignItems: 'center' },
  topBarText: { color: '#FFF', fontSize: 13, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, overflow: 'hidden' },
  reticleContainer: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  faceTargetRing: { width: width * 0.65, height: width * 0.85, borderRadius: (width * 0.65) / 2, borderWidth: 2, borderColor: '#38A169', borderStyle: 'dashed', backgroundColor: 'rgba(255,255,255,0.02)', marginBottom: 20 },
  cameraInstruction: { color: '#FFF', fontSize: 14, fontWeight: '600', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  shutterControlBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 40, width: '100%' },
  closeCameraBtn: { padding: 10 },
  closeBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  captureBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF' },
  
  // Verification Review Panel Styles
  reviewLayoutContainer: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.04, shadowRadius: 15, elevation: 2, marginVertical: 10 },
  successStatusRibbon: { backgroundColor: '#E6FFFA', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, marginBottom: 15 },
  successRibbonText: { color: '#234E52', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  reviewMainHeading: { fontSize: 18, fontWeight: '800', color: '#1A202C' },
  reviewSubheading: { fontSize: 13, color: '#718096', marginTop: 4, textAlign: 'center', marginBottom: 20 },
  imagePreviewFrameShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4, marginBottom: 20, position: 'relative' },
  premiumPreviewImage: { width: 160, height: 160, borderRadius: 80, borderWidth: 4, borderColor: '#FFFFFF' },
  floatingModeTag: { position: 'absolute', bottom: -5, backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, alignSelf: 'center' },
  floatingTagText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  metricLabelRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 10, backgroundColor: '#F7FAFC', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, width: '100%', borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabelLabel: { color: '#718096', fontSize: 13, fontWeight: '500' },
  metricLabelValue: { color: '#2D3748', fontSize: 13, fontWeight: '700', marginLeft: 6 },
  formActionButtonGroup: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10 },
  premiumSubmitBtn: { backgroundColor: '#007AFF', width: '56%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  premiumSubmitBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  premiumRetakeBtn: { borderColor: '#CBD5E0', borderWidth: 1, width: '40%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  premiumRetakeBtnText: { color: '#4A5568', fontSize: 15, fontWeight: '600' },
  
  // Loading and Progress Elements Styles
  modernLoaderContainer: { paddingVertical: 30, justifyContent: 'center', alignItems: 'center' },
  modernLoaderText: { color: '#4A5568', fontSize: 13, marginTop: 10, fontWeight: '600' },
  
  // History Record List Styles
  historySection: { marginTop: 25 },
  historyHeading: { fontSize: 13, fontWeight: '800', color: '#2B6CB0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, paddingLeft: 2 },
  emptyHistoryCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  emptyHistoryText: { color: '#A0AEC0', fontSize: 13, fontStyle: 'italic', fontWeight: '500' },
  historyCard: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyCardLeft: { flexDirection: 'row', alignItems: 'center' },
  historyCalendarIconCircle: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  historyDate: { fontSize: 14, fontWeight: '700', color: '#2D3748' },
  historyTimeRow: { flexDirection: 'row', alignItems: 'center' },
  timePillBadge: { backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignItems: 'center', minWidth: 70 },
  timePillLabel: { fontSize: 9, fontWeight: '800', color: '#A0AEC0', marginBottom: 1 },
  timePillValue: { fontSize: 12, fontWeight: '800' }
});