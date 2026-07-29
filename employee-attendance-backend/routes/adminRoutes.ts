import { Router } from 'express';
import {
  registerEmployee,
  getEmployees,
  updateEmployee,
  deleteEmployee,
  getAttendanceSheet,
  downloadAttendance
} from '../controllers/adminController.js';

const router = Router();

router.post('/register-employee', registerEmployee);
router.get('/employees', getEmployees);
router.put('/update-employee', updateEmployee);
router.delete('/delete-employee/:id', deleteEmployee);
router.get('/attendance-sheet', getAttendanceSheet);
router.get('/download-attendance', downloadAttendance);

export default router;