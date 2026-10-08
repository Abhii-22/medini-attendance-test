import { Router } from 'express';
import { punchClock, updateProfile, getLivenessChallenge } from '../controllers/attendanceController.js';

const router = Router();

router.post('/liveness-challenge', getLivenessChallenge);
router.post('/punch-clock', punchClock);
router.patch('/update-profile', updateProfile);

export default router;