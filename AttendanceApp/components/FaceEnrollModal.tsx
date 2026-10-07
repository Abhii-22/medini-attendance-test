import React, { useRef, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// IMPORTANT: this must point to the same file that exports API_BASE_URL.
// admin.tsx imports it from './_layout', so we receive it as a prop instead of importing
// (avoids circular imports and keeps this component reusable).

interface Props {
  visible: boolean;
  apiBaseUrl: string;
  employee: { _id: string; name: string; employeeId: string; faceIds?: string[] } | null;
  onClose: () => void;
  onEnrolled: () => void; // called after a successful enrollment so the list can refresh
}

const MAX_PHOTOS = 3;

export default function FaceEnrollModal({ visible, apiBaseUrl, employee, onClose, onEnrolled }: Props) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photos, setPhotos] = useState<string[]>([]); // data URIs
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');

  // Reset every time the modal opens
  useEffect(() => {
    if (visible) {
      setPhotos([]);
      setCapturing(false);
      setUploading(false);
      setFacing('front');
      if (permission && !permission.granted) requestPermission();
    }
  }, [visible]);

  if (!employee) return null;

  const alreadyEnrolled = (employee.faceIds?.length ?? 0) > 0;

  const handleCapture = async () => {
    if (!cameraRef.current || capturing || photos.length >= MAX_PHOTOS) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5, base64: true });

      let base64 = photo?.base64;
      if (!base64 && photo?.uri) {
        const LegacyFS = require('expo-file-system/legacy');
        base64 = await LegacyFS.readAsStringAsync(photo.uri, { encoding: 'base64' });
      }
      if (!base64) throw new Error('No image data');

      setPhotos((prev) => [...prev, `data:image/jpeg;base64,${base64}`]);
    } catch (e) {
      Alert.alert('Camera Error', 'Could not capture the photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const handleRemove = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEnroll = async () => {
    if (photos.length === 0) {
      Alert.alert('No Photos', 'Capture at least one photo first.');
      return;
    }

    setUploading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(`${apiBaseUrl}/admin/enroll-face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ _id: employee._id, photos }),
      });
      clearTimeout(timeoutId);

      const result = await response.json();

      if (response.ok && result.success) {
        Alert.alert('Face Enrolled ✅', `${employee.name}'s face was enrolled (${result.faceCount} photo${result.faceCount > 1 ? 's' : ''}).`);
        onEnrolled();
        onClose();
      } else {
        Alert.alert('Enrollment Failed', result.message || 'The server rejected the photos.');
        setPhotos([]); // let admin retake from scratch
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      Alert.alert(
        e?.name === 'AbortError' ? 'Timed Out' : 'Connection Error',
        e?.name === 'AbortError' ? 'The server took too long to respond.' : 'Could not reach the server.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveEnrollment = () => {
    Alert.alert('Remove Face Data', `Delete the enrolled face for ${employee.name}? They will not be able to punch until re-enrolled.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setUploading(true);
            const res = await fetch(`${apiBaseUrl}/admin/face/${employee._id}`, { method: 'DELETE' });
            const result = await res.json();
            if (res.ok && result.success) {
              onEnrolled();
              onClose();
            } else {
              Alert.alert('Failed', result.message || 'Could not remove face data.');
            }
          } catch (e) {
            Alert.alert('Connection Error', 'Could not reach the server.');
          } finally {
            setUploading(false);
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Enroll Face</Text>
            <Text style={styles.subtitle}>
              {employee.name} ({employee.employeeId})
              {alreadyEnrolled ? '  •  re-enrolling replaces the old face' : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} disabled={uploading} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={26} color="#1A202C" />
          </TouchableOpacity>
        </View>

        {!permission?.granted ? (
          <View style={styles.centerBox}>
            <Text style={styles.helpText}>Camera permission is required to enroll a face.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
              <Text style={styles.primaryBtnText}>Allow Camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.cameraFrame}>
              <CameraView style={StyleSheet.absoluteFill} facing={facing} ref={cameraRef} />
              <View style={styles.ring} pointerEvents="none" />
              <TouchableOpacity
                style={styles.flipBtn}
                onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
                disabled={capturing || uploading}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="camera-reverse" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.helpText}>
              Capture {MAX_PHOTOS} clear photos: straight on, slightly left, slightly right. Good light, no mask, no cap, no sunglasses.
            </Text>

            <View style={styles.thumbRow}>
              {Array.from({ length: MAX_PHOTOS }).map((_, i) => (
                <View key={i} style={styles.thumbSlot}>
                  {photos[i] ? (
                    <>
                      <Image source={{ uri: photos[i] }} style={styles.thumbImg} />
                      <TouchableOpacity style={styles.thumbRemove} onPress={() => handleRemove(i)} disabled={uploading}>
                        <Ionicons name="close-circle" size={20} color="#E53E3E" />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={styles.thumbPlaceholder}>{i + 1}</Text>
                  )}
                </View>
              ))}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.captureBtn, (capturing || uploading || photos.length >= MAX_PHOTOS) && { opacity: 0.4 }]}
                onPress={handleCapture}
                disabled={capturing || uploading || photos.length >= MAX_PHOTOS}
              >
                {capturing ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="camera" size={22} color="#FFFFFF" />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1, marginLeft: 12 }, (photos.length === 0 || uploading) && { opacity: 0.4 }]}
                onPress={handleEnroll}
                disabled={photos.length === 0 || uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Enroll {photos.length} Photo{photos.length === 1 ? '' : 's'}</Text>
                )}
              </TouchableOpacity>
            </View>

            {alreadyEnrolled && (
              <TouchableOpacity style={styles.removeBtn} onPress={handleRemoveEnrollment} disabled={uploading}>
                <Text style={styles.removeBtnText}>Remove Enrolled Face</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#1A202C' },
  subtitle: { fontSize: 12, color: '#718096', marginTop: 2, fontWeight: '600' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraFrame: { flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  ring: { width: 220, height: 280, borderRadius: 140, borderWidth: 3, borderColor: '#48BB78', borderStyle: 'dashed' },
  flipBtn: { position: 'absolute', top: 12, right: 12, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  helpText: { fontSize: 12, color: '#4A5568', textAlign: 'center', marginVertical: 10, lineHeight: 17 },
  thumbRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 12 },
  thumbSlot: { width: 64, height: 64, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E0', backgroundColor: '#EDF2F7', marginHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
  thumbImg: { width: '100%', height: '100%', borderRadius: 11 },
  thumbPlaceholder: { color: '#A0AEC0', fontWeight: '800', fontSize: 16 },
  thumbRemove: { position: 'absolute', top: -8, right: -8, backgroundColor: '#FFFFFF', borderRadius: 10 },
  actionRow: { flexDirection: 'row', alignItems: 'center' },
  captureBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#38A169', justifyContent: 'center', alignItems: 'center' },
  primaryBtn: { backgroundColor: '#007AFF', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  removeBtn: { marginTop: 12, paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#FED7D7', backgroundColor: '#FFF5F5' },
  removeBtnText: { color: '#E53E3E', fontWeight: '700', fontSize: 13 },
});