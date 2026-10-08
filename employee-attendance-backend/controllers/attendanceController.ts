import type { Request, Response } from 'express';
// @ts-ignore
import { v2 as cloudinary } from 'cloudinary';
import { AttendanceShiftLog, RegisteredEmployee } from '../models/AttendanceSchemas.js';
import { verifyFace, dataUriToBuffer, checkLiveness, LIVENESS_CHALLENGES } from '../services/rekognition.js';
import type { LivenessChallenge } from '../services/rekognition.js';
import crypto from 'crypto';

// Set FACE_VERIFICATION_ENABLED=false in .env to temporarily bypass face checks (e.g. during rollout).
const FACE_VERIFICATION_ENABLED = process.env.FACE_VERIFICATION_ENABLED !== 'false';

// Set LIVENESS_ENABLED=false in .env to bypass the live-person check (e.g. while old app builds are still in use).
const LIVENESS_ENABLED = process.env.LIVENESS_ENABLED !== 'false';
const CHALLENGE_TTL_MS = 90 * 1000;

// One-time, short-lived challenges issued by the server (single server instance).
const pendingChallenges = new Map<string, { employeeId: string; challenge: LivenessChallenge; exp: number }>();

const normId = (id: any) => String(id ?? '').trim().toUpperCase();

export const getLivenessChallenge = async (req: Request, res: Response): Promise<any> => {
  const employeeId = normId(req.body?.employeeId);
  if (!employeeId) {
    return res.status(400).json({ success: false, message: 'Employee reference missing.' });
  }

  const nowMs = Date.now();
  for (const [t, v] of pendingChallenges) if (v.exp < nowMs) pendingChallenges.delete(t);

  const challenge = LIVENESS_CHALLENGES[crypto.randomInt(LIVENESS_CHALLENGES.length)] as LivenessChallenge;
  const token = crypto.randomBytes(24).toString('hex');
  pendingChallenges.set(token, { employeeId, challenge, exp: nowMs + CHALLENGE_TTL_MS });

  return res.status(200).json({ success: true, token, challenge, expiresInSeconds: CHALLENGE_TTL_MS / 1000 });
};

export const punchClock = async (req: Request, res: Response): Promise<any> => {
  const { employeeId, name, type, photoUri, locationAddress, isMocked, livenessToken, livenessPhotoUri } = req.body;

  // 🛡️ REJECT FAKE GPS / MOCK LOCATION IMMEDIATELY
  if (isMocked === true) {
    return res.status(400).json({
      success: false,
      message: 'Punch rejected: Mock location / Fake GPS detected on your device. Please disable Developer Options.'
    });
  }

  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const formattedDay = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });
  const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

  try {
    let dayLog = await AttendanceShiftLog.findOne({ employeeIdReference: String(employeeId), date: formattedDate });

    // ------------------------------------------------------------------
    // ABSENT: no photo / face check needed
    // ------------------------------------------------------------------
    if (type === 'ABSENT') {
      if (dayLog) {
        dayLog.loginTime = 'ABSENT';
        dayLog.logoutTime = 'ABSENT';
        dayLog.set('capturedPhotoInUri', '');
        dayLog.set('capturedPhotoOutUri', '');
        dayLog.set('locationInAddress', '');
        dayLog.set('locationOutAddress', '');
        await dayLog.save();
      } else {
        dayLog = new AttendanceShiftLog({
          employeeIdReference: employeeId,
          employeeName: name,
          date: formattedDate,
          dayOfWeek: formattedDay,
          loginTime: 'ABSENT',
          logoutTime: 'ABSENT',
          capturedPhotoInUri: '',
          capturedPhotoOutUri: '',
          locationInAddress: '',
          locationOutAddress: ''
        });
        await dayLog.save();
      }
      return res.status(200).json({ success: true, data: dayLog });
    }

    // ------------------------------------------------------------------
    // LOGIN / LOGOUT: face verification BEFORE anything is saved or uploaded
    // ------------------------------------------------------------------
    let faceScore: number | null = null;

    if (FACE_VERIFICATION_ENABLED) {
      if (!photoUri || !String(photoUri).startsWith('data:image')) {
        return res.status(400).json({
          success: false,
          code: 'FACE_PHOTO_REQUIRED',
          message: 'A selfie is required to punch in or out.'
        });
      }

      const employee = await RegisteredEmployee.findOne({ employeeId: String(employeeId).trim().toUpperCase() });

      if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee record not found.' });
      }

      if (!employee.faceIds || employee.faceIds.length === 0) {
        return res.status(403).json({
          success: false,
          code: 'FACE_NOT_ENROLLED',
          message: 'Your face is not enrolled yet. Please ask your admin to enroll your face first.'
        });
      }

      // 1) LIVE-PERSON CHECK (blocks printed photos / photos shown on another phone)
      let issued: { employeeId: string; challenge: LivenessChallenge; exp: number } | undefined;
      if (LIVENESS_ENABLED) {
        issued = pendingChallenges.get(String(livenessToken || ''));
        pendingChallenges.delete(String(livenessToken || '')); // one-time use

        if (!issued || issued.exp < Date.now() || issued.employeeId !== normId(employee.employeeId)) {
          return res.status(400).json({
            success: false,
            code: 'FACE_LIVENESS_REQUIRED',
            message: 'Live check expired or missing. Please start again and follow the on-screen action.'
          });
        }
        if (!livenessPhotoUri || !String(livenessPhotoUri).startsWith('data:image')) {
          return res.status(400).json({
            success: false,
            code: 'FACE_LIVENESS_REQUIRED',
            message: 'Action photo missing. Please start again and follow the on-screen action.'
          });
        }
      }

      // 2) IDENTITY CHECK on the straight photo
      const result = await verifyFace(employee.employeeId, dataUriToBuffer(String(photoUri)));

      if (result.status !== 'MATCH') {
        return res.status(422).json({
          success: false,
          code: result.status === 'MISMATCH' ? 'FACE_MISMATCH' : `FACE_${result.status}`,
          message: result.message
        });
      }
      faceScore = result.similarity ?? null;

      // 3) CHALLENGE CHECK on the action photo
      if (LIVENESS_ENABLED && issued) {
        const live = await checkLiveness(
          employee.employeeId,
          dataUriToBuffer(String(photoUri)),
          dataUriToBuffer(String(livenessPhotoUri)),
          issued.challenge
        );
        if (live.status !== 'MATCH') {
          return res.status(422).json({
            success: false,
            code: live.status === 'MISMATCH' ? 'FACE_MISMATCH' : 'FACE_LIVENESS_FAILED',
            message: live.message
          });
        }
      }
    }

    // ------------------------------------------------------------------
    // Face verified: upload photo and save the punch
    // ------------------------------------------------------------------
    let permanentCloudUrl = '';
    if (photoUri && String(photoUri).startsWith('data:image')) {
      const uploadResponse = await cloudinary.uploader.upload(photoUri, {
        folder: 'employee_attendance_punches',
        resource_type: 'image'
      });
      permanentCloudUrl = uploadResponse.secure_url;
    }

    if (dayLog) {
      if (type === 'LOGIN') {
        dayLog.loginTime = formattedTime;
        if (permanentCloudUrl) dayLog.set('capturedPhotoInUri', permanentCloudUrl);
        if (locationAddress) dayLog.set('locationInAddress', locationAddress);
        dayLog.set('faceMatchInScore', faceScore);
      } else {
        dayLog.logoutTime = formattedTime;
        if (permanentCloudUrl) dayLog.set('capturedPhotoOutUri', permanentCloudUrl);
        if (locationAddress) dayLog.set('locationOutAddress', locationAddress);
        dayLog.set('faceMatchOutScore', faceScore);
      }
      await dayLog.save();
    } else {
      dayLog = new AttendanceShiftLog({
        employeeIdReference: employeeId,
        employeeName: name,
        date: formattedDate,
        dayOfWeek: formattedDay,
        loginTime: type === 'LOGIN' ? formattedTime : '--:--',
        logoutTime: type === 'LOGOUT' ? formattedTime : '--:--',
        capturedPhotoInUri: type === 'LOGIN' ? (permanentCloudUrl || '') : '',
        capturedPhotoOutUri: type === 'LOGOUT' ? (permanentCloudUrl || '') : '',
        locationInAddress: type === 'LOGIN' ? (locationAddress || '') : '',
        locationOutAddress: type === 'LOGOUT' ? (locationAddress || '') : '',
        faceMatchInScore: type === 'LOGIN' ? faceScore : null,
        faceMatchOutScore: type === 'LOGOUT' ? faceScore : null
      });
      await dayLog.save();
    }
    return res.status(200).json({ success: true, data: dayLog });
  } catch (err: any) {
    console.error('punchClock error:', err);
    return res.status(500).json({ success: false, message: 'Cloud deployment handshake error.', error: err.message || err });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<any> => {
  const { employeeId, name, designation, email } = req.body;

  if (!employeeId) {
    return res.status(400).json({ success: false, message: 'Employee reference parameter missing.' });
  }

  try {
    const updatedEmployee = await RegisteredEmployee.findOneAndUpdate(
      { employeeId: String(employeeId).toUpperCase() },
      { name: name.trim(), designation: designation.trim(), email: email.trim().toLowerCase() },
      { new: true }
    );
    return res.status(200).json({ success: true, user: updatedEmployee });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to update user profile.', error: err });
  }
};