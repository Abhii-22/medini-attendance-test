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
  deleteOfficeLocation,
  getHolidays,
  addHoliday,
  deleteHoliday,
  bulkAddHolidays
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
router.put('/locations/:id', updateOfficeLocation);
router.delete('/locations/:id', deleteOfficeLocation);

// 🎉 Holiday Management Routes
router.get('/holidays', getHolidays);
router.post('/holidays', addHoliday);
router.post('/holidays/bulk', bulkAddHolidays); // 🌟 Added Bulk Import Route
router.delete('/holidays/:id', deleteHoliday);

export default router;