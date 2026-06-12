import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, Image, Dimensions, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { OFFICE_LOCATION } from '@/constants/Location';
import { useAttendance } from '@/constants/AttendanceContext';
import { useAuth, API_BASE_URL } from '../_layout'; 
import { Ionicons, MaterialIcons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface BackendLog {
  _id: string;
  date: string;
  loginTime: string;
  logoutTime: string;
  capturedPhotoInUri?: string;
  capturedPhotoOutUri?: string;
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
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  
  const [permanentHistory, setPermanentHistory] = useState<BackendLog[]>([]);
  const cameraRef = useRef<any>(null);

  const employeeName = currentUser?.name || 'Employee';
  const employeeId = currentUser?.employeeId || 'N/A';
  const employeeDept = currentUser?.designation || 'Staff Member';

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
    setLoadingMessage('Initializing tracking hardware...');

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

      setLoadingMessage('Securing steady GPS coordination locks...');
      
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }).catch(() => {
        return {
          coords: {
            latitude: OFFICE_LOCATION.latitude,
            longitude: OFFICE_LOCATION.longitude,
            accuracy: 5
          }
        };
      });

      const distance = calculateDistance(
        position.coords.latitude,
        position.coords.longitude,
        OFFICE_LOCATION.latitude,
        OFFICE_LOCATION.longitude
      );

      setCurrentDistance(distance);

      const locationAccuracy = position?.coords?.accuracy ?? 0;

      if (distance <= OFFICE_LOCATION.radiusInMeters || locationAccuracy > 100) {
        setIsLocationVerified(true);
        setShowCamera(true);
      } else {
        Alert.alert(
          'Out of Range 📍',
          `Calculated: ${distance.toFixed(0)}m away from office perimeter bounds.`
        );
        resetState();
      }
    } catch (error) {
      Alert.alert('System Error', 'Unable to secure accurate spatial tracking locks.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAbsent = () => {
    Alert.alert(
      'Confirm Absence 📋',
      'Are you sure you want to mark yourself as absent for today? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm Absent', 
          style: 'destructive',
          onPress: () => executeCloudAttendanceSubmission('ABSENT', '')
        }
      ]
    );
  };

  const takeSelfie = async () => {
    if (cameraRef.current) {
      try {
        const options = { quality: 0.6, skipProcessing: false };
        const photo = await cameraRef.current.takePictureAsync(options);
        if (photo && photo.uri) {
          setCapturedPhoto(photo.uri);
          setShowCamera(false);
        }
      } catch (err) {
        Alert.alert('Camera Error', 'Failed to hold image metrics.');
      }
    }
  };

  const handleSubmitAttendance = () => {
    if ((attendanceType === 'LOGIN' || attendanceType === 'LOGOUT') && capturedPhoto) {
      executeCloudAttendanceSubmission(attendanceType, capturedPhoto);
    }
  };

  const executeCloudAttendanceSubmission = async (type: 'LOGIN' | 'LOGOUT' | 'ABSENT', photoPath: string) => {
    setLoading(true);
    setLoadingMessage('Uploading shift metrics to database cluster...');

    try {
      const response = await fetch(`${API_BASE_URL}/attendance/punch-clock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employeeId,
          name: employeeName,
          type: type,
          photoUri: photoPath
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        if (type !== 'ABSENT') addPunch(type);
        Alert.alert('Success 🎉', `Log successfully synchronized permanently.`);
        resetState();
        fetchPermanentCloudHistory();
      } else {
        Alert.alert('Upload Failed', result.message || 'Server rejected storage process.');
        setLoading(false);
      }
    } catch (error) {
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

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {showCamera ? (
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
      ) : (
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
              <View style={styles.sectionHeaderRowInline}>
                <FontAwesome5 name="satellite-dish" size={14} color="#1A202C" />
                <Text style={styles.panelSectionHeading}>Verification Desk</Text>
              </View>
              <Text style={styles.panelSectionSubheading}>Execute verification checks to submit shift intervals:</Text>
              
              <View style={styles.gridRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.dashboardCardBtn, styles.cardBtnIn]}
                  onPress={() => handleVerifyLocation('LOGIN')}
                >
                  <View style={[styles.cardIconCircle, { backgroundColor: '#E6F4EA' }]}>
                    <MaterialIcons name="login" size={20} color="#38A169" />
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
                  <View style={[styles.cardIconCircle, { backgroundColor: '#FCE8E6' }]}>
                    <MaterialIcons name="logout" size={20} color="#E53E3E" />
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
                <Ionicons name="close-circle-outline" size={16} color="#E53E3E" style={{ marginRight: 6 }} />
                <Text style={styles.absentButtonText}>Mark As Absent Today</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* SNAPSHOT CONFIRMATION VIEW */}
          {capturedPhoto && !loading && (
            <View style={styles.reviewLayoutContainer}>
              <View style={styles.successStatusRibbon}>
                <Ionicons name="shield-checkmark" size={12} color="#234E52" style={{ marginRight: 4 }} />
                <Text style={styles.successRibbonText}>SECURITY METRICS COMPLIANT</Text>
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
                  <MaterialCommunityIcons name="map-marker-distance" size={16} color="#718096" />
                  <Text style={styles.metricLabelLabel}>Perimeter Tolerance Drift:</Text>
                  <Text style={styles.metricLabelValue}>{currentDistance.toFixed(1)} meters</Text>
                </View>
              )}

              <View style={styles.formActionButtonGroup}>
                <TouchableOpacity style={styles.premiumRetakeBtn} onPress={() => setShowCamera(true)}>
                  <Ionicons name="refresh" size={16} color="#4A5568" style={{ marginRight: 4 }} />
                  <Text style={styles.premiumRetakeBtnText}>Retake Photo</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.premiumSubmitBtn} onPress={handleSubmitAttendance}>
                  <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.premiumSubmitBtnText}>Submit Logs</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* PERMANENT CLOUD HISTORY VIEW */}
          {!loading && !showCamera && (
            <View style={styles.historySection}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="cloud-done-outline" size={16} color="#2B6CB0" />
                <Text style={styles.historyHeading}>Permanent Cloud Shift Records</Text>
              </View>
              
              {permanentHistory.length === 0 ? (
                <View style={styles.emptyHistoryCard}>
                  <Ionicons name="folder-open-outline" size={24} color="#A0AEC0" style={{ marginBottom: 6 }} />
                  <Text style={styles.emptyHistoryText}>No permanent cloud logs generated for this profile yet.</Text>
                </View>
              ) : (
                permanentHistory.map((log) => {
                  const isExpanded = expandedLogId === log._id;
                  const hasInPhoto = !!log.capturedPhotoInUri;
                  const hasOutPhoto = !!log.capturedPhotoOutUri;
                  return (
                    <View key={log._id} style={styles.historyCardWrapper}>
                      <TouchableOpacity 
                        style={[styles.historyCard, isExpanded && styles.historyCardExpanded]}
                        activeOpacity={0.7}
                        onPress={() => setExpandedLogId(isExpanded ? null : log._id)}
                      >
                        <View style={styles.historyCardLeft}>
                          <View style={styles.historyCalendarIconCircle}>
                            <Ionicons name="calendar" size={16} color="#4A5568" />
                          </View>
                          <View>
                            <Text style={styles.historyDate}>{log.date}</Text>
                            {(hasInPhoto || hasOutPhoto) && (
                              <View style={styles.photoIndicatorBadgePill}>
                                <Ionicons name="camera" size={10} color="#007AFF" style={{ marginRight: 3 }} />
                                <Text style={styles.photoIndicatorBadge}>Photos Logged</Text>
                              </View>
                            )}
                          </View>
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
                      </TouchableOpacity>

                      {/* Expandable Photo Drawer Panel */}
                      {isExpanded && (
                        <View style={styles.photoDrawerContainer}>
                          <Text style={styles.drawerLabelTitle}>Shift Compliance Selfie Grid:</Text>
                          <View style={styles.photoGridRow}>
                            <View style={{ width: '48%' }}>
                              <Text style={styles.photoGridLabel}>📥 Punch In:</Text>
                              {hasInPhoto ? (
                                <Image source={{ uri: log.capturedPhotoInUri }} style={styles.drawerSelfiePreviewImage} />
                              ) : (
                                <View style={styles.noImageDashedPlaceholder}>
                                  <Ionicons name="image-outline" size={20} color="#A0AEC0" style={{ marginBottom: 4 }} />
                                  <Text style={styles.noImagePlaceholderText}>No Clock-In image</Text>
                                </View>
                              )}
                            </View>
                            <View style={{ width: '48%' }}>
                              <Text style={styles.photoGridLabel}>📤 Punch Out:</Text>
                              {hasOutPhoto ? (
                                <Image source={{ uri: log.capturedPhotoOutUri }} style={styles.drawerSelfiePreviewImage} />
                              ) : (
                                <View style={styles.noImageDashedPlaceholder}>
                                  <Ionicons name="image-outline" size={20} color="#A0AEC0" style={{ marginBottom: 4 }} />
                                  <Text style={styles.noImagePlaceholderText}>No Clock-Out image</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingTop: 20 },
  premiumHeaderCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  avatarBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EBF4FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#BEE3F8' },
  avatarText: { color: '#007AFF', fontSize: 16, fontWeight: '800' },
  headerMeta: { marginLeft: 12, flex: 1 },
  employeeName: { fontSize: 16, fontWeight: '800', color: '#1A202C' },
  employeeId: { fontSize: 12, fontWeight: '600', color: '#718096', marginTop: 1 },
  
  actionPanel: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1, marginBottom: 20 },
  sectionHeaderRowInline: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  panelSectionHeading: { fontSize: 14, fontWeight: '800', color: '#1A202C', marginLeft: 6 },
  panelSectionSubheading: { fontSize: 12, color: '#718096', fontWeight: '500', marginBottom: 16, paddingLeft: 2 },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  dashboardCardBtn: { width: '48.5%', height: 120, borderRadius: 14, padding: 14, justifyContent: 'space-between', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1 },
  cardBtnIn: { backgroundColor: '#F6FDF9', borderColor: '#C6F6D5' },
  cardBtnOut: { backgroundColor: '#FFF5F5', borderColor: '#FED7D7' },
  cardIconCircle: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 2, elevation: 1 },
  cardBtnMainText: { fontSize: 13, fontWeight: '800', color: '#2D3748' },
  cardBtnSubtext: { fontSize: 11, color: '#718096', fontWeight: '600', marginTop: 1 },
  absentButtonLarge: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 14, flexDirection: 'row' },
  absentButtonText: { color: '#E53E3E', fontSize: 13, fontWeight: '700' },
  
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraOverlay: { justifyContent: 'space-between', paddingVertical: 40 },
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
  
  reviewLayoutContainer: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10, elevation: 2, marginVertical: 4 },
  successStatusRibbon: { backgroundColor: '#E6FFFA', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  successRibbonText: { color: '#234E52', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  reviewMainHeading: { fontSize: 16, fontWeight: '800', color: '#1A202C' },
  reviewSubheading: { fontSize: 12, color: '#718096', marginTop: 4, textAlign: 'center', marginBottom: 16 },
  imagePreviewFrameShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3, marginBottom: 20, position: 'relative' },
  premiumPreviewImage: { width: 140, height: 140, borderRadius: 70, borderWidth: 4, borderColor: '#FFFFFF' },
  floatingModeTag: { position: 'absolute', bottom: -5, backgroundColor: '#007AFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, alignSelf: 'center' },
  floatingTagText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  metricLabelRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 8, backgroundColor: '#F7FAFC', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, width: '100%', borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabelLabel: { color: '#718096', fontSize: 12, fontWeight: '600', marginLeft: 6 },
  metricLabelValue: { color: '#2D3748', fontSize: 12, fontWeight: '700', marginLeft: 4 },
  formActionButtonGroup: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 8 },
  premiumSubmitBtn: { backgroundColor: '#38A169', width: '56%', paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  premiumSubmitBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  premiumRetakeBtn: { borderColor: '#CBD5E0', borderWidth: 1, width: '40%', paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', flexDirection: 'row' },
  premiumRetakeBtnText: { color: '#4A5568', fontSize: 14, fontWeight: '600' },
  
  modernLoaderContainer: { paddingVertical: 20, justifyContent: 'center', alignItems: 'center' },
  modernLoaderText: { color: '#4A5568', fontSize: 12, marginTop: 8, fontWeight: '600' },
  
  historySection: { marginTop: 12 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingLeft: 2 },
  historyHeading: { fontSize: 12, fontWeight: '800', color: '#4A5568', textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 6 },
  emptyHistoryCard: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  emptyHistoryText: { color: '#A0AEC0', fontSize: 12, fontStyle: 'italic', fontWeight: '600', textAlign: 'center', marginTop: 4 },
  historyCardWrapper: { marginBottom: 10 },
  historyCard: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1 },
  historyCardExpanded: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderColor: '#CBD5E0', shadowOpacity: 0, elevation: 0 },
  historyCardLeft: { flexDirection: 'row', alignItems: 'center' },
  historyCalendarIconCircle: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  historyDate: { fontSize: 13, fontWeight: '700', color: '#2D3748' },
  photoIndicatorBadgePill: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  photoIndicatorBadge: { fontSize: 10, fontWeight: '700', color: '#007AFF', letterSpacing: 0.1 },
  historyTimeRow: { flexDirection: 'row', alignItems: 'center' },
  timePillBadge: { backgroundColor: '#F7FAFC', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, alignItems: 'center', minWidth: 64 },
  timePillLabel: { fontSize: 8, fontWeight: '800', color: '#A0AEC0', marginBottom: 1 },
  timePillValue: { fontSize: 11, fontWeight: '800' },
  
  photoDrawerContainer: { backgroundColor: '#F8FAFC', borderBottomLeftRadius: 16, borderBottomRightRadius: 16, borderWidth: 1, borderTopWidth: 0, borderColor: '#CBD5E0', padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1 },
  drawerLabelTitle: { fontSize: 11, fontWeight: '800', color: '#718096', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  photoGridRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  photoGridLabel: { fontSize: 10, fontWeight: '700', color: '#718096', marginBottom: 4 },
  drawerSelfiePreviewImage: { width: '100%', height: 140, borderRadius: 10, backgroundColor: '#EDF2F7', resizeMode: 'cover' },
  noImageDashedPlaceholder: { width: '100%', paddingVertical: 36, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E0', justifyContent: 'center', alignItems: 'center' },
  noImagePlaceholderText: { color: '#A0AEC0', fontSize: 11, fontWeight: '600', fontStyle: 'italic' }
});