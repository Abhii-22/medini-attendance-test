import type { Request, Response } from 'express';
import crypto from 'crypto';
import { RegisteredEmployee, AdminCredential } from '../models/AttendanceSchemas.js';

/*
 * SESSION KEY
 * An HMAC of the user's CURRENT password. It is sent to the app at login.
 * If the password changes (admin page or directly in MongoDB), the key
 * computed from the database no longer matches the one saved on the phone,
 * and that is how we know to log the user out.
 * The plain password is never stored on the phone.
 */
const sessionKeyFor = (password: string = '') =>
  crypto
    .createHmac('sha256', process.env.SESSION_SECRET || 'attendance-session-secret')
    .update(String(password))
    .digest('hex');

/** Returns the user object without the password field. */
const safeUser = (doc: any) => {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj.password;
  return obj;
};

export const login = async (req: Request, res: Response): Promise<any> => {
  const { email, password, loginMode } = req.body;

  try {
    const searchEmail = String(email).toLowerCase();

    if (loginMode === 'ADMIN_PANEL' || loginMode === 'ADMIN') {
      const adminProfile = await AdminCredential.findOne({ email: searchEmail });

      if (!adminProfile || adminProfile.password !== password) {
        return res.status(401).json({ success: false, message: 'No matching admin profile or incorrect password.' });
      }

      if (adminProfile.role === 'MASTER') {
        return res.status(200).json({
          success: true,
          isAdmin: true,
          user: safeUser(adminProfile),
          sessionKey: sessionKeyFor(adminProfile.password),
        });
      }
      return res.status(403).json({ success: false, message: 'This account lacks Master Admin privileges.' });
    }

    const userProfile = await RegisteredEmployee.findOne({ email: searchEmail });

    if (!userProfile || userProfile.password !== password) {
      return res.status(401).json({ success: false, message: 'No matching profile or incorrect password.' });
    }

    const roleArray = Array.isArray(userProfile.role)
      ? userProfile.role
      : typeof userProfile.role === 'string'
        ? [userProfile.role]
        : ['EMPLOYEE'];

    if (loginMode === 'ADMIN_VIEW') {
      if (roleArray.includes('ADMIN_VIEW')) {
        return res.status(200).json({
          success: true,
          isAdmin: true,
          user: safeUser(userProfile),
          sessionKey: sessionKeyFor(userProfile.password),
        });
      }
      return res.status(403).json({ success: false, message: 'This account lacks supervisor monitoring access privileges.' });
    }

    if (roleArray.includes('EMPLOYEE')) {
      return res.status(200).json({
        success: true,
        isAdmin: false,
        user: safeUser(userProfile),
        sessionKey: sessionKeyFor(userProfile.password),
      });
    }

    return res.status(403).json({ success: false, message: 'Account context validation error.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err });
  }
};

/*
 * VALIDATE SESSION
 * Called by the app on startup and whenever it returns to the foreground.
 * valid:false  -> password changed or account deleted -> app logs out.
 * valid:true   -> nothing changes.
 * On a server error we answer valid:true so nobody is logged out by mistake.
 */
export const validateSession = async (req: Request, res: Response): Promise<any> => {
  const { email, loginMode, sessionKey } = req.body;

  try {
    if (!email || !sessionKey) {
      return res.status(200).json({ valid: false });
    }

    const searchEmail = String(email).toLowerCase().trim();

    const profile =
      loginMode === 'ADMIN_PANEL'
        ? await AdminCredential.findOne({ email: searchEmail })
        : await RegisteredEmployee.findOne({ email: searchEmail });

    if (!profile) {
      return res.status(200).json({ valid: false });
    }

    return res.status(200).json({ valid: sessionKeyFor(profile.password) === sessionKey });
  } catch (err) {
    return res.status(500).json({ valid: true });
  }
};