import type { Request, Response } from 'express';
import { RegisteredEmployee, AttendanceShiftLog, OfficeLocation, Holiday } from '../models/AttendanceSchemas.js';
import { enrollFaces, deleteFaces, dataUriToBuffer } from '../services/rekognition.js';
import { getOrgId } from '../middleware/requireOrg.js';

export const registerEmployee = async (req: Request, res: Response): Promise<any> => {
  const { email, employeeId, name, designation, password, role, lunchBreakMinutes, monthlyCasualLeaveLimit } = req.body;

  if (!email || !employeeId || !name || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Registration Denied: Full Name, Employee ID, Email, and Password fields cannot be left empty.' 
    });
  }

  try {
    const orgId = getOrgId(req);
    const searchEmail = String(email).trim().toLowerCase();
    const searchId = String(employeeId).trim().toUpperCase();
    const targetRole = role || 'EMPLOYEE';

    // Emails are unique across the whole system (login is by email).
    const existingUser = await RegisteredEmployee.findOne({ email: searchEmail });

    if (existingUser) {
      // Only upgrade a profile that belongs to THIS organization.
      if (targetRole === 'ADMIN_VIEW' && String(existingUser.organizationId) === orgId) {
        await RegisteredEmployee.updateOne(
          { _id: existingUser._id },
          { $addToSet: { role: 'ADMIN_VIEW' } }
        );
        
        const updatedUser = await RegisteredEmployee.findById(existingUser._id);
        return res.status(200).json({ 
          success: true, 
          message: `Upgraded ${existingUser.name} to Admin View Supervisor access level successfully.`, 
          employee: updatedUser 
        });
      }
      return res.status(400).json({ success: false, message: 'Registration Denied: This email address is already assigned to an active profile.' });
    }

    const existingId = await RegisteredEmployee.findOne({ organizationId: orgId, employeeId: searchId });
    if (existingId) {
      return res.status(400).json({ success: false, message: 'Registration Denied: This Employee ID is already assigned to a staff profile.' });
    }

    const parsedLunchMinutes = lunchBreakMinutes !== undefined && lunchBreakMinutes !== null ? Number(lunchBreakMinutes) : 0;
    const parsedClLimit = monthlyCasualLeaveLimit !== undefined && monthlyCasualLeaveLimit !== null ? Number(monthlyCasualLeaveLimit) : 0;

    const newEmployee = new RegisteredEmployee({
      organizationId: orgId,
      name: name.trim(),
      employeeId: searchId,
      designation: (designation || 'Staff').trim(), 
      email: searchEmail,
      password: password, 
      role: [targetRole],
      lunchBreakMinutes: isNaN(parsedLunchMinutes) ? 0 : parsedLunchMinutes,
      monthlyCasualLeaveLimit: isNaN(parsedClLimit) ? 0 : parsedClLimit
    });

    await newEmployee.save();
    return res.status(201).json({ success: true, message: 'Employee profile deployed successfully!', employee: newEmployee });

  } catch (err: any) {
    return res.status(500).json({ success: false, message: `Database schema execution conflict: ${err.message || 'Check structural field properties.'}` });
  }
};

export const getEmployees = async (req: Request, res: Response) => {
  const list = await RegisteredEmployee.find({ organizationId: getOrgId(req) }).sort({ createdAt: -1 });
  res.status(200).json(list);
};

export const updateEmployee = async (req: Request, res: Response): Promise<any> => {
  const { _id, name, designation, email, password, role, lunchBreakMinutes, monthlyCasualLeaveLimit } = req.body;

  if (!_id) {
    return res.status(400).json({ success: false, message: "Missing document reference identifier." });
  }

  try {
    const updatePayload: any = {};
    if (name !== undefined) updatePayload.name = String(name).trim();
    if (designation !== undefined) updatePayload.designation = String(designation).trim();
    if (email !== undefined) updatePayload.email = String(email).trim().toLowerCase();

    if (password && String(password).trim() !== '') {
      updatePayload.password = password;
    }

    if (lunchBreakMinutes !== undefined && lunchBreakMinutes !== null) {
      const parsedLunchMinutes = Number(lunchBreakMinutes);
      updatePayload.lunchBreakMinutes = isNaN(parsedLunchMinutes) ? 0 : parsedLunchMinutes;
    }

    if (monthlyCasualLeaveLimit !== undefined && monthlyCasualLeaveLimit !== null) {
      const parsedCl = Number(monthlyCasualLeaveLimit);
      updatePayload.monthlyCasualLeaveLimit = isNaN(parsedCl) ? 0 : parsedCl;
    }

    if (role) {
      updatePayload.role = [role];
    }

    const updatedEmployee = await RegisteredEmployee.findOneAndUpdate({ _id, organizationId: getOrgId(req) }, updatePayload, { new: true, runValidators: true });

    if (!updatedEmployee) {
      return res.status(404).json({ success: false, message: "Target workspace record could not be found." });
    }

    return res.status(200).json({ success: true, employee: updatedEmployee });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: "Failed to update employee profile.", error: err.message || err });
  }
};

export const deleteEmployee = async (req: Request, res: Response): Promise<any> => {
  const targetMongoId = String(req.params.id);
  const orgId = getOrgId(req);

  try {
    const employeeRecord = await RegisteredEmployee.findOne({ _id: targetMongoId, organizationId: orgId });
    if (!employeeRecord) {
      return res.status(404).json({ success: false, message: "Profile record not active in registry directory." });
    }

    // Remove this employee's faces from AWS Rekognition (non-blocking on failure)
    try {
      await deleteFaces(orgId, employeeRecord.faceIds || []);
    } catch (faceErr) {
      console.error('Face cleanup failed for', employeeRecord.employeeId, faceErr);
    }

    await AttendanceShiftLog.deleteMany({ organizationId: orgId, employeeIdReference: employeeRecord.employeeId });
    await RegisteredEmployee.findOneAndDelete({ _id: targetMongoId, organizationId: orgId });

    return res.status(200).json({ success: true, message: "Profile data and chronological logs purged cleanly." });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to isolate cluster document targets.", error: err });
  }
};

// 0 = January. Absent days are generated from this month of the current year up to yesterday.
const TRACKING_START_MONTH = 0;

export const getAttendanceSheet = async (req: Request, res: Response): Promise<any> => {
  try {
    const orgId = getOrgId(req);
    const employeeName = req.query.employeeName ? String(req.query.employeeName) : 'ALL';
    const filter = employeeName !== 'ALL' ? { organizationId: orgId, employeeName } : { organizationId: orgId };
    
    const sheets = await AttendanceShiftLog.find(filter).sort({ createdAt: -1 });

    const allHolidays = await Holiday.find({ organizationId: orgId });
    const holidaysMap = new Map<string, string>();
    allHolidays.forEach((h: any) => {
      if (h.date) {
        const cleanDate = h.date.replace(',', '').replace(/\s+/g, ' ').toLowerCase().trim();
        holidaysMap.set(cleanDate, h.title);
      }
    });

    const allEmployees = await RegisteredEmployee.find({ organizationId: orgId });
    const targetEmployees = employeeName !== 'ALL' 
      ? allEmployees.filter(e => e.name.toLowerCase() === employeeName.toLowerCase())
      : allEmployees.filter(e => {
          const r = Array.isArray(e.role) ? e.role : [e.role || 'EMPLOYEE'];
          return !r.includes('ADMIN_VIEW');
        });

    const now = new Date();
    const todayString = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' });

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const todayDateNum = now.getDate();

    const existingLogsMap = new Map<string, boolean>();
    sheets.forEach((log: any) => {
      existingLogsMap.set(`${log.employeeIdReference}_${log.date}`, true);
    });

    let newlyDetectedLogs: any[] = [];

    // Earliest saved log per employee (so history before registration date is still covered)
    const earliestLogByEmp = new Map<string, Date>();
    sheets.forEach((log: any) => {
      const d = new Date(log.date);
      if (isNaN(d.getTime())) return;
      const k = String(log.employeeIdReference).toUpperCase();
      const prev = earliestLogByEmp.get(k);
      if (!prev || d < prev) earliestLogByEmp.set(k, d);
    });

    const todayStart = new Date(currentYear, currentMonth, todayDateNum);

    for (const emp of targetEmployees) {
      // Show absences for ALL previous months of this year (not limited to registration date).
      // Change TRACKING_START_MONTH to 0 for January, 3 for April, etc.
      let startDate = new Date(currentYear, TRACKING_START_MONTH, 1);
      const firstLog = earliestLogByEmp.get(String(emp.employeeId).toUpperCase());
      if (firstLog && firstLog < startDate && firstLog.getFullYear() === currentYear) {
        startDate = new Date(firstLog.getFullYear(), firstLog.getMonth(), firstLog.getDate());
      }

      for (
        let cursor = new Date(startDate);
        cursor < todayStart; // strictly before today
        cursor.setDate(cursor.getDate() + 1)
      ) {
        const dateObj = new Date(cursor);
        if (dateObj.getDay() === 0) continue;

        const formattedDateStr = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        if (formattedDateStr === todayString) continue;

        const cleanFormattedDateStr = formattedDateStr.replace(',', '').replace(/\s+/g, ' ').toLowerCase().trim();
        const holidayTitle = holidaysMap.get(cleanFormattedDateStr);
        const dayOfWeekStr = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const uniqueKey = `${emp.employeeId}_${formattedDateStr}`;

        if (!existingLogsMap.has(uniqueKey)) {
          if (holidayTitle) {
            newlyDetectedLogs.push({
              _id: `holiday-${emp.employeeId}-${formattedDateStr}`,
              employeeIdReference: emp.employeeId,
              employeeName: emp.name,
              date: formattedDateStr,
              dayOfWeek: dayOfWeekStr,
              loginTime: 'HOLIDAY',
              logoutTime: 'HOLIDAY',
              capturedPhotoInUri: '',
              capturedPhotoOutUri: '',
              locationInAddress: '',
              locationOutAddress: '',
              isHolidayPlaceholder: true,
              holidayTitle: holidayTitle
            });
          } else {
            newlyDetectedLogs.push({
              _id: `absent-${emp.employeeId}-${formattedDateStr}`,
              employeeIdReference: emp.employeeId,
              employeeName: emp.name,
              date: formattedDateStr,
              dayOfWeek: dayOfWeekStr,
              loginTime: 'ABSENT',
              logoutTime: 'ABSENT',
              capturedPhotoInUri: '',
              capturedPhotoOutUri: '',
              locationInAddress: '',
              locationOutAddress: '',
              isVirtualAbsent: true
            });
          }
        }
      }
    }

    const normDate = (d: string) => String(d).replace(',', '').replace(/\s+/g, ' ').toLowerCase().trim();
    const clLimitByEmp = new Map<string, number>();
    allEmployees.forEach((e: any) => {
      clLimitByEmp.set(String(e.employeeId).toUpperCase(), Number(e.monthlyCasualLeaveLimit) || 0);
    });

    const combined: any[] = [
      ...sheets.map((l: any) => (typeof l.toObject === 'function' ? l.toObject() : l)),
      ...newlyDetectedLogs
    ];

    // RULE 1: a holiday date always shows HOLIDAY (unless the employee really punched in that day)
    combined.forEach((log: any) => {
      const title = holidaysMap.get(normDate(log.date));
      if (!title) return;
      const hasRealPunch = [log.loginTime, log.logoutTime].some(
        (t: string) => t && !['--:--', 'ABSENT', 'CASUAL LEAVE', 'HOLIDAY', 'OFF'].includes(t)
      );
      if (hasRealPunch) return;
      log.loginTime = 'HOLIDAY';
      log.logoutTime = 'HOLIDAY';
      log.isHolidayPlaceholder = true;
      log.holidayTitle = title;
      log.isCasualLeave = false;
      log.isVirtualAbsent = false;
    });

    // RULE 2: per employee, per month, the FIRST N absent days (N = admin CL limit) become CL
    const absentGroups = new Map<string, any[]>();
    combined.forEach((log: any) => {
      if (log.isHolidayPlaceholder) return;
      if (log.loginTime !== 'ABSENT' && log.logoutTime !== 'ABSENT') return;
      const d = new Date(log.date);
      if (isNaN(d.getTime())) return;
      const key = `${String(log.employeeIdReference).toUpperCase()}|${d.getFullYear()}-${d.getMonth()}`;
      if (!absentGroups.has(key)) absentGroups.set(key, []);
      absentGroups.get(key)!.push(log);
    });

    absentGroups.forEach((group, key) => {
      const empId = key.split('|')[0] as string;
      const limit = clLimitByEmp.get(empId) ?? 0;
      group.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      group.slice(0, limit).forEach((log: any) => {
        log.loginTime = 'CASUAL LEAVE';
        log.logoutTime = 'CASUAL LEAVE';
        log.isCasualLeave = true;
        log.isVirtualAbsent = false;
        log.holidayTitle = 'Casual Leave (CL)';
        log.capturedPhotoInUri = '';
        log.capturedPhotoOutUri = '';
      });
    });

    combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return res.status(200).json(combined);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to compile attendance sheet.', error: err.message });
  }
};

export const downloadAttendance = async (req: Request, res: Response): Promise<any> => {
  try {
    const orgId = getOrgId(req);
    const employeeName = req.query.employeeName ? String(req.query.employeeName) : 'ALL';
    const filterMonth = req.query.month ? String(req.query.month) : new Date().toLocaleString('en-US', { month: 'long' });
    const filterYear = req.query.year ? String(req.query.year) : new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric' });

    const allEmployees = await RegisteredEmployee.find({ organizationId: orgId });
    const employeeLunchMap: { [key: string]: number } = {};

    allEmployees.forEach((emp: any) => {
      if (emp.employeeId) {
        employeeLunchMap[emp.employeeId.toUpperCase()] = emp.lunchBreakMinutes || 0;
      }
      if (emp.name) {
        employeeLunchMap[emp.name.toLowerCase().trim()] = emp.lunchBreakMinutes || 0;
      }
    });

    const allHolidays = await Holiday.find({ organizationId: orgId });
    const holidaysMap = new Map<string, string>();
    allHolidays.forEach((h: any) => {
      if (h.date) {
        const cleanDate = h.date.replace(',', '').replace(/\s+/g, ' ').toLowerCase().trim();
        holidaysMap.set(cleanDate, h.title);
      }
    });

    const queryFilter = employeeName !== 'ALL' ? { organizationId: orgId, employeeName } : { organizationId: orgId };
    const records = await AttendanceShiftLog.find(queryFilter).sort({ date: -1 });

    const calculateServerWorkingHours = (inTime: string, outTime: string, lunchBreakMinutes: number = 0): string => {
      if (!inTime || !outTime || inTime === '--:--' || outTime === '--:--' || inTime === 'ABSENT' || outTime === 'ABSENT' || inTime === 'OFF' || inTime === 'HOLIDAY' || inTime === 'CASUAL LEAVE') {
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

    const monthNameToIndex: { [key: string]: number } = {
      January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
      July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
    };

    const targetMonthIndex = monthNameToIndex[filterMonth] ?? new Date().getMonth();
    const targetYearNum = parseInt(filterYear, 10) || new Date().getFullYear();
    const totalDaysInMonth = new Date(targetYearNum, targetMonthIndex + 1, 0).getDate();
    const today = new Date();

    const targetEmployeesList = employeeName !== 'ALL' 
      ? allEmployees.filter(e => e.name.toLowerCase() === employeeName.toLowerCase())
      : allEmployees.filter(e => {
          const r = Array.isArray(e.role) ? e.role : [e.role || 'EMPLOYEE'];
          return !r.includes('ADMIN_VIEW');
        });

    const existingLogsMap = new Map<string, any>();
    records.forEach((log: any) => {
      if (log.date) {
        existingLogsMap.set(`${log.employeeIdReference}_${log.date}`, log);
      }
    });

    const allDaysMap = new Map<string, any>();

    for (const emp of targetEmployeesList) {
      let absentCounter = 0;
      const clLimit = emp.monthlyCasualLeaveLimit !== undefined ? Number(emp.monthlyCasualLeaveLimit) : 0;

      for (let day = 1; day <= totalDaysInMonth; day++) {
        const dateObj = new Date(targetYearNum, targetMonthIndex, day);
        if (dateObj > today) break; // 🌟 Strictly stop at today so future dates never show up in advance

        const formattedDateStr = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const dayOfWeekStr = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const cleanDateStr = formattedDateStr.replace(',', '').replace(/\s+/g, ' ').toLowerCase().trim();
        const holidayTitle = holidaysMap.get(cleanDateStr);
        const uniqueKey = `${emp.employeeId}_${formattedDateStr}`;

        if (existingLogsMap.has(uniqueKey)) {
          allDaysMap.set(uniqueKey, existingLogsMap.get(uniqueKey));
        } else if (dateObj.getDay() === 0) {
          allDaysMap.set(uniqueKey, {
            employeeName: emp.name,
            employeeIdReference: emp.employeeId,
            date: formattedDateStr,
            dayOfWeek: dayOfWeekStr,
            loginTime: 'OFF',
            logoutTime: 'OFF',
            locationInAddress: 'Non-Working Day',
            locationOutAddress: 'Non-Working Day',
            isSundayPlaceholder: true
          });
        } else if (holidayTitle) {
          allDaysMap.set(uniqueKey, {
            employeeName: emp.name,
            employeeIdReference: emp.employeeId,
            date: formattedDateStr,
            dayOfWeek: dayOfWeekStr,
            loginTime: 'HOLIDAY',
            logoutTime: 'HOLIDAY',
            locationInAddress: holidayTitle,
            locationOutAddress: holidayTitle,
            isHolidayPlaceholder: true,
            holidayTitle: holidayTitle
          });
        } else {
          absentCounter++;
          const isCl = absentCounter <= clLimit;
          allDaysMap.set(uniqueKey, {
            employeeName: emp.name,
            employeeIdReference: emp.employeeId,
            date: formattedDateStr,
            dayOfWeek: dayOfWeekStr,
            loginTime: isCl ? 'CASUAL LEAVE' : 'ABSENT',
            logoutTime: isCl ? 'CASUAL LEAVE' : 'ABSENT',
            locationInAddress: isCl ? 'Casual Leave' : 'Unexcused Absence',
            locationOutAddress: isCl ? 'Casual Leave' : 'Unexcused Absence',
            isCasualLeave: isCl
          });
        }
      }
    }

    const combinedRecords = Array.from(allDaysMap.values());
    combinedRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let presentCount = 0;
    let absentCount = 0;
    let clCount = 0;
    let holidayCount = 0;
    let sundayCount = 0;

    combinedRecords.forEach((log: any) => {
      const isSun = log.isSundayPlaceholder || log.dayOfWeek?.toLowerCase() === 'sunday' || new Date(log.date).getDay() === 0;
      if (isSun) {
        sundayCount++;
      } else if (log.isHolidayPlaceholder || log.loginTime === 'HOLIDAY') {
        holidayCount++;
      } else if (log.isCasualLeave || log.loginTime === 'CASUAL LEAVE') {
        clCount++;
      } else if (log.loginTime === 'ABSENT' || log.logoutTime === 'ABSENT') {
        absentCount++;
      } else if (log.loginTime && log.loginTime !== '--:--') {
        presentCount++;
      }
    });

    let csvData = `Attendance Report (${filterMonth} ${filterYear})\n`;
    csvData += `Employee Filter,${employeeName}\n`;
    csvData += `Total Days Present,${presentCount}\n`;
    csvData += `Total Days Absent,${absentCount}\n`;
    csvData += `Total Casual Leaves (CL),${clCount}\n`;
    csvData += `Total Company Holidays,${holidayCount}\n`;
    csvData += `Total Sundays / Weekend Offs,${sundayCount}\n\n`;
    csvData += "Employee Name,Employee ID,Date,Day of Week,Login Time,Logout Time,Punch In Location,Punch Out Location,Hours Worked\n";

    combinedRecords.forEach((row: any) => {
      const isSun = row.isSundayPlaceholder || row.dayOfWeek?.toLowerCase() === 'sunday';
      const empLunchMins = employeeLunchMap[row.employeeIdReference?.toUpperCase()] ?? employeeLunchMap[row.employeeName?.toLowerCase().trim()] ?? 0;
      const workingHours = isSun ? 'OFF' : calculateServerWorkingHours(row.loginTime, row.logoutTime, empLunchMins);
      const locIn = (row.locationInAddress || '').replace(/"/g, '""');
      const locOut = (row.locationOutAddress || '').replace(/"/g, '""');
      csvData += `"${row.employeeName}","${row.employeeIdReference || 'N/A'}","${row.date}","${row.dayOfWeek}","${row.loginTime}","${row.logoutTime}","${locIn}","${locOut}","${workingHours}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Attendance_Report_${filterMonth}_${filterYear}.csv`);
    return res.status(200).send(csvData);

  } catch (err) {
    return res.status(500).json({ success: false, message: "Spreadsheet compilation failure.", error: err });
  }
};

export const getOfficeLocations = async (req: Request, res: Response) => {
  try {
    const locations = await OfficeLocation.find({ organizationId: getOrgId(req) }).sort({ createdAt: -1 });
    return res.status(200).json(locations);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch locations', error: err.message });
  }
};

export const addOfficeLocation = async (req: Request, res: Response): Promise<any> => {
  const { name, latitude, longitude, radiusInMeters } = req.body;

  if (!name || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ success: false, message: 'Branch Name, Latitude, and Longitude are required.' });
  }

  try {
    const newLocation = new OfficeLocation({
      organizationId: getOrgId(req),
      name: name.trim(),
      latitude: Number(latitude),
      longitude: Number(longitude),
      radiusInMeters: radiusInMeters ? Number(radiusInMeters) : 50
    });

    await newLocation.save();
    return res.status(201).json({ success: true, message: 'Office location added successfully!', location: newLocation });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to add office location.', error: err.message });
  }
};

export const updateOfficeLocation = async (req: Request, res: Response): Promise<any> => {
  const targetId = String(req.params.id);
  const { name, latitude, longitude, radiusInMeters } = req.body;

  if (!targetId) {
    return res.status(400).json({ success: false, message: 'Missing location document reference identifier.' });
  }

  try {
    const updatePayload: any = {};
    if (name) updatePayload.name = name.trim();
    if (latitude !== undefined) updatePayload.latitude = Number(latitude);
    if (longitude !== undefined) updatePayload.longitude = Number(longitude);
    if (radiusInMeters !== undefined) updatePayload.radiusInMeters = Number(radiusInMeters);

    const updatedLocation = await OfficeLocation.findOneAndUpdate({ _id: targetId, organizationId: getOrgId(req) }, updatePayload, { new: true, runValidators: true });

    if (!updatedLocation) {
      return res.status(404).json({ success: false, message: 'Office location record not found.' });
    }

    return res.status(200).json({ success: true, message: 'Office location updated successfully!', location: updatedLocation });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to update office location.', error: err.message });
  }
};

export const deleteOfficeLocation = async (req: Request, res: Response): Promise<any> => {
  const targetId = String(req.params.id);

  try {
    const deletedLocation = await OfficeLocation.findOneAndDelete({ _id: targetId, organizationId: getOrgId(req) });
    if (!deletedLocation) {
      return res.status(404).json({ success: false, message: 'Location record not found.' });
    }
    return res.status(200).json({ success: true, message: 'Office location deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to delete location.', error: err.message });
  }
};

export const getHolidays = async (req: Request, res: Response) => {
  try {
    const holidays = await Holiday.find({ organizationId: getOrgId(req) }).sort({ createdAt: -1 });
    return res.status(200).json(holidays);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch holidays.', error: err.message });
  }
};

export const addHoliday = async (req: Request, res: Response): Promise<any> => {
  const { title, date, description } = req.body;

  if (!title || !date) {
    return res.status(400).json({ success: false, message: 'Holiday title and date are required.' });
  }

  try {
    const newHoliday = new Holiday({
      organizationId: getOrgId(req),
      title: title.trim(),
      date: date.trim(),
      description: description ? description.trim() : ''
    });

    await newHoliday.save();
    return res.status(201).json({ success: true, message: 'Holiday added successfully!', holiday: newHoliday });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to add holiday (Date might already exist).', error: err.message });
  }
};

export const deleteHoliday = async (req: Request, res: Response): Promise<any> => {
  const targetId = String(req.params.id);

  try {
    const deletedHoliday = await Holiday.findOneAndDelete({ _id: targetId, organizationId: getOrgId(req) });
    if (!deletedHoliday) {
      return res.status(404).json({ success: false, message: 'Holiday record not found.' });
    }
    return res.status(200).json({ success: true, message: 'Holiday removed successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to delete holiday.', error: err.message });
  }
};

export const bulkAddHolidays = async (req: Request, res: Response): Promise<any> => {
  const { holidays } = req.body;

  if (!Array.isArray(holidays) || holidays.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid or empty holiday payload.' });
  }

  try {
    const orgId = getOrgId(req);
    let insertedCount = 0;
    let skippedCount = 0;

    for (const item of holidays) {
      if (!item.title || !item.date) {
        skippedCount++;
        continue;
      }

      const cleanDate = String(item.date).trim();
      const existing = await Holiday.findOne({ organizationId: orgId, date: cleanDate });

      if (!existing) {
        await Holiday.create({
          organizationId: orgId,
          title: String(item.title).trim(),
          date: cleanDate,
          description: item.description ? String(item.description).trim() : ''
        });
        insertedCount++;
      } else {
        skippedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Successfully imported ${insertedCount} holidays. Skipped ${skippedCount} duplicates/invalid rows.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to process bulk holidays.', error: err.message });
  }
};

/* ------------------------------------------------------------------ *
 *  FACE ENROLLMENT  (POST /api/admin/enroll-face)
 *  body: { _id: string, photos: string[]  // data:image/jpeg;base64,... }
 *  Re-enrolling replaces the employee's previous faces.
 * ------------------------------------------------------------------ */
export const enrollFace = async (req: Request, res: Response): Promise<any> => {
  const { _id, photos } = req.body;

  if (!_id || !Array.isArray(photos) || photos.length === 0) {
    return res.status(400).json({ success: false, message: 'Employee reference and at least one photo are required.' });
  }
  if (photos.length > 5) {
    return res.status(400).json({ success: false, message: 'Maximum 5 photos allowed per enrollment.' });
  }

  try {
    const orgId = getOrgId(req);
    const employee = await RegisteredEmployee.findOne({ _id, organizationId: orgId });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee record not found.' });
    }

    const buffers = photos.map((p: string) => dataUriToBuffer(String(p)));
    const result = await enrollFaces(orgId, employee.employeeId, buffers);

    if (!result.success) {
      return res.status(422).json({ success: false, message: result.message });
    }

    // New faces are safely stored; now remove the old ones.
    const oldFaceIds = employee.faceIds || [];
    employee.faceIds = result.faceIds;
    employee.faceEnrolledAt = new Date();
    await employee.save();

    if (oldFaceIds.length > 0) {
      await deleteFaces(orgId, oldFaceIds).catch((e) => console.error('Old face cleanup failed:', e));
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      faceCount: result.faceIds.length,
      employee,
    });
  } catch (err: any) {
    console.error('enrollFace error:', err);
    return res.status(500).json({ success: false, message: err?.message || 'Face enrollment failed on the server.' });
  }
};

/* ------------------------------------------------------------------ *
 *  FACE REMOVAL  (DELETE /api/admin/face/:id)
 * ------------------------------------------------------------------ */
export const removeFace = async (req: Request, res: Response): Promise<any> => {
  try {
    const orgId = getOrgId(req);
    const employee = await RegisteredEmployee.findOne({ _id: String(req.params.id), organizationId: orgId });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee record not found.' });
    }

    await deleteFaces(orgId, employee.faceIds || []);
    employee.faceIds = [];
    employee.set('faceEnrolledAt', undefined);
    await employee.save();

    return res.status(200).json({ success: true, message: 'Face data removed.', employee });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Failed to remove face data.' });
  }
};