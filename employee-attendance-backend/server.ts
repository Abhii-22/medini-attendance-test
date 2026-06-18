import express, { type Request, type Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
// 👑 FIXED IMPORT LAYER: Silenced strict compilation type helper checks for the natively bundled module
// @ts-ignore
import { v2 as cloudinary } from 'cloudinary'; 
// 📜 Imported the separate AdminCredential model safely from your updated schemas file
import { RegisteredEmployee, AttendanceShiftLog, AdminCredential } from './models/AttendanceSchemas.js'; 

dotenv.config();
const app = express();
app.use(cors());

// ⚙️ ENFORCED PAYLOAD LIMITS: Preserved to allow swift buffer processing loops
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 🛡️ CRITICAL NODE.JS v22 LOG PATCH: Forces the terminal engine to print readable stack traces instead of [Object: null prototype]
process.on('unhandledRejection', (reason: any) => {
  console.error('\n🛡️ Intercepted Background Rejection:');
  console.error(reason instanceof Error ? reason.stack : reason);
  console.error('=========================================\n');
});

// 🌐 CLOUDINARY CONFIGURATION BRIDGE
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dfd0kotgh',
  api_key: process.env.CLOUDINARY_API_KEY || '272929261371422',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'CSVbxl3UBIhBWkyTmKBqjputk-E', 
});

// ----------------------------------------------------
// 1. SEPARATED DATABASE-DRIVEN AUTHENTICATION ENDPOINT
// ----------------------------------------------------
app.post('/api/auth/login', async (req: Request, res: Response): Promise<any> => {
  const { email, password, loginMode } = req.body;

  try {
    const searchEmail = String(email).toLowerCase();

    // 👑 SEPARATED PATHWAY: If logging into an Admin Panel, check ONLY the AdminCredential collection
    if (loginMode === 'ADMIN_PANEL' || loginMode === 'ADMIN') {
      const adminProfile = await AdminCredential.findOne({ email: searchEmail });
      
      if (!adminProfile || adminProfile.password !== password) {
        return res.status(401).json({ success: false, message: 'No matching admin profile or incorrect password.' });
      }

      if (adminProfile.role === 'MASTER') {
        return res.status(200).json({ success: true, isAdmin: true, user: adminProfile });
      }
      return res.status(403).json({ success: false, message: 'This account lacks Master Admin privileges.' });
    }

    // 👤 & 👁️ STANDARD PATHWAY: Workforce maps to RegisteredEmployee collection
    const userProfile = await RegisteredEmployee.findOne({ email: searchEmail });
    
    if (!userProfile || userProfile.password !== password) {
      return res.status(401).json({ success: false, message: 'No matching profile or incorrect password.' });
    }

    const roleArray = Array.isArray(userProfile.role) 
      ? userProfile.role 
      : typeof userProfile.role === 'string' 
        ? [userProfile.role] 
        : ['EMPLOYEE'];

    if (loginMode === 'ADMIN_VIEW') {
      if (roleArray.includes('ADMIN_VIEW')) {
        return res.status(200).json({ success: true, isAdmin: true, user: userProfile });
      }
      return res.status(403).json({ success: false, message: 'This account lacks supervisor monitoring access privileges.' });
    }

    if (roleArray.includes('EMPLOYEE')) {
      return res.status(200).json({ success: true, isAdmin: false, user: userProfile });
    }
    
    return res.status(403).json({ success: false, message: 'Account context validation error.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err });
  }
});

// ------------------------------------------------------------------
// 2. COLLISION-PROOF ACCOUNT PROVISIONING WORKSPACE (UPSERT ENGINE)
// ------------------------------------------------------------------
app.post('/api/admin/register-employee', async (req: Request, res: Response): Promise<any> => {
  const { email, employeeId, name, designation, password, role } = req.body;

  // 🛡️ FRONTEND SANITY Safeguard: Explicitly block requests missing required input data fields
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
      // 🌟 MULTI-ROLE INTERCEPTOR ENGINE: If they exist as an employee and you assign them to ADMIN_VIEW
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

    // 🆔 UNIQUE INDEX CHECK: Ensure Employee ID codes are unique across the collection database
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
      role: [targetRole] // Matches array string schema mapping natively
    });

    await newEmployee.save();
    return res.status(201).json({ success: true, message: 'Employee profile deployed successfully!', employee: newEmployee });

  } catch (err: any) {
    console.error("MongoDB Core Registration Failure Context:", err);
    return res.status(500).json({ success: false, message: `Database schema execution conflict: ${err.message || 'Check structural field properties.'}` });
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
    const filePrefixYear = filterYear || new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric' });

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
        if (permanentCloudUrl) dayLog.set('capturedPhotoInUri', permanentCloudUrl); 
      } else {
        dayLog.logoutTime = formattedTime;
        if (permanentCloudUrl) dayLog.set('capturedPhotoOutUri', permanentCloudUrl); 
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
        capturedPhotoOutUri: type === 'LOGOUT' ? (permanentCloudUrl || '') : ''
      });
      await dayLog.save();
    }
    return res.status(200).json({ success: true, data: dayLog });
  } catch (err: any) {
    console.error("Backend exception caught during submission logic:", err.message || err);
    return res.status(500).json({ success: false, message: 'Cloud deployment handshake error.', error: err.message || err });
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
      console.error('\n❌ CRITICAL DATABASE INITIALIZATION ERROR DETECTED:');
      console.error('================================================================');
      console.error(err.message || err);
      console.error('================================================================\n');
    });
}

bootServerEngine();