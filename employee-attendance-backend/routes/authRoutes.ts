import { Router } from 'express';
import { login, validateSession, registerOrganization } from '../controllers/authController.js';

const router = Router();

router.post('/login', login);
router.post('/validate-session', validateSession);
router.post('/register-organization', registerOrganization);

export default router;