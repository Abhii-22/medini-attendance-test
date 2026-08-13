import mongoose, { Schema, Document, Model } from 'mongoose';

// ----------------------------------------------------
// TypeScript Interfaces
// ----------------------------------------------------
export interface IEmployeeProfile extends Document {
  name: string;
  employeeId: string;
  designation: string;
  email: string;
  password?: string;
  role: string[];
  lunchBreakMinutes?: number; // 🍱 LUNCH BREAK MINUTES FIELD
}

export interface IAttendanceShiftLog extends Document {
  employeeIdReference: string;
  employeeName: string;
  date: string;
  dayOfWeek: string;
  loginTime: string;
  logoutTime: string;
  capturedPhotoInUri: string;
  capturedPhotoOutUri: string;
  locationInAddress: string;   
  locationOutAddress: string;  
}

export interface IAdminCredential extends Document {
  name: string;
  employeeId: string;
  designation: string;
  email: string;
  password?: string;
  role: string;
}

// ----------------------------------------------------
// 1. CORE EMPLOYEE REGISTRY SCHEMA
// ----------------------------------------------------
const EmployeeProfileSchema = new Schema<IEmployeeProfile>({
  name: { type: String, required: true },
  employeeId: { type: String, required: true, unique: true, uppercase: true, trim: true },
  designation: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: [String], default: ['EMPLOYEE'] },
  lunchBreakMinutes: { type: Number, default: 0 } // 🍱 MONGOOSE SCHEMA PROPERTY FOR LUNCH DURATION
}, { timestamps: true });

// ----------------------------------------------------
// 2. CHRONOLOGICAL ATTENDANCE SHIFT LOG SCHEMA
// ----------------------------------------------------
const ShiftLogSchema = new Schema<IAttendanceShiftLog>({
  employeeIdReference: { type: String, required: true },
  employeeName: { type: String, required: true },
  date: { type: String, required: true },       
  dayOfWeek: { type: String, required: true },  
  loginTime: { type: String, default: '--:--' },
  logoutTime: { type: String, default: '--:--' },
  capturedPhotoInUri: { type: String, default: '' }, 
  capturedPhotoOutUri: { type: String, default: '' },
  locationInAddress: { type: String, default: '' },
  locationOutAddress: { type: String, default: '' }
}, { timestamps: true });

// ----------------------------------------------------
// 3. MASTER ADMIN CREDENTIAL SCHEMA
// ----------------------------------------------------
const AdminCredentialSchema = new Schema<IAdminCredential>({
  name: { type: String, required: true },
  employeeId: { type: String, required: true, unique: true, uppercase: true, trim: true },
  designation: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, default: 'MASTER' }
}, { timestamps: true });

// ----------------------------------------------------
// MODEL EXPORTS
// ----------------------------------------------------
export const RegisteredEmployee = (mongoose.models.RegisteredEmployee || 
  mongoose.model<IEmployeeProfile>('RegisteredEmployee', EmployeeProfileSchema)) as Model<IEmployeeProfile>;

export const AttendanceShiftLog = (mongoose.models.AttendanceShiftLog || 
  mongoose.model<IAttendanceShiftLog>('AttendanceShiftLog', ShiftLogSchema)) as Model<IAttendanceShiftLog>;

export const AdminCredential = (mongoose.models.AdminCredential || 
  mongoose.model<IAdminCredential>('AdminCredential', AdminCredentialSchema)) as Model<IAdminCredential>;