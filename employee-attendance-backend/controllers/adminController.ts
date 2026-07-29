import type { Request, Response } from 'express';
import { RegisteredEmployee, AttendanceShiftLog } from '../models/AttendanceSchemas.js';

export const registerEmployee = async (req: Request, res: Response): Promise<any> => {
  const { email, employeeId, name, designation, password, role } = req.body;

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

    const newEmployee = new RegisteredEmployee({
      name: name.trim(),
      employeeId: searchId,
      designation: (designation || 'Staff').trim(), 
      email: searchEmail,
      password: password, 
      role: [targetRole]
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
  const { _id, name, designation, email, password, role } = req.body;

  if (!_id) {
    return res.status(400).json({ success: false, message: "Missing document reference identifier." });
  }

  try {
    const updatePayload: any = {
      name: name.trim(),
      designation: designation.trim(),
      email: email.trim().toLowerCase(),
      password: password
    };

    if (role) {
      updatePayload.role = [role];
    }

    const updatedEmployee = await RegisteredEmployee.findByIdAndUpdate(_id, updatePayload, { new: true });

    if (!updatedEmployee) {
      return res.status(404).json({ success: false, message: "Target workspace record could not be found." });
    }

    return res.status(200).json({ success: true, employee: updatedEmployee });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: "Email assignment already in active use.", error: err });
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

export const getAttendanceSheet = async (req: Request, res: Response) => {
  const employeeName = req.query.employeeName ? String(req.query.employeeName) : 'ALL';
  const filter = employeeName !== 'ALL' ? { employeeName } : {};
  
  const sheets = await AttendanceShiftLog.find(filter).sort({ createdAt: -1 });
  res.status(200).json(sheets);
};

export const downloadAttendance = async (req: Request, res: Response): Promise<any> => {
  try {
    const employeeName = req.query.employeeName ? String(req.query.employeeName) : 'ALL';
    const filterMonth = req.query.month ? String(req.query.month) : '';
    const filterYear = req.query.year ? String(req.query.year) : '';

    const queryFilter = employeeName !== 'ALL' ? { employeeName } : {};
    const records = await AttendanceShiftLog.find(queryFilter).sort({ date: -1 });

    const calculateServerWorkingHours = (inTime: string, outTime: string): string => {
      if (!inTime || !outTime || inTime === '--:--' || outTime === '--:--' || inTime === 'ABSENT' || outTime === 'ABSENT') {
        return '--';
      }
      try {
        const parseTimeToMinutes = (timeStr: string) => {
          const parts = timeStr.split(' ');
          const timePart = parts[0] || '0:0';
          const modifier = parts[1] || 'AM';

          const timeSplit = timePart.split(':');
          let hours = Number(timeSplit[0]) || 0;
          const minutes = Number(timeSplit[1]) || 0;

          if (modifier === 'PM' && hours < 12) hours += 12;
          if (modifier === 'AM' && hours === 12) hours = 0;
          return hours * 60 + minutes;
        };

        const diffInMinutes = parseTimeToMinutes(outTime) - parseTimeToMinutes(inTime);
        if (diffInMinutes <= 0) return '0h 0m';

        return `${Math.floor(diffInMinutes / 60)}h ${diffInMinutes % 60}m`;
      } catch (e) {
        return '--';
      }
    };

    const filteredRecords = records.filter((log: any) => {
      if (!log.date) return false;
      const logDateLower = log.date.toLowerCase();
      const matchesMonth = filterMonth ? logDateLower.includes(filterMonth.toLowerCase()) : true;
      const matchesYear = filterYear ? logDateLower.includes(filterYear) : true;
      return matchesMonth && matchesYear;
    });

    let csvData = "Employee Name,Employee ID,Date,Day of Week,Login Time,Logout Time,Punch In Location,Punch Out Location,Hours Worked\n";

    filteredRecords.forEach((row: any) => {
      const workingHours = calculateServerWorkingHours(row.loginTime, row.logoutTime);
      const locIn = (row.get('locationInAddress') || '').replace(/"/g, '""');
      const locOut = (row.get('locationOutAddress') || '').replace(/"/g, '""');
      csvData += `"${row.employeeName}","${row.employeeIdReference}","${row.date}","${row.dayOfWeek}","${row.loginTime}","${row.logoutTime}","${locIn}","${locOut}","${workingHours}"\n`;
    });

    const filePrefixMonth = filterMonth || 'Global';
    const filePrefixYear = filterYear || new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric' });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Attendance_Report_${filePrefixMonth}_${filePrefixYear}.csv`);
    return res.status(200).send(csvData);

  } catch (err) {
    return res.status(500).json({ success: false, message: "Spreadsheet compilation failure.", error: err });
  }
};