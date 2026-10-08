import { Router } from 'express';
import { login, validateSession } from '../controllers/authController.js';

const router = Router();

router.post('/login', login);
router.post('/validate-session', validateSession);

export default router;