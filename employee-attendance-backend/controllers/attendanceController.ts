import type { Request, Response } from 'express';
// @ts-ignore
import { v2 as cloudinary } from 'cloudinary';
import { AttendanceShiftLog, RegisteredEmployee } from '../models/AttendanceSchemas.js';

export const punchClock = async (req: Request, res: Response): Promise<any> => {
  const { employeeId, name, type, photoUri, locationAddress } = req.body; 
  
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const formattedDay = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });
  const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

  try {
    let dayLog = await AttendanceShiftLog.findOne({ employeeIdReference: String(employeeId), date: formattedDate });

    let permanentCloudUrl = '';
    if (photoUri && photoUri.startsWith('data:image')) {
      const uploadResponse = await cloudinary.uploader.upload(photoUri, {
        folder: 'employee_attendance_punches',
        resource_type: 'image'
      });
      permanentCloudUrl = uploadResponse.secure_url;
    }

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

    if (dayLog) {
      if (type === 'LOGIN') {
        dayLog.loginTime = formattedTime;
        if (permanentCloudUrl) dayLog.set('capturedPhotoInUri', permanentCloudUrl); 
        if (locationAddress) dayLog.set('locationInAddress', locationAddress);
      } else {
        dayLog.logoutTime = formattedTime;
        if (permanentCloudUrl) dayLog.set('capturedPhotoOutUri', permanentCloudUrl); 
        if (locationAddress) dayLog.set('locationOutAddress', locationAddress);
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
        locationOutAddress: type === 'LOGOUT' ? (locationAddress || '') : ''
      });
      await dayLog.save();
    }
    return res.status(200).json({ success: true, data: dayLog });
  } catch (err: any) {
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