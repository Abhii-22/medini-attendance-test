import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
// @ts-ignore
import { v2 as cloudinary } from 'cloudinary';

import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';

dotenv.config();
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
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dfd0kotgh',
  api_key: process.env.CLOUDINARY_API_KEY || '272929261371422',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'CSVbxl3UBIhBWkyTmKBqjputk-E', 
});

// 🛣️ MOUNT ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/employee', attendanceRoutes);

// ----------------------------------------------------
// ENGINE INITIALIZATION BLOCK
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
      console.error('\n❌ CRITICAL DATABASE INITIALIZATION ERROR DETECTED:', err);
    });
}

bootServerEngine();