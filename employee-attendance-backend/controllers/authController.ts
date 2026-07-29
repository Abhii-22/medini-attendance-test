import type { Request, Response } from 'express';
import { RegisteredEmployee, AdminCredential } from '../models/AttendanceSchemas.js';

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
        return res.status(200).json({ success: true, isAdmin: true, user: adminProfile });
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
        return res.status(200).json({ success: true, isAdmin: true, user: userProfile });
      }
      return res.status(403).json({ success: false, message: 'This account lacks supervisor monitoring access privileges.' });
    }

    if (roleArray.includes('EMPLOYEE')) {
      return res.status(200).json({ success: true, isAdmin: false, user: userProfile });
    }
    
    return res.status(403).json({ success: false, message: 'Account context validation error.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err });
  }
};