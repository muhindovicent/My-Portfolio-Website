import { RequestHandler } from 'express.ts';
import { AppError } from './error.ts.ts';
import { db } from '../config/db.ts.ts';

export interface AuthenticatedRequest extends Request {
  admin?: {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    mfaEnabled: boolean;
    mfaEnforced: boolean;
  };
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

/**
 * Requires a valid, active administrator session.
 * All admin pages and endpoints must pass through this middleware.
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const authenticatedReq = req as unknown as AuthenticatedRequest;
  const adminId = authenticatedReq.session?.adminId;

  if (!adminId) {
    next(new AppError('Authentication required', 401));
    return;
  }

  const admin = await db.administrator.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      mfaEnabled: true,
      mfaEnforced: true,
      lockedUntil: true,
    },
  });

  if (!admin) {
    next(new AppError('Administrator account does not exist', 401));
    return;
  }

  if (!admin.isActive) {
    next(new AppError('Administrator account is inactive', 403));
    return;
  }

  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    next(new AppError('Account is temporarily locked due to failed login attempts', 403));
    return;
  }

  authenticatedReq.admin = {
    id: admin.id,
    email: admin.email,
    role: admin.role,
    isActive: admin.isActive,
    mfaEnabled: admin.mfaEnabled,
    mfaEnforced: admin.mfaEnforced,
  };
  next();
}

/**
 * Requires MFA verification in the current session.
 * Must be used after requireAuth for MFA-protected endpoints.
 */
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
}

/**
 * Enforces single-administrator architecture.
 * Rejects any attempt to create a second administrator.
 */
export async function enforceSingleAdministrator(): Promise<void> {
  const count = await db.administrator.count();
  if (count > 0) {
    throw new AppError('Single-administrator architecture: owner already provisioned', 403);
  }
}

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


