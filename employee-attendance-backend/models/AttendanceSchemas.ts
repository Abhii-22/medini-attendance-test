import mongoose, { Schema, Document, Model } from 'mongoose';

// ----------------------------------------------------
// TypeScript Interfaces
// ----------------------------------------------------
export interface IOrganization extends Document {
  name: string;
  adminName: string;
  email: string;
  phone: string;
  faceCollectionId: string; // each organization has its own AWS Rekognition collection
  isLegacy?: boolean;
}

export interface IEmployeeProfile extends Document {
  organizationId: string;
  name: string;
  employeeId: string;
  designation: string;
  email: string;
  password?: string;
  role: string[];
  lunchBreakMinutes?: number; 
  monthlyCasualLeaveLimit?: number; 
  faceIds?: string[];        // AWS Rekognition FaceIds enrolled for this employee
  faceEnrolledAt?: Date;
}

export interface IAttendanceShiftLog extends Document {
  organizationId: string;
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
  faceMatchInScore?: number | null;   // Rekognition similarity at punch-in
  faceMatchOutScore?: number | null;  // Rekognition similarity at punch-out
}

export interface IAdminCredential extends Document {
  organizationId: string;
  phone?: string;
  name: string;
  employeeId: string;
  designation: string;
  email: string;
  password?: string;
  role: string;
}

export interface IOfficeLocation extends Document {
  organizationId: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusInMeters: number;
}

export interface IHoliday extends Document {
  organizationId: string;
  title: string;
  date: string; // e.g., "August 15, 2026"
  description?: string;
}

// ----------------------------------------------------
// 0. ORGANIZATION (TENANT) SCHEMA
// ----------------------------------------------------
const OrganizationSchema = new Schema<IOrganization>({
  name: { type: String, required: true, trim: true },
  adminName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, default: '' },
  faceCollectionId: { type: String, required: true },
  isLegacy: { type: Boolean, default: false }
}, { timestamps: true });

// ----------------------------------------------------
// 1. CORE EMPLOYEE REGISTRY SCHEMA
// ----------------------------------------------------
const EmployeeProfileSchema = new Schema<IEmployeeProfile>({
  organizationId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  employeeId: { type: String, required: true, uppercase: true, trim: true },
  designation: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: [String], default: ['EMPLOYEE'] },
  lunchBreakMinutes: { type: Number, default: 0 },
  monthlyCasualLeaveLimit: { type: Number, default: 0 },
  faceIds: { type: [String], default: [] },
  faceEnrolledAt: { type: Date }
}, { timestamps: true });
// Employee IDs only need to be unique INSIDE one organization.
EmployeeProfileSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true });

// ----------------------------------------------------
// 2. CHRONOLOGICAL ATTENDANCE SHIFT LOG SCHEMA
// ----------------------------------------------------
const ShiftLogSchema = new Schema<IAttendanceShiftLog>({
  organizationId: { type: String, required: true, index: true },
  employeeIdReference: { type: String, required: true },
  employeeName: { type: String, required: true },
  date: { type: String, required: true },       
  dayOfWeek: { type: String, required: true },  
  loginTime: { type: String, default: '--:--' },
  logoutTime: { type: String, default: '--:--' },
  capturedPhotoInUri: { type: String, default: '' }, 
  capturedPhotoOutUri: { type: String, default: '' },
  locationInAddress: { type: String, default: '' },
  locationOutAddress: { type: String, default: '' },
  faceMatchInScore: { type: Number, default: null },
  faceMatchOutScore: { type: Number, default: null }
}, { timestamps: true });

// ----------------------------------------------------
// 3. MASTER ADMIN CREDENTIAL SCHEMA
// ----------------------------------------------------
const AdminCredentialSchema = new Schema<IAdminCredential>({
  organizationId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  employeeId: { type: String, required: true, uppercase: true, trim: true },
  designation: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  phone: { type: String, default: '' },
  role: { type: String, default: 'MASTER' }
}, { timestamps: true });
AdminCredentialSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true });

// ----------------------------------------------------
// 4. OFFICE LOCATION SCHEMA
// ----------------------------------------------------
const OfficeLocationSchema = new Schema<IOfficeLocation>({
  organizationId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  radiusInMeters: { type: Number, required: true, default: 50 }
}, { timestamps: true });

// ----------------------------------------------------
// 5. HOLIDAY SCHEMA
// ----------------------------------------------------
const HolidaySchema = new Schema<IHoliday>({
  organizationId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  date: { type: String, required: true },
  description: { type: String, default: '' }
}, { timestamps: true });
// The same holiday date may exist in different organizations.
HolidaySchema.index({ organizationId: 1, date: 1 }, { unique: true });

// ----------------------------------------------------
// MODEL EXPORTS
// ----------------------------------------------------
export const Organization = (mongoose.models.Organization ||
  mongoose.model<IOrganization>('Organization', OrganizationSchema)) as Model<IOrganization>;

export const RegisteredEmployee = (mongoose.models.RegisteredEmployee || 
  mongoose.model<IEmployeeProfile>('RegisteredEmployee', EmployeeProfileSchema)) as Model<IEmployeeProfile>;

export const AttendanceShiftLog = (mongoose.models.AttendanceShiftLog || 
  mongoose.model<IAttendanceShiftLog>('AttendanceShiftLog', ShiftLogSchema)) as Model<IAttendanceShiftLog>;

export const AdminCredential = (mongoose.models.AdminCredential || 
  mongoose.model<IAdminCredential>('AdminCredential', AdminCredentialSchema)) as Model<IAdminCredential>;

export const OfficeLocation = (mongoose.models.OfficeLocation || 
  mongoose.model<IOfficeLocation>('OfficeLocation', OfficeLocationSchema)) as Model<IOfficeLocation>;

export const Holiday = (mongoose.models.Holiday || 
  mongoose.model<IHoliday>('Holiday', HolidaySchema)) as Model<IHoliday>;