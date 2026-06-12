import express, { type Request, type Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { RegisteredEmployee, AttendanceShiftLog } from './models/AttendanceSchemas.js'; // ES Module extension compliance

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Explicitly register a global unhandled rejection interceptor to avoid thread drops
process.on('unhandledRejection', (reason) => {
  console.error('🛡️ Intercepted Thread Rejection:', reason);
});

// ----------------------------------------------------
// 1. GATEWAY AUTHENTICATION ENDPOINT
// ----------------------------------------------------
app.post('/api/auth/login', async (req: Request, res: Response): Promise<any> => {
  const { email, password, loginMode } = req.body;

  if (loginMode === 'ADMIN') {
    if (String(email).toLowerCase() === 'admin@medini.com' && String(password) === 'Admin@2026') {
      return res.status(200).json({ success: true, isAdmin: true, user: { name: 'System Admin', email } });
    }
    return res.status(401).json({ success: false, message: 'Invalid Admin security credentials.' });
  }

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
// 2. ADMIN PORTAL DIRECTORY ACTIONS (CRUD INTEGRATED)
// ----------------------------------------------------
app.post('/api/admin/register-employee', async (req: Request, res: Response): Promise<any> => {
  try {
    const newEmployee = new RegisteredEmployee(req.body);
    await newEmployee.save();
    return res.status(201).json({ success: true, employee: newEmployee });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: 'Employee ID or Email already exists.', error: err });
  }
});

app.get('/api/admin/employees', async (req: Request, res: Response) => {
  const list = await RegisteredEmployee.find().sort({ createdAt: -1 });
  res.status(200).json(list);
});

app.put('/api/admin/update-employee', async (req: Request, res: Response): Promise<any> => {
  const { _id, name, designation, email, password } = req.body;

  if (!_id) {
    return res.status(400).json({ success: false, message: "Missing document reference identifier." });
  }

  try {
    const updatedEmployee = await RegisteredEmployee.findByIdAndUpdate(
      _id,
      {
        name: name.trim(),
        designation: designation.trim(),
        email: email.trim().toLowerCase(),
        password: password
      },
      { new: true }
    );

    if (!updatedEmployee) {
      return res.status(404).json({ success: false, message: "Target workspace record could not be found." });
    }

    return res.status(200).json({ success: true, employee: updatedEmployee });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: "Email assignment already in active use.", error: err });
  }
});

app.delete('/api/admin/delete-employee/:id', async (req: Request, res: Response): Promise<any> => {
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
});

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
  
  let csvData = "Employee Name,Employee ID,Date,Day of Week,Login Time,Logout Time\n";
  records.forEach(row => {
    csvData += `"${row.employeeName}","${row.employeeIdReference}","${row.date}","${row.dayOfWeek}","${row.loginTime}","${row.logoutTime}"\n`;
  });

  const timestamp = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=Employee_Attendance_Report_${timestamp}.csv`);
  res.status(200).send(csvData);
});

// ----------------------------------------------------
// 4. MOBILE CLIENT SHIFT PUNCH EVENTS (WITH DUAL PHOTO SLOTS)
// ----------------------------------------------------
app.post('/api/attendance/punch-clock', async (req: Request, res: Response): Promise<any> => {
  const { employeeId, name, type, photoUri } = req.body; 
  
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const formattedDay = now.toLocaleDateString('en-US', { weekday: 'long' });
  const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  try {
    let dayLog = await AttendanceShiftLog.findOne({ employeeIdReference: String(employeeId), date: formattedDate });

    if (type === 'ABSENT') {
      if (dayLog) {
        dayLog.loginTime = 'ABSENT';
        dayLog.logoutTime = 'ABSENT';
        dayLog.set('capturedPhotoInUri', ''); 
        dayLog.set('capturedPhotoOutUri', ''); 
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
          capturedPhotoOutUri: ''
        });
        await dayLog.save();
      }
      return res.status(200).json({ success: true, data: dayLog });
    }

    if (dayLog) {
      if (type === 'LOGIN') {
        dayLog.loginTime = formattedTime;
        if (photoUri) dayLog.set('capturedPhotoInUri', photoUri); 
      } else {
        dayLog.logoutTime = formattedTime;
        if (photoUri) dayLog.set('capturedPhotoOutUri', photoUri); // Targets out field securely
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
        capturedPhotoInUri: type === 'LOGIN' ? (photoUri || '') : '',
        capturedPhotoOutUri: type === 'LOGOUT' ? (photoUri || '') : ''
      });
      await dayLog.save();
    }
    return res.status(200).json({ success: true, data: dayLog });
  } catch (err) {
    return res.status(500).json({ success: false, error: err });
  }
});

// ----------------------------------------------------
// 5. EMPLOYEE PROFILE UPDATE PORTAL (READ-ONLY GATEWAY LINK)
// ----------------------------------------------------
app.patch('/api/employee/update-profile', async (req: Request, res: Response): Promise<any> => {
  const { employeeId, name, designation, email } = req.body;

  if (!employeeId) {
    return res.status(400).json({ success: false, message: 'Employee reference parameter missing.' });
  }

  try {
    const updatedEmployee = await RegisteredEmployee.findOneAndUpdate(
      { employeeId: String(employeeId).toUpperCase() },
      { 
        name: name.trim(), 
        designation: designation.trim(), 
        email: email.trim().toLowerCase() 
      },
      { new: true }
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

async function bootServerEngine() {
  try {
    console.log('Connecting to cloud cluster... ⏳');
    await mongoose.connect(ATLAST_MONGO_URI);
    console.log('Attendance System Cloud Database Connected 🌐📜');
    
    app.listen(5000, () => {
      console.log('Attendance Server Live On Port 5000 🚀');
    });
  } catch (err) {
    console.error('❌ Critical Server Initialization Failure:', err);
    process.exit(1);
  }
}

bootServerEngine();