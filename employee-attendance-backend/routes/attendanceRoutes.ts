import { Router } from 'express';
import { punchClock, updateProfile } from '../controllers/attendanceController.js';

const router = Router();

router.post('/punch-clock', punchClock);
router.patch('/update-profile', updateProfile);

export default router;