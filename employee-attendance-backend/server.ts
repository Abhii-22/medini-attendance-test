import express, { type Request, type Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { RegisteredEmployee, AttendanceShiftLog } from './models/AttendanceSchemas.js'; 

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

process.on('unhandledRejection', (reason) => {
  console.error('🛡️ Intercepted Thread Rejection:', reason);
});

// ----------------------------------------------------
// 1. FIXED MULTI-ROLE GATEWAY AUTHENTICATION ENDPOINT
// ----------------------------------------------------
app.post('/api/auth/login', async (req: Request, res: Response): Promise<any> => {
  const { email, password, loginMode } = req.body;

  // 👑 MASTER CODENAME PRIVILEGE BYPASSER (Super Admin Key Only)
  if (loginMode === 'ADMIN_PANEL' || loginMode === 'ADMIN') {
    if (String(email).toLowerCase() === 'admin@medini.com' && String(password) === 'Admin@2026') {
      return res.status(200).json({ success: true, isAdmin: true, user: { name: 'System Admin', email, role: 'MASTER' } });
    }
    return res.status(401).json({ success: false, message: 'Invalid Super Admin master credentials.' });
  }

  // 👤 & 👁️ DATABASE LOOKUP PATHWAY FOR EMPLOYEES AND SUPERVISORS
  try {
    const userProfile = await RegisteredEmployee.findOne({ email: String(email).toLowerCase() });
    
    if (!userProfile || userProfile.password !== password) {
      return res.status(401).json({ success: false, message: 'No matching profile or incorrect password.' });
    }

    // 👁️ ADMIN VIEW LOGINS READ DIRECTLY FROM DATABASE CLUSTER CREATED BY MASTER
    if (loginMode === 'ADMIN_VIEW') {
      if (userProfile.role === 'ADMIN_VIEW') {
        return res.status(200).json({ success: true, isAdmin: true, user: userProfile });
      }
      return res.status(403).json({ success: false, message: 'This account lacks supervisor monitoring access privileges.' });
    }

    // Standard employee validation path
    return res.status(200).json({ success: true, isAdmin: false, user: userProfile });
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
  const { _id, name, designation, email, password, role } = req.body;

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
        password: password,
        role: role || 'EMPLOYEE'
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

// ----------------------------------------------------------------------
// 3. EXCEL/CSV SHEET STREAM WITH DYNAMIC MONTH, YEAR & WORKING HOURS
// ----------------------------------------------------------------------
app.get('/api/admin/download-attendance', async (req: Request, res: Response): Promise<any> => {
  try {
    const employeeName = req.query.employeeName ? String(req.query.employeeName) : 'ALL';
    const filterMonth = req.query.month ? String(req.query.month) : '';
    const filterYear = req.query.year ? String(req.query.year) : '';

    const queryFilter = employeeName !== 'ALL' ? { employeeName } : {};
    const records = await AttendanceShiftLog.find(queryFilter).sort({ date: -1 });

    // ⏱️ STABLE PARSING LOGIC WITH TYPESAFE ARRAY BOUNDARY CHECKS
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

    let csvData = "Employee Name,Employee ID,Date,Day of Week,Login Time,Logout Time,Hours Worked\n";

    filteredRecords.forEach(row => {
      const workingHours = calculateServerWorkingHours(row.loginTime, row.logoutTime);
      csvData += `"${row.employeeName}","${row.employeeIdReference}","${row.date}","${row.dayOfWeek}","${row.loginTime}","${row.logoutTime}","${workingHours}"\n`;
    });

    const filePrefixMonth = filterMonth || 'Global';
    const filePrefixYear = filterYear || new Date().getFullYear().toString();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Attendance_Report_${filePrefixMonth}_${filePrefixYear}.csv`);
    return res.status(200).send(csvData);

  } catch (err) {
    return res.status(500).json({ success: false, message: "Spreadsheet compilation failure.", error: err });
  }
});

// ----------------------------------------------------
// 4. BIOMETRIC HARDWARE CLOCK-PUNCH HANDSHAKES
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
        if (photoUri) dayLog.set('capturedPhotoOutUri', photoUri); 
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

app.patch('/api/employee/update-profile', async (req: Request, res: Response): Promise<any> => {
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
});

// ----------------------------------------------------
// 5. SECURE ENFORCED ENGINE INITIALIZATION BLOCK
// ----------------------------------------------------
const ATLAST_MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/employeeAttendanceSystem';

async function bootServerEngine() {
  console.log('Connecting to cloud cluster... ⏳');
  
  await mongoose.connect(ATLAST_MONGO_URI)
    .then(() => {
      console.log('Attendance System Cloud Database Connected 🌐📜');
      app.listen(5000, () => console.log('Attendance Server Live On Port 5000 🚀'));
    })
    .catch((err) => {
      console.error('\n❌ CRITICAL INITIALIZATION ERROR DETECTED ON SYSTEM ROOT:');
      console.error('================================================================');
      console.error(err);
      console.error('================================================================\n');
    });
}

bootServerEngine();