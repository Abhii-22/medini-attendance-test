import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
// @ts-ignore
import { v2 as cloudinary } from 'cloudinary';

import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import { requireOrg } from './middleware/requireOrg.js';
import {
  Organization,
  RegisteredEmployee,
  AdminCredential,
  AttendanceShiftLog,
  OfficeLocation,
  Holiday,
} from './models/AttendanceSchemas.js';

dotenv.config();

// Fail fast if required secrets are missing
const requiredEnv = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
const missingEnv = requiredEnv.filter((k) => !process.env[k]);
if (missingEnv.length > 0) {
  console.error('Missing required environment variables:', missingEnv.join(', '));
  process.exit(1);
}

const app = express();
app.use(cors());

// ⚙️ ENFORCED PAYLOAD LIMITS
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 🛡️ CRITICAL NODE.JS LOG PATCH
process.on('unhandledRejection', (reason: any) => {
  console.error('\n🛡️ Intercepted Background Rejection:', reason);
});

// 🌐 CLOUDINARY CONFIGURATION BRIDGE
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME as string, // validated at startup above
  api_key: process.env.CLOUDINARY_API_KEY as string,
  api_secret: process.env.CLOUDINARY_API_SECRET as string,
});

// 🛣️ MOUNT ROUTES
app.use('/api/auth', authRoutes);
// Every route below requires a valid organization token, so each request only ever
// touches the data of the organization it belongs to.
app.use('/api/admin', requireOrg, adminRoutes);
app.use('/api/attendance', requireOrg, attendanceRoutes);
app.use('/api/employee', requireOrg, attendanceRoutes);

// ----------------------------------------------------
// ENGINE INITIALIZATION BLOCK
// ----------------------------------------------------
const ATLAST_MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/employeeAttendanceSystem';

/*
 * ONE-TIME MIGRATION (safe to run on every boot)
 * Data created before multi-organization support has no organizationId.
 * It is assigned to a single "legacy" organization so nothing is lost,
 * and that organization keeps using the original face collection.
 */
async function migrateLegacyData() {
  const models: any[] = [RegisteredEmployee, AdminCredential, AttendanceShiftLog, OfficeLocation, Holiday];
  const orphanFilter = { organizationId: { $exists: false } };

  const hasOrphans = (await Promise.all(models.map((m) => m.exists(orphanFilter)))).some(Boolean);
  if (!hasOrphans) return;

  let org = await Organization.findOne({ isLegacy: true });
  if (!org) {
    const firstAdmin: any = await AdminCredential.findOne(orphanFilter);
    org = await Organization.create({
      name: process.env.LEGACY_ORG_NAME || 'My Organization',
      adminName: firstAdmin?.name || 'Admin',
      email: firstAdmin?.email || 'admin@example.com',
      phone: '',
      faceCollectionId: process.env.REKOGNITION_COLLECTION_ID || 'employee-faces',
      isLegacy: true,
    });
    console.log('Created legacy organization for existing data:', org.name);
  }

  const orgId = String(org._id);
  await Promise.all(models.map((m) => m.updateMany(orphanFilter, { $set: { organizationId: orgId } })));
  console.log('Existing data assigned to organization:', org.name);
}

async function bootServerEngine() {
  console.log('Connecting to cloud cluster... ⏳');
  
  await mongoose.connect(ATLAST_MONGO_URI)
    .then(async () => {
      console.log('Attendance System Cloud Database Connected 🌐📜');
      await migrateLegacyData();
      // Replaces the old global-unique indexes (employeeId, holiday date) with per-organization ones.
      await Promise.all([RegisteredEmployee, AdminCredential, Holiday, Organization].map((m: any) => m.syncIndexes()));
      app.listen(5000, () => console.log('Attendance Server Live On Port 5000 🚀'));
    })
    .catch((err) => {
      console.error('\n❌ CRITICAL DATABASE INITIALIZATION ERROR DETECTED:', err);
    });
}

bootServerEngine();