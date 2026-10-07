import type { Request, Response } from 'express';
// @ts-ignore
import { v2 as cloudinary } from 'cloudinary';
import { AttendanceShiftLog, RegisteredEmployee } from '../models/AttendanceSchemas.js';
import { verifyFace, dataUriToBuffer } from '../services/rekognition.js';

// Set FACE_VERIFICATION_ENABLED=false in .env to temporarily bypass face checks (e.g. during rollout).
const FACE_VERIFICATION_ENABLED = process.env.FACE_VERIFICATION_ENABLED !== 'false';

export const punchClock = async (req: Request, res: Response): Promise<any> => {
  const { employeeId, name, type, photoUri, locationAddress, isMocked } = req.body;

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

      const result = await verifyFace(employee.employeeId, dataUriToBuffer(String(photoUri)));

      if (result.status !== 'MATCH') {
        return res.status(422).json({
          success: false,
          code: result.status === 'MISMATCH' ? 'FACE_MISMATCH' : `FACE_${result.status}`,
          message: result.message
        });
      }
      faceScore = result.similarity ?? null;
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