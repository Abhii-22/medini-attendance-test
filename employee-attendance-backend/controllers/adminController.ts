import type { Request, Response } from 'express';
import { RegisteredEmployee, AttendanceShiftLog, OfficeLocation, Holiday } from '../models/AttendanceSchemas.js';

export const registerEmployee = async (req: Request, res: Response): Promise<any> => {
  const { email, employeeId, name, designation, password, role, lunchBreakMinutes, monthlyCasualLeaveLimit } = req.body;

  if (!email || !employeeId || !name || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Registration Denied: Full Name, Employee ID, Email, and Password fields cannot be left empty.' 
    });
  }

  try {
    const searchEmail = String(email).trim().toLowerCase();
    const searchId = String(employeeId).trim().toUpperCase();
    const targetRole = role || 'EMPLOYEE';

    const existingUser = await RegisteredEmployee.findOne({ email: searchEmail });

    if (existingUser) {
      if (targetRole === 'ADMIN_VIEW') {
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

    const existingId = await RegisteredEmployee.findOne({ employeeId: searchId });
    if (existingId) {
      return res.status(400).json({ success: false, message: 'Registration Denied: This Employee ID is already assigned to a staff profile.' });
    }

    const parsedLunchMinutes = lunchBreakMinutes !== undefined && lunchBreakMinutes !== null ? Number(lunchBreakMinutes) : 0;
    const parsedClLimit = monthlyCasualLeaveLimit !== undefined && monthlyCasualLeaveLimit !== null ? Number(monthlyCasualLeaveLimit) : 0;

    const newEmployee = new RegisteredEmployee({
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

export const getEmployees = async (_req: Request, res: Response) => {
  const list = await RegisteredEmployee.find().sort({ createdAt: -1 });
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

    const updatedEmployee = await RegisteredEmployee.findByIdAndUpdate(_id, updatePayload, { new: true, runValidators: true });

    if (!updatedEmployee) {
      return res.status(404).json({ success: false, message: "Target workspace record could not be found." });
    }

    return res.status(200).json({ success: true, employee: updatedEmployee });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: "Failed to update employee profile.", error: err.message || err });
  }
};

export const deleteEmployee = async (req: Request, res: Response): Promise<any> => {
  const targetMongoId = req.params.id;

  try {
    const employeeRecord = await RegisteredEmployee.findById(targetMongoId);
    if (!employeeRecord) {
      return res.status(404).json({ success: false, message: "Profile record not active in registry directory." });
    }

    await AttendanceShiftLog.deleteMany({ employeeIdReference: employeeRecord.employeeId });
    await RegisteredEmployee.findByIdAndDelete(targetMongoId);

    return res.status(200).json({ success: true, message: "Profile data and chronological logs purged cleanly." });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to isolate cluster document targets.", error: err });
  }
};

export const getAttendanceSheet = async (req: Request, res: Response): Promise<any> => {
  try {
    const employeeName = req.query.employeeName ? String(req.query.employeeName) : 'ALL';
    const filter = employeeName !== 'ALL' ? { employeeName } : {};
    
    const sheets = await AttendanceShiftLog.find(filter).sort({ createdAt: -1 });

    const allHolidays = await Holiday.find({});
    const holidaysMap = new Map<string, string>();
    allHolidays.forEach((h: any) => {
      if (h.date) {
        const cleanDate = h.date.replace(',', '').replace(/\s+/g, ' ').toLowerCase().trim();
        holidaysMap.set(cleanDate, h.title);
      }
    });

    const allEmployees = await RegisteredEmployee.find();
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

    for (const emp of targetEmployees) {
      let absentCounterForMonth = 0;
      const empAny = emp as any;
      const monthlyClLimit = empAny.monthlyCasualLeaveLimit !== undefined ? Number(empAny.monthlyCasualLeaveLimit) : 0;

      for (let day = 1; day < todayDateNum; day++) {
        const dateObj = new Date(currentYear, currentMonth, day);
        if (dateObj > now) break; // 🌟 Strictly stop at today
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
            absentCounterForMonth++;
            const isCl = absentCounterForMonth <= monthlyClLimit;

            newlyDetectedLogs.push({
              _id: `${isCl ? 'cl' : 'absent'}-${emp.employeeId}-${formattedDateStr}`,
              employeeIdReference: emp.employeeId,
              employeeName: emp.name,
              date: formattedDateStr,
              dayOfWeek: dayOfWeekStr,
              loginTime: isCl ? 'CASUAL LEAVE' : 'ABSENT',
              logoutTime: isCl ? 'CASUAL LEAVE' : 'ABSENT',
              capturedPhotoInUri: '',
              capturedPhotoOutUri: '',
              locationInAddress: '',
              locationOutAddress: '',
              isVirtualAbsent: !isCl,
              isCasualLeave: isCl,
              holidayTitle: isCl ? 'Casual Leave (CL)' : undefined
            });
          }
        }
      }
    }

    const combined = [...sheets, ...newlyDetectedLogs];
    combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return res.status(200).json(combined);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to compile attendance sheet.', error: err.message });
  }
};

export const downloadAttendance = async (req: Request, res: Response): Promise<any> => {
  try {
    const employeeName = req.query.employeeName ? String(req.query.employeeName) : 'ALL';
    const filterMonth = req.query.month ? String(req.query.month) : new Date().toLocaleString('en-US', { month: 'long' });
    const filterYear = req.query.year ? String(req.query.year) : new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric' });

    const allEmployees = await RegisteredEmployee.find({});
    const employeeLunchMap: { [key: string]: number } = {};

    allEmployees.forEach((emp: any) => {
      if (emp.employeeId) {
        employeeLunchMap[emp.employeeId.toUpperCase()] = emp.lunchBreakMinutes || 0;
      }
      if (emp.name) {
        employeeLunchMap[emp.name.toLowerCase().trim()] = emp.lunchBreakMinutes || 0;
      }
    });

    const allHolidays = await Holiday.find({});
    const holidaysMap = new Map<string, string>();
    allHolidays.forEach((h: any) => {
      if (h.date) {
        const cleanDate = h.date.replace(',', '').replace(/\s+/g, ' ').toLowerCase().trim();
        holidaysMap.set(cleanDate, h.title);
      }
    });

    const queryFilter = employeeName !== 'ALL' ? { employeeName } : {};
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

export const getOfficeLocations = async (_req: Request, res: Response) => {
  try {
    const locations = await OfficeLocation.find().sort({ createdAt: -1 });
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
  const targetId = req.params.id;
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

    const updatedLocation = await OfficeLocation.findByIdAndUpdate(targetId, updatePayload, { new: true, runValidators: true });

    if (!updatedLocation) {
      return res.status(404).json({ success: false, message: 'Office location record not found.' });
    }

    return res.status(200).json({ success: true, message: 'Office location updated successfully!', location: updatedLocation });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to update office location.', error: err.message });
  }
};

export const deleteOfficeLocation = async (req: Request, res: Response): Promise<any> => {
  const targetId = req.params.id;

  try {
    const deletedLocation = await OfficeLocation.findByIdAndDelete(targetId);
    if (!deletedLocation) {
      return res.status(404).json({ success: false, message: 'Location record not found.' });
    }
    return res.status(200).json({ success: true, message: 'Office location deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to delete location.', error: err.message });
  }
};

export const getHolidays = async (_req: Request, res: Response) => {
  try {
    const holidays = await Holiday.find().sort({ createdAt: -1 });
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
  const targetId = req.params.id;

  try {
    const deletedHoliday = await Holiday.findByIdAndDelete(targetId);
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
    let insertedCount = 0;
    let skippedCount = 0;

    for (const item of holidays) {
      if (!item.title || !item.date) {
        skippedCount++;
        continue;
      }

      const cleanDate = String(item.date).trim();
      const existing = await Holiday.findOne({ date: cleanDate });

      if (!existing) {
        await Holiday.create({
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