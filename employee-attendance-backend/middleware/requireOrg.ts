import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const SECRET = () => process.env.SESSION_SECRET || 'attendance-session-secret';

const sign = (orgId: string) =>
  crypto.createHmac('sha256', SECRET()).update(`org:${orgId}`).digest('hex');

export const signOrgToken = (orgId: string): string => `${orgId}.${sign(orgId)}`;

export const verifyOrgToken = (token: string): string | null => {
  const idx = token.lastIndexOf('.');
  if (idx <= 0) return null;
  const orgId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = sign(orgId);
  if (sig.length !== expected.length) return null;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? orgId : null;
};

export const getOrgId = (req: Request): string => (req as any).orgId as string;

export const requireOrg = (req: Request, res: Response, next: NextFunction): any => {
  const raw = String(req.headers['x-org-token'] || req.query.orgToken || '');
  const orgId = raw ? verifyOrgToken(raw) : null;

  if (!orgId) {
    return res.status(401).json({
      success: false,
      code: 'ORG_TOKEN_INVALID',
      message: 'Organization session is missing or invalid. Please log in again.',
    });
  }
  (req as any).orgId = orgId;
  next();
};