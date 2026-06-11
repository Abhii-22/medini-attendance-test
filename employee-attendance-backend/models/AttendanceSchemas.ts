import mongoose, { Schema } from 'mongoose';

const EmployeeProfileSchema = new Schema({
  name: { type: String, required: true },
  employeeId: { type: String, required: true, unique: true, uppercase: true, trim: true },
  designation: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }
}, { timestamps: true });

const ShiftLogSchema = new Schema({
  employeeIdReference: { type: String, required: true },
  employeeName: { type: String, required: true },
  date: { type: String, required: true },       
  dayOfWeek: { type: String, required: true },  
  loginTime: { type: String, default: '--:--' },
  logoutTime: { type: String, default: '--:--' }
}, { timestamps: true });

export const RegisteredEmployee = mongoose.model('RegisteredEmployee', EmployeeProfileSchema);
export const AttendanceShiftLog = mongoose.model('AttendanceShiftLog', ShiftLogSchema);