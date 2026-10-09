import type { Request, Response } from 'express';
import crypto from 'crypto';
import { RegisteredEmployee, AdminCredential, Organization } from '../models/AttendanceSchemas.js';
import { signOrgToken } from '../middleware/requireOrg.js';

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

/** Returns the user object without the password field (+ the organization name for display). */
const safeUser = (doc: any, organizationName?: string) => {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj.password;
  if (organizationName) obj.organizationName = organizationName;
  return obj;
};

/** Builds the shared success payload: user + session key + signed organization token. */
const authPayload = async (doc: any, isAdmin: boolean) => {
  const orgId = String(doc.organizationId);
  const org = await Organization.findById(orgId);
  return {
    success: true,
    isAdmin,
    user: safeUser(doc, org?.name),
    sessionKey: sessionKeyFor(doc.password),
    orgToken: signOrgToken(orgId),
  };
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
        return res.status(200).json(await authPayload(adminProfile, true));
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
        return res.status(200).json(await authPayload(userProfile, true));
      }
      return res.status(403).json({ success: false, message: 'This account lacks supervisor monitoring access privileges.' });
    }

    if (roleArray.includes('EMPLOYEE')) {
      return res.status(200).json(await authPayload(userProfile, false));
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

/*
 * REGISTER ORGANIZATION  (POST /api/auth/register-organization)
 * Creates a brand-new, empty organization plus its Master Admin account.
 * That admin can then only see and manage this organization's data.
 */
export const registerOrganization = async (req: Request, res: Response): Promise<any> => {
  const { organizationName, adminName, email, phone, password, confirmPassword } = req.body;

  const orgName = String(organizationName ?? '').trim();
  const admName = String(adminName ?? '').trim();
  const mail = String(email ?? '').trim().toLowerCase();
  const phoneClean = String(phone ?? '').trim();
  const pass = String(password ?? '').trim();

  if (!orgName || !admName || !mail || !phoneClean || !pass) {
    return res.status(400).json({ success: false, message: 'Organization name, admin name, email, phone number and password are all required.' });
  }
  if (!/^\S+@\S+\.\S+$/.test(mail)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }
  if (!/^[+]?[0-9\s-]{7,15}$/.test(phoneClean)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid phone number.' });
  }
  if (pass.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
  }
  if (pass !== String(confirmPassword ?? '').trim()) {
    return res.status(400).json({ success: false, message: 'Password and confirm password do not match.' });
  }

  let createdOrgId: string | null = null;

  try {
    if (await AdminCredential.findOne({ email: mail }) || await Organization.findOne({ email: mail })) {
      return res.status(400).json({ success: false, message: 'This email is already registered. Please log in instead.' });
    }

    const org = new Organization({
      name: orgName,
      adminName: admName,
      email: mail,
      phone: phoneClean,
      faceCollectionId: 'pending',
    });
    // Every organization gets its own isolated face collection.
    const baseCollection = process.env.REKOGNITION_COLLECTION_ID || 'employee-faces';
    org.faceCollectionId = `${baseCollection}-${org._id}`;
    await org.save();
    createdOrgId = String(org._id);

    const admin = await AdminCredential.create({
      organizationId: createdOrgId,
      name: admName,
      employeeId: 'ADMIN-001',
      designation: 'Organization Admin',
      email: mail,
      phone: phoneClean,
      password: pass,
      role: 'MASTER',
    });

    return res.status(201).json({ ...(await authPayload(admin, true)), message: 'Organization registered successfully.' });
  } catch (err: any) {
    // Never leave an organization without an admin behind.
    if (createdOrgId) await Organization.findByIdAndDelete(createdOrgId).catch(() => undefined);
    return res.status(500).json({ success: false, message: err?.message || 'Could not register the organization.' });
  }
};