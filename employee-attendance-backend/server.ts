import express, { type Request, type Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { RegisteredEmployee, AttendanceShiftLog } from './models/AttendanceSchemas.js'; // ES Module extension compliance

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// ----------------------------------------------------
// 1. GATEWAY AUTHENTICATION ENDPOINT
// ----------------------------------------------------
app.post('/api/auth/login', async (req: Request, res: Response): Promise<any> => {
  const { email, password, loginMode } = req.body;

  // Hardcoded Administrative Access Layer
  if (loginMode === 'ADMIN') {
    if (String(email).toLowerCase() === 'admin@medini.com' && String(password) === 'Admin@2026') {
      return res.status(200).json({ success: true, isAdmin: true, user: { name: 'System Admin', email } });
    }
    return res.status(401).json({ success: false, message: 'Invalid Admin security credentials.' });
  }

  // Dynamic Employee Verification Layer
  try {
    const employee = await RegisteredEmployee.findOne({ email: String(email).toLowerCase() });
    if (employee && employee.password === password) {
      return res.status(200).json({ success: true, isAdmin: false, user: employee });
    }
    return res.status(401).json({ success: false, message: 'No matching employee profile found.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err });
  }
});

// ----------------------------------------------------
// 2. ADMIN PORTAL DIRECTORY ACTIONS
// ----------------------------------------------------

// Register a brand new worker profile
app.post('/api/admin/register-employee', async (req: Request, res: Response): Promise<any> => {
  try {
    const newEmployee = new RegisteredEmployee(req.body);
    await newEmployee.save();
    return res.status(201).json({ success: true, employee: newEmployee });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: 'Employee ID or Email already exists.', error: err });
  }
});

// Fetch active company registry directory
app.get('/api/admin/employees', async (req: Request, res: Response) => {
  const list = await RegisteredEmployee.find().sort({ createdAt: -1 });
  res.status(200).json(list);
});

// Fetch attendance logs cleanly filtered by specific employee identity strings
app.get('/api/admin/attendance-sheet', async (req: Request, res: Response) => {
  const employeeName = req.query.employeeName ? String(req.query.employeeName) : 'ALL';
  const filter = employeeName !== 'ALL' ? { employeeName } : {};
  
  const sheets = await AttendanceShiftLog.find(filter).sort({ createdAt: -1 });
  res.status(200).json(sheets);
});

// ----------------------------------------------------
// 3. TARGETED ATTENDANCE CSV COMPILER & DOWNLOADER
// ----------------------------------------------------
app.get('/api/admin/download-attendance', async (req: Request, res: Response) => {
  const employeeName = req.query.employeeName ? String(req.query.employeeName) : 'ALL';
  const filter = employeeName !== 'ALL' ? { employeeName } : {};
  
  const records = await AttendanceShiftLog.find(filter).sort({ createdAt: -1 });
  
  // Assemble structural spreadsheet columns
  let csvData = "Employee Name,Employee ID,Date,Day of Week,Login Time,Logout Time\n";
  records.forEach(row => {
    csvData += `"${row.employeeName}","${row.employeeIdReference}","${row.date}","${row.dayOfWeek}","${row.loginTime}","${row.logoutTime}"\n`;
  });

  // Force systems to execute an immediate file download
  const timestamp = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=Employee_Attendance_Report_${timestamp}.csv`);
  res.status(200).send(csvData);
});

// ----------------------------------------------------
// 4. MOBILE CLIENT SHIFT PUNCH EVENTS (WITH ABSENT SUPPORT)
// ----------------------------------------------------
app.post('/api/attendance/punch-clock', async (req: Request, res: Response): Promise<any> => {
  const { employeeId, name, type } = req.body;
  
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const formattedDay = now.toLocaleDateString('en-US', { weekday: 'long' });
  const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  try {
    let dayLog = await AttendanceShiftLog.findOne({ employeeIdReference: String(employeeId), date: formattedDate });

    // Handle full-day Absence designation override
    if (type === 'ABSENT') {
      if (dayLog) {
        dayLog.loginTime = 'ABSENT';
        dayLog.logoutTime = 'ABSENT';
        await dayLog.save();
      } else {
        dayLog = new AttendanceShiftLog({
          employeeIdReference: employeeId,
          employeeName: name,
          date: formattedDate,
          dayOfWeek: formattedDay,
          loginTime: 'ABSENT',
          logoutTime: 'ABSENT'
        });
        await dayLog.save();
      }
      return res.status(200).json({ success: true, data: dayLog });
    }

    // Standard In/Out Clock Management
    if (dayLog) {
      if (type === 'LOGIN') dayLog.loginTime = formattedTime;
      else dayLog.logoutTime = formattedTime;
      await dayLog.save();
    } else {
      dayLog = new AttendanceShiftLog({
        employeeIdReference: employeeId,
        employeeName: name,
        date: formattedDate,
        dayOfWeek: formattedDay,
        loginTime: type === 'LOGIN' ? formattedTime : '--:--',
        logoutTime: type === 'LOGOUT' ? formattedTime : '--:--'
      });
      await dayLog.save();
    }
    return res.status(200).json({ success: true, data: dayLog });
  } catch (err) {
    return res.status(500).json({ success: false, error: err });
  }
});

// ----------------------------------------------------
// 5. EMPLOYEE PROFILE UPDATE PORTAL
// ----------------------------------------------------
app.patch('/api/employee/update-profile', async (req: Request, res: Response): Promise<any> => {
  const { employeeId, name, designation, email } = req.body;

  if (!employeeId) {
    return res.status(400).json({ success: false, message: 'Employee reference parameter missing.' });
  }

  try {
    // Finds worker by their unchangeable unique ID string and updates fields
    const updatedEmployee = await RegisteredEmployee.findOneAndUpdate(
      { employeeId: String(employeeId).toUpperCase() },
      { 
        name: name.trim(), 
        designation: designation.trim(), 
        email: email.trim().toLowerCase() 
      },
      { new: true } // Returns the brand new edited document from the cloud database
    );

    if (!updatedEmployee) {
      return res.status(404).json({ success: false, message: 'Employee profile could not be found.' });
    }

    return res.status(200).json({ success: true, user: updatedEmployee });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to update cloud profile database.', error: err });
  }
});

// ----------------------------------------------------
// DATABASE & SERVER ENGINE LIFECYCLE MANAGEMENT
// ----------------------------------------------------
const ATLAST_MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/employeeAttendanceSystem';

mongoose.connect(ATLAST_MONGO_URI)
  .then(() => {
    console.log('Attendance System Cloud Database Connected 🌐📜');
    app.listen(5000, () => console.log('Attendance Server Live On Port 5000 🚀'));
  })
  .catch(err => console.error('Database connection error:', err));