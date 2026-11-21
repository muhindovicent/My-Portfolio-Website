import { RequestHandler } from 'express';
import { AppError } from './error';
import { db } from '../config/db';

export interface AuthenticatedRequest extends Request {
  admin?: { id: string; email: string; role: string; isActive: boolean };
  session?: {
    adminId?: string;
    mfaVerified?: boolean;
    csrfToken?: string;
    regenerate: (callback?: (err?: any) => void) => void;
    destroy: (callback?: (err?: any) => void) => void;
    [key: string]: any;
  };
  sessionID?: string;
}

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const authenticatedReq = req as unknown as AuthenticatedRequest;
  const adminId = authenticatedReq.session?.adminId;

  if (!adminId) {
    next(new AppError('Authentication required', 401));
    return;
  }

  const admin = await db.administrator.findUnique({
    where: { id: adminId },
    select: { id: true, email: true, role: true, isActive: true, sessionVersion:true },
  });

  if (!admin) {
    next(new AppError('Administrator account does not exist', 401));
    return;
  }

  if (!admin.isActive) {
    next(new AppError('Administrator account is inactive', 403));
    return;
  }

  if (admin.sessionVersion !== req.session.version || !req.session.mfaVerified) {
    next(new AppError('Verified owner session required', 403)); return;
  }
  authenticatedReq.admin = {id:admin.id,email:admin.email,role:admin.role,isActive:admin.isActive};
  next();
};

export function requireRole(...allowedRoles: string[]): RequestHandler {
  return (req, res, next) => {
    const authenticatedReq = req as unknown as AuthenticatedRequest;
    if (!authenticatedReq.admin) {
      next(new AppError('Authentication required', 401));
      return;
    }
    if (!allowedRoles.includes(authenticatedReq.admin.role)) {
      next(new AppError('Insufficient permissions', 403));
      return;
    }
    next();
  };
}

export const requireMfa: RequestHandler = (req, res, next) => {
  const authenticatedReq = req as unknown as AuthenticatedRequest;
  if (!authenticatedReq.admin) {
    next(new AppError('Authentication required', 401));
    return;
  }
  if (!authenticatedReq.session?.mfaVerified) {
    next(new AppError('Multi-factor authentication required', 403));
    return;
  }
  next();
};

// Verifies the same conditions as requireAdmin but redirects browser page
// requests to the Studio login screen instead of returning a JSON error.
export const requireStudioPage: RequestHandler = async (req, res, next) => {
  const authenticatedReq = req as unknown as AuthenticatedRequest;
  const adminId = authenticatedReq.session?.adminId;

  if (!adminId) {
    res.redirect('/admin/login');
    return;
  }

  const admin = await db.administrator.findUnique({
    where: { id: adminId },
    select: { id: true, isActive: true, sessionVersion: true },
  });

  if (!admin || !admin.isActive || admin.sessionVersion !== req.session.version || !req.session.mfaVerified) {
    res.redirect('/admin/login');
    return;
  }

  next();
};
