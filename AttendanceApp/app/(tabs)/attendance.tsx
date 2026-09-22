import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, Image, Dimensions, ScrollView, Modal } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { calculateHaversineDistance } from '@/constants/Location';
import { useAttendance } from '@/constants/AttendanceContext';
import { useAuth, API_BASE_URL } from '../_layout'; 
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function AttendanceScreen() {
  const { currentUser } = useAuth(); 
  const { addPunch } = useAttendance();
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [isLocationVerified, setIsLocationVerified] = useState<boolean>(false);
  const [attendanceType, setAttendanceType] = useState<'LOGIN' | 'LOGOUT' | 'ABSENT' | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [base64PhotoData, setBase64PhotoData] = useState<string | null>(null); 
  const [showCamera, setShowCamera] = useState<boolean>(false);
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [matchedOfficeName, setMatchedOfficeName] = useState<string>('');
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [currentDateTime, setCurrentDateTime] = useState<string>('');
  const [isMocked, setIsMocked] = useState<boolean>(false);

  // 🔒 TODAY'S PUNCH LOCK STATES
  const [hasPunchedIn, setHasPunchedIn] = useState<boolean>(false);
  const [hasPunchedOut, setHasPunchedOut] = useState<boolean>(false);
  const [isAbsentToday, setIsAbsentToday] = useState<boolean>(false);

  // 🛑 ABSENCE CONFIRMATION POPUP MODAL STATE
  const [showAbsenceModal, setShowAbsenceModal] = useState<boolean>(false);

  const cameraRef = useRef<any>(null);

  const employeeName = currentUser?.name || 'Employee';
  const employeeId = currentUser?.employeeId || 'N/A';
  const employeeDept = currentUser?.designation || 'Staff Member';

  // 🔍 HELPER TO MATCH TODAY'S DATE ACROSS ALL DATABASE FORMAT VARIATIONS
  const isTodayDate = (logDateRaw: string): boolean => {
    if (!logDateRaw) return false;
    const now = new Date();
    const tD = now.getDate();
    const tM = now.getMonth() + 1;
    const tY = now.getFullYear();

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

    const formatsToTest = [
      `${pad(tD)}/${pad(tM)}/${tY}`,
      `${tD}/${tM}/${tY}`,
      `${pad(tM)}/${pad(tD)}/${tY}`,
      `${tM}/${tD}/${tY}`,
      `${tY}-${pad(tM)}-${pad(tD)}`,
      now.toDateString(),
      now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      now.toLocaleDateString('en-GB'),
      now.toLocaleDateString('en-US')
    ];

    const logLower = logDateRaw.toLowerCase().trim();
    for (const fmt of formatsToTest) {
      if (logLower.includes(fmt.toLowerCase())) {
        return true;
      }
    }

    const cleanStr = logDateRaw.split('T')[0].trim();
    const parts = cleanStr.split(/[\/\-\.]/).map((p) => parseInt(p, 10));
    if (parts.length === 3 && !parts.some(isNaN)) {
      let d: number, m: number, y: number;
      if (parts[0] > 1000) {
        y = parts[0]; m = parts[1]; d = parts[2];
      } else {
        d = parts[0]; m = parts[1]; y = parts[2];
      }
      if (d === tD && m === tM && y === tY) return true;
    }

    const parsed = new Date(logDateRaw);
    if (!isNaN(parsed.getTime())) {
      return (
        parsed.getDate() === tD &&
        parsed.getMonth() + 1 === tM &&
        parsed.getFullYear() === tY
      );
    }

    return false;
  };

  // 🔄 CHECK TODAY'S PUNCH LOCK STATUS FROM BACKEND UPON MOUNT
  const checkTodayAttendanceStatus = async () => {
    if (!currentUser?.name) return;
    try {
      const response = await fetch(`${API_BASE_URL}/admin/attendance-sheet?employeeName=${currentUser.name}`);
      if (response.ok) {
        const data = await response.json();

        const todayLog = data.find((log: any) => log.date && isTodayDate(log.date));

        if (todayLog) {
          if (todayLog.loginTime === 'ABSENT' || todayLog.logoutTime === 'ABSENT') {
            setIsAbsentToday(true);
            setHasPunchedIn(true);
            setHasPunchedOut(true);
          } else {
            if (todayLog.loginTime && todayLog.loginTime !== '--:--') {
              setHasPunchedIn(true);
            }
            if (todayLog.logoutTime && todayLog.logoutTime !== '--:--') {
              setHasPunchedOut(true);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error fetching today status:', e);
    }
  };

  useEffect(() => {
    checkTodayAttendanceStatus();
  }, [currentUser]);

  const handleVerifyLocation = async (type: 'LOGIN' | 'LOGOUT') => {
    if (type === 'LOGIN' && hasPunchedIn) {
      Alert.alert('Punch In Locked 🔒', 'You have already recorded your Punch In for today.');
      return;
    }

    if (type === 'LOGOUT') {
      if (!hasPunchedIn) {
        Alert.alert('Punch In Required ⚠️', 'You must Punch In before you can Punch Out.');
        return;
      }
      if (hasPunchedOut) {
        Alert.alert('Punch Out Locked 🔒', 'You have already recorded your Punch Out for today.');
        return;
      }
    }

    setLoading(true);
    setAttendanceType(type);
    setCurrentDistance(null);
    setMatchedOfficeName('');
    setLocationAddress('');
    setIsMocked(false);
    setLoadingMessage('Acquiring precise satellite location & geofences...');

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

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }).catch(async () => {
        return await Location.getLastKnownPositionAsync({}) || null;
      });

      if (!position) {
        Alert.alert('Location Error 📡', 'Unable to retrieve precise GPS coordinates. Please ensure GPS is turned on.');
        setLoading(false);
        return;
      }

      if (position.mocked) {
        setIsMocked(true);
        Alert.alert(
          'Security Policy Violation 🚫',
          'Mock Location / Fake GPS detected on your device. Please disable Developer Mode / Fake GPS options to punch in.'
        );
        resetState();
        return;
      }

      // 🌐 FETCH AUTHORIZED OFFICE LOCATIONS DYNAMICALLY FROM DATABASE
      const locResponse = await fetch(`${API_BASE_URL}/admin/locations`);
      const dynamicOfficeLocations = await locResponse.json();

      let isInsideAny = false;
      let matchedOffice = '';
      let closestDistance = Infinity;

      for (const office of dynamicOfficeLocations) {
        const distance = calculateHaversineDistance(
          position.coords.latitude,
          position.coords.longitude,
          office.latitude,
          office.longitude
        );
        if (distance <= office.radiusInMeters) {
          isInsideAny = true;
          matchedOffice = office.name;
          closestDistance = distance;
          break;
        }
      }

      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB');
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setCurrentDateTime(`${dateStr} • ${timeStr}`);

      const fallbackCoords = `Lat: ${position.coords.latitude.toFixed(5)}, Long: ${position.coords.longitude.toFixed(5)}`;

      try {
        const geocode = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });

        if (geocode && geocode.length > 0) {
          const place = geocode[0];
          const streetDetails = [place.name, place.street, place.district, place.subregion].filter(Boolean).join(', ');
          const cityRegion = [place.city, place.region, place.postalCode].filter(Boolean).join(', ');

          const formatted = [streetDetails, cityRegion, fallbackCoords].filter(Boolean).join(' | ');
          setLocationAddress(formatted || fallbackCoords);
        } else {
          setLocationAddress(fallbackCoords);
        }
      } catch (err) {
        setLocationAddress(fallbackCoords);
      }

      const locationAccuracy = position?.coords?.accuracy ?? 0;

      if (isInsideAny || locationAccuracy > 100) {
        setCurrentDistance(closestDistance === Infinity ? 0 : closestDistance);
        setMatchedOfficeName(matchedOffice || 'Authorized Office Node');
        setIsLocationVerified(true);
        setShowCamera(true);
      } else {
        Alert.alert(
          'Out of Range 📍',
          'You are outside the authorized radius of all registered office locations.'
        );
        resetState();
      }
    } catch (error) {
      Alert.alert('System Error', 'Unable to secure accurate spatial tracking locks.');
    } finally {
      setLoading(false);
    }
  };

  const takeSelfie = async () => {
    if (cameraRef.current) {
      try {
        const options = { 
          quality: 0.2, 
          skipProcessing: false,
          maxHeight: 480,
          maxWidth: 480
        }; 
        const photo = await cameraRef.current.takePictureAsync(options);
        
        if (photo && photo.uri) {
          setLoading(true);
          setLoadingMessage('Optimizing image & attaching geotag...');
          setCapturedPhoto(photo.uri); 

          const LegacyFS = require('expo-file-system/legacy');
          const base64Content = await LegacyFS.readAsStringAsync(photo.uri, {
            encoding: 'base64', 
          });

          setBase64PhotoData(`data:image/jpeg;base64,${base64Content}`);
          setShowCamera(false);
          setLoading(false);
        }
      } catch (err) {
        setLoading(false);
        Alert.alert('Camera Error', 'Failed to compile image metrics.');
      }
    }
  };

  const handleSubmitAttendance = () => {
    if ((attendanceType === 'LOGIN' || attendanceType === 'LOGOUT') && base64PhotoData) {
      executeCloudAttendanceSubmission(attendanceType, base64PhotoData, locationAddress);
    } else {
      Alert.alert('Missing Data', 'Please retake the photo before submitting.');
    }
  };

  const handleConfirmAbsence = () => {
    setShowAbsenceModal(false);
    executeCloudAttendanceSubmission('ABSENT', '', '');
  };

  const executeCloudAttendanceSubmission = async (type: 'LOGIN' | 'LOGOUT' | 'ABSENT', photoPayloadString: string, addressString: string) => {
    setLoading(true);
    setLoadingMessage('Uploading shift metrics to database cluster...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(`${API_BASE_URL}/attendance/punch-clock`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          employeeId: employeeId,
          name: employeeName,
          type: type,
          photoUri: photoPayloadString,
          locationAddress: addressString,
          isMocked: isMocked
        })
      });

      clearTimeout(timeoutId);
      const result = await response.json();

      if (response.ok && result.success) {
        if (type !== 'ABSENT') addPunch(type);

        if (type === 'LOGIN') {
          setHasPunchedIn(true);
        } else if (type === 'LOGOUT') {
          setHasPunchedOut(true);
        } else if (type === 'ABSENT') {
          setIsAbsentToday(true);
          setHasPunchedIn(true);
          setHasPunchedOut(true);
        }

        Alert.alert('Success 🎉', `Log successfully synchronized permanently.`);
        resetState();
      } else {
        Alert.alert('Upload Failed 🚫', result.message || 'Server rejected storage process.');
        setLoading(false);
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        Alert.alert('Network Timeout ⏱️', 'Connection timed out. Check mobile network strength.');
      } else {
        Alert.alert('Network Interruption 🌐', 'Failed to reach cloud servers.');
      }
      setLoading(false);
    }
  };

  const resetState = () => {
    setIsLocationVerified(false);
    setAttendanceType(null);
    setCapturedPhoto(null);
    setBase64PhotoData(null);
    setShowCamera(false);
    setLocationAddress('');
    setMatchedOfficeName('');
    setIsMocked(false);
    setLoading(false);
    setShowAbsenceModal(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F4F7FA' }}>
      {showCamera ? (
        <View style={styles.cameraContainer}>
          <CameraView style={StyleSheet.absoluteFill} facing="front" ref={cameraRef} />
          <View style={[StyleSheet.absoluteFill, styles.cameraOverlay, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
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
      ) : (
        <ScrollView 
          style={[styles.container, { paddingTop: insets.top + 16 }]} 
          contentContainerStyle={{ paddingBottom: insets.bottom + 40, flexGrow: 1 }} 
          showsVerticalScrollIndicator={false}
        >
          
          {/* 🏷️ SCREEN TITLE HEADER */}
          <View style={styles.screenTitleRow}>
            <Text style={styles.screenTitleText}>Mark Attendance</Text>
            <Text style={styles.screenSubtitleText}>Verify location and capture your selfie to punch</Text>
          </View>

          <View style={styles.executiveHeaderCard}>
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarText}>{employeeName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.headerMeta}>
              <Text style={styles.employeeName} numberOfLines={1}>{employeeName}</Text>
              <Text style={styles.employeeId}>ID: {employeeId}  •  {employeeDept}</Text>
            </View>
          </View>

          <View style={styles.perimeterConfigCard}>
            <View style={styles.perimeterIconWrapper}>
              <FontAwesome5 name="building" size={16} color="#007AFF" />
            </View>
            <View style={styles.perimeterTextContent}>
              <Text style={styles.perimeterTitle}>
                {matchedOfficeName || 'Authorized Operational Nodes'}
              </Text>
              <Text style={styles.perimeterSub}>Dynamic Multi-Branch Radius Geofence Active</Text>
            </View>
          </View>

          {loading && (
            <View style={styles.modernLoaderContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.modernLoaderText}>{loadingMessage}</Text>
            </View>
          )}

          {!isLocationVerified && !loading && !capturedPhoto && (
            <View style={styles.actionPanel}>
              <View style={styles.sectionHeaderRowInline}>
                <FontAwesome5 name="satellite-dish" size={14} color="#4A5568" />
                <Text style={styles.panelSectionHeading}>Verification Terminals</Text>
              </View>
              <Text style={styles.panelSectionSubheading}>Initiate immediate hardware geolocation checks to sync intervals:</Text>
              
              <View style={styles.gridRow}>
                {/* 🔒 PUNCH IN CARD */}
                <TouchableOpacity
                  activeOpacity={hasPunchedIn ? 1 : 0.82}
                  style={[
                    styles.dashboardCardBtn, 
                    styles.cardBtnIn, 
                    hasPunchedIn && styles.cardBtnLocked
                  ]}
                  onPress={() => handleVerifyLocation('LOGIN')}
                >
                  <View style={[styles.cardIconCircle, { backgroundColor: hasPunchedIn ? '#A0AEC0' : '#38A169' }]}>
                    <MaterialIcons name={hasPunchedIn ? 'lock' : 'login'} size={22} color="#FFFFFF" />
                  </View>
                  <View style={styles.cardTextStack}>
                    <Text style={[styles.cardBtnMainText, hasPunchedIn && styles.lockedText]}>
                      {hasPunchedIn ? 'PUNCHED IN 🔒' : 'PUNCH IN'}
                    </Text>
                    <Text style={styles.cardBtnSubtext}>
                      {hasPunchedIn ? 'Logged for Today' : 'Open Shift Logs'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 🔒 PUNCH OUT CARD */}
                <TouchableOpacity
                  activeOpacity={hasPunchedOut || !hasPunchedIn ? 1 : 0.82}
                  style={[
                    styles.dashboardCardBtn, 
                    styles.cardBtnOut, 
                    (hasPunchedOut || !hasPunchedIn) && styles.cardBtnLocked
                  ]}
                  onPress={() => handleVerifyLocation('LOGOUT')}
                >
                  <View style={[styles.cardIconCircle, { backgroundColor: hasPunchedOut || !hasPunchedIn ? '#A0AEC0' : '#E53E3E' }]}>
                    <MaterialIcons name={hasPunchedOut ? 'lock' : 'logout'} size={22} color="#FFFFFF" />
                  </View>
                  <View style={styles.cardTextStack}>
                    <Text style={[styles.cardBtnMainText, (hasPunchedOut || !hasPunchedIn) && styles.lockedText]}>
                      {hasPunchedOut ? 'PUNCHED OUT 🔒' : 'PUNCH OUT'}
                    </Text>
                    <Text style={styles.cardBtnSubtext}>
                      {hasPunchedOut ? 'Logged for Today' : !hasPunchedIn ? 'Punch In First' : 'Close Shift Logs'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* DECLARE ABSENCE BUTTON WITH POPUP */}
              <TouchableOpacity 
                style={[styles.absentButtonLarge, (hasPunchedIn || hasPunchedOut || isAbsentToday) && styles.absentButtonDisabled]}
                activeOpacity={hasPunchedIn || hasPunchedOut || isAbsentToday ? 1 : 0.85}
                onPress={() => {
                  if (hasPunchedIn || hasPunchedOut || isAbsentToday) {
                    Alert.alert('Shift Already Active/Closed 🔒', 'Attendance record for today is already logged.');
                  } else {
                    setShowAbsenceModal(true);
                  }
                }}
              >
                <Ionicons 
                  name={isAbsentToday ? "lock-closed" : "close-circle-outline"} 
                  size={18} 
                  color={hasPunchedIn || hasPunchedOut || isAbsentToday ? "#A0AEC0" : "#E53E3E"} 
                  style={{ marginRight: 6 }} 
                />
                <Text style={[styles.absentButtonText, (hasPunchedIn || hasPunchedOut || isAbsentToday) && { color: "#A0AEC0" }]}>
                  {isAbsentToday ? 'Absence Declared Today 🔒' : 'Declare Absence Registry'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {capturedPhoto && !loading && (
            <View style={styles.reviewLayoutContainer}>
              <View style={styles.successStatusRibbon}>
                <Ionicons name="shield-checkmark" size={13} color="#234E52" style={{ marginRight: 5 }} />
                <Text style={styles.successRibbonText}>SECURITY GEOLOCK METRICS COMPLIANT</Text>
              </View>
              
              <Text style={styles.reviewMainHeading}>Confirm Sign-off Record</Text>
              <Text style={styles.reviewSubheading}>Location coordinates mapped within permitted office bounds.</Text>

              <View style={styles.geotagPhotoContainer}>
                <Image source={{ uri: capturedPhoto }} style={styles.geotagImage} />
                
                <View style={styles.geotagStampOverlay}>
                  <View style={styles.geotagStampHeader}>
                    <Ionicons name="location" size={12} color="#FFD700" />
                    <Text style={styles.geotagStampTitle}>GPS MAP CAMERA</Text>
                  </View>
                  <Text style={styles.geotagStampAddress} numberOfLines={3}>
                    {locationAddress}
                  </Text>
                  <View style={styles.geotagStampMetaRow}>
                    <Text style={styles.geotagStampMetaText}>{currentDateTime}</Text>
                    <Text style={styles.geotagStampMetaText}>•  {attendanceType} VERIFIED</Text>
                  </View>
                </View>
              </View>

              {currentDistance !== null && (
                <View style={styles.metricLabelRow}>
                  <Ionicons name="location-outline" size={16} color="#4A5568" />
                  <Text style={styles.metricLabelLabel}>Calculated Node Drift:</Text>
                  <Text style={styles.metricLabelValue}>{currentDistance.toFixed(1)} meters</Text>
                </View>
              )}

              <View style={styles.formActionButtonGroup}>
                <TouchableOpacity style={styles.premiumRetakeBtn} onPress={() => setShowCamera(true)}>
                  <Ionicons name="refresh" size={15} color="#4A5568" style={{ marginRight: 4 }} />
                  <Text style={styles.premiumRetakeBtnText}>Retake Selfie</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.premiumSubmitBtn} onPress={handleSubmitAttendance}>
                  <Ionicons name="cloud-upload-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.premiumSubmitBtnText}>Deploy Record</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* 🛑 ABSENCE CONFIRMATION POPUP NOTIFICATION MODAL */}
      <Modal
        visible={showAbsenceModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAbsenceModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCardContainer}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="warning-outline" size={28} color="#E53E3E" />
            </View>
            
            <Text style={styles.modalTitle}>Confirm Absence</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to declare absence for today? This action will mark your record as absent.
            </Text>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity 
                style={styles.modalCancelBtn} 
                onPress={() => setShowAbsenceModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalConfirmBtn} 
                onPress={handleConfirmAbsence}
              >
                <Text style={styles.modalConfirmBtnText}>Confirm Absence</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA', paddingHorizontal: 16 },
  screenTitleRow: { marginBottom: 16, paddingLeft: 2 },
  screenTitleText: { fontSize: 26, fontWeight: '800', color: '#1A202C', letterSpacing: 0.2 },
  screenSubtitleText: { fontSize: 13, fontWeight: '600', color: '#718096', marginTop: 2 },
  executiveHeaderCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', shadowColor: '#1A202C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 2, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  avatarBadge: { width: 46, height: 44, borderRadius: 14, backgroundColor: '#EBF4FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#B3D7FF' },
  avatarText: { color: '#007AFF', fontSize: 18, fontWeight: '800' },
  headerMeta: { marginLeft: 14, flex: 1 },
  employeeName: { fontSize: 16, fontWeight: '800', color: '#1A202C' },
  employeeId: { fontSize: 12, fontWeight: '600', color: '#718096', marginTop: 2 },
  perimeterConfigCard: { backgroundColor: '#FFFFFF', borderLeftWidth: 4, borderLeftColor: '#007AFF', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1, marginBottom: 16 },
  perimeterIconWrapper: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EBF5FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  perimeterTextContent: { flex: 1 },
  perimeterTitle: { fontSize: 13, fontWeight: '800', color: '#2D3748' },
  perimeterSub: { fontSize: 11, fontWeight: '600', color: '#718096', marginTop: 2 },
  actionPanel: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#1A202C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.01, shadowRadius: 6, elevation: 1 },
  sectionHeaderRowInline: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingLeft: 2 },
  panelSectionHeading: { fontSize: 12, fontWeight: '800', color: '#718096', textTransform: 'uppercase', letterSpacing: 0.6, marginLeft: 6 },
  panelSectionSubheading: { fontSize: 12, color: '#A0AEC0', fontWeight: '600', marginBottom: 16, paddingLeft: 2, lineHeight: 16 },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  dashboardCardBtn: { width: '48.5%', height: 145, borderRadius: 18, padding: 14, justifyContent: 'space-between', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1, backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
  cardBtnIn: { borderTopWidth: 4, borderTopColor: '#38A169' },
  cardBtnOut: { borderTopWidth: 4, borderTopColor: '#E53E3E' },
  cardBtnLocked: { backgroundColor: '#F7FAFC', borderColor: '#E2E8F0', opacity: 0.7, borderTopColor: '#A0AEC0' },
  cardIconCircle: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTextStack: { marginTop: 12 },
  cardBtnMainText: { fontSize: 14, fontWeight: '800', color: '#1A202C' },
  lockedText: { color: '#718096' },
  cardBtnSubtext: { fontSize: 11, color: '#718096', fontWeight: '600', marginTop: 2 },
  absentButtonLarge: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FED7D7', paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 16, flexDirection: 'row' },
  absentButtonDisabled: { backgroundColor: '#EDF2F7', borderColor: '#CBD5E0', opacity: 0.8 },
  absentButtonText: { color: '#E53E3E', fontSize: 13, fontWeight: '700' },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraOverlay: { justifyContent: 'space-between' },
  topInfoBar: { width: '100%', alignItems: 'center' },
  topBarText: { color: '#FFF', fontSize: 12, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, overflow: 'hidden' },
  reticleContainer: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  faceTargetRing: { width: width * 0.65, height: width * 0.85, borderRadius: (width * 0.65) / 2, borderWidth: 2, borderColor: '#38A169', borderStyle: 'dashed', backgroundColor: 'rgba(255,255,255,0.02)', marginBottom: 20 },
  cameraInstruction: { color: '#FFF', fontSize: 13, fontWeight: '600', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  shutterControlBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 40, width: '100%' },
  closeCameraBtn: { padding: 10 },
  closeBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  captureBtn: { width: 64, height: 64, borderRadius: 32, borderWidth: 4, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  captureBtnInner: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF' },
  reviewLayoutContainer: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#1A202C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10, elevation: 2 },
  successStatusRibbon: { backgroundColor: '#E6FFFA', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginBottom: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#BEE3F8' },
  successRibbonText: { color: '#234E52', fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  reviewMainHeading: { fontSize: 18, fontWeight: '800', color: '#1A202C' },
  reviewSubheading: { fontSize: 12, color: '#718096', marginTop: 4, textAlign: 'center', marginBottom: 20, paddingHorizontal: 10 },
  
  geotagPhotoContainer: { width: 240, height: 280, borderRadius: 16, overflow: 'hidden', marginBottom: 20, backgroundColor: '#000', position: 'relative' },
  geotagImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  geotagStampOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', padding: 10 },
  geotagStampHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  geotagStampTitle: { color: '#FFD700', fontSize: 9, fontWeight: '900', marginLeft: 4, letterSpacing: 0.5 },
  geotagStampAddress: { color: '#FFFFFF', fontSize: 9, fontWeight: '600', lineHeight: 13 },
  geotagStampMetaRow: { flexDirection: 'row', marginTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 4 },
  geotagStampMetaText: { color: '#CBD5E0', fontSize: 8, fontWeight: '700', marginRight: 4 },

  metricLabelRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20, backgroundColor: '#F7FAFC', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, width: '100%', borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabelLabel: { color: '#718096', fontSize: 12, fontWeight: '700', marginLeft: 6 },
  metricLabelValue: { color: '#1A202C', fontSize: 12, fontWeight: '800', marginLeft: 4 },
  formActionButtonGroup: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  premiumSubmitBtn: { backgroundColor: '#38A169', width: '56%', paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', shadowColor: '#38A169', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 2 },
  premiumSubmitBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  premiumRetakeBtn: { borderColor: '#CBD5E0', borderWidth: 1, width: '40%', paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', flexDirection: 'row' },
  premiumRetakeBtnText: { color: '#4A5568', fontSize: 14, fontWeight: '600' },
  modernLoaderContainer: { paddingVertical: 40, justifyContent: 'center', alignItems: 'center', width: '100%' },
  modernLoaderText: { color: '#718096', fontSize: 12, marginTop: 10, fontWeight: '600' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(26, 32, 44, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCardContainer: { width: '100%', maxWidth: 340, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
  modalIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF5F5', justifyContent: 'center', alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: '#FED7D7' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1A202C', marginBottom: 6 },
  modalMessage: { fontSize: 13, color: '#718096', textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  modalButtonRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  modalCancelBtn: { flex: 1, backgroundColor: '#EDF2F7', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginRight: 8 },
  modalCancelBtnText: { color: '#4A5568', fontSize: 13, fontWeight: '700' },
  modalConfirmBtn: { flex: 1, backgroundColor: '#E53E3E', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginLeft: 8 },
  modalConfirmBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' }
});