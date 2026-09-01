import { Router } from 'express';
import {
  registerEmployee,
  getEmployees,
  updateEmployee,
  deleteEmployee,
  getAttendanceSheet,
  downloadAttendance,
  getOfficeLocations,
  addOfficeLocation,
  updateOfficeLocation,
  deleteOfficeLocation
} from '../controllers/adminController.js';

const router = Router();

router.post('/register-employee', registerEmployee);
router.get('/employees', getEmployees);
router.put('/update-employee', updateEmployee);
router.delete('/delete-employee/:id', deleteEmployee);
router.get('/attendance-sheet', getAttendanceSheet);
router.get('/download-attendance', downloadAttendance);

// 📍 Office Location Management Routes
router.get('/locations', getOfficeLocations);
router.post('/locations', addOfficeLocation);
router.put('/locations/:id', updateOfficeLocation); // 👈 Route for editing existing locations
router.delete('/locations/:id', deleteOfficeLocation);

export default router;