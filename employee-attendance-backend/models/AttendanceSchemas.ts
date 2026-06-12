import mongoose, { Schema } from 'mongoose';

// ----------------------------------------------------
// 1. CORE EMPLOYEE REGISTRY SCHEMA
// ----------------------------------------------------
const EmployeeProfileSchema = new Schema({
  name: { type: String, required: true },
  employeeId: { type: String, required: true, unique: true, uppercase: true, trim: true },
  designation: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }
}, { timestamps: true });

// ----------------------------------------------------
// 2. CHRONOLOGICAL ATTENDANCE SHIFT LOG SCHEMA
// ----------------------------------------------------
const ShiftLogSchema = new Schema({
  employeeIdReference: { type: String, required: true },
  employeeName: { type: String, required: true },
  date: { type: String, required: true },       
  dayOfWeek: { type: String, required: true },  
  loginTime: { type: String, default: '--:--' },
  logoutTime: { type: String, default: '--:--' },
  // 🚀 Split fields to store both punch snapshots at the same time
  capturedPhotoInUri: { type: String, default: '' }, 
  capturedPhotoOutUri: { type: String, default: '' } 
}, { timestamps: true });

// ----------------------------------------------------
// MODEL EXPORTS
// ----------------------------------------------------
export const RegisteredEmployee = mongoose.model('RegisteredEmployee', EmployeeProfileSchema);
export const AttendanceShiftLog = mongoose.model('AttendanceShiftLog', ShiftLogSchema);