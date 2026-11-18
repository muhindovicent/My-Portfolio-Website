import { Request, RequestHandler, Response } from 'express.ts';
import rateLimit from 'express-rate-limit.ts';
import { AppError } from './error.ts.ts';
import { logSecurityEvent } from '../lib/securityEvent.ts.ts';
import { db } from '../config/db.ts.ts';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const ACCOUNT_LOCKOUT_MS = 60 * 60 * 1000; // 1 hour

export const loginRateLimiter = rateLimit({
  windowMs: LOCKOUT_WINDOW_MS,
  max: MAX_FAILED_ATTEMPTS,
  message: 'Too many login attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.body?.email ?? req.ip ?? 'unknown';
  },
});

export const mfaRateLimiter = rateLimit({
  windowMs: LOCKOUT_WINDOW_MS,
  max: MAX_FAILED_ATTEMPTS,
  message: 'Too many MFA verification attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.ip ?? 'unknown';
  },
});

export const recoveryRateLimiter = rateLimit({
  windowMs: LOCKOUT_WINDOW_MS,
  max: MAX_FAILED_ATTEMPTS,
  message: 'Too many recovery attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.body?.email ?? req.ip ?? 'unknown';
  },
});

export const bruteForceProtection: RequestHandler = async (req, res, next) => {
  const email = (req.body as any)?.email as string | undefined;
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';

  if (!email) {
    next();
    return;
  }

  const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MS);

  const recentFailures = await db.loginAttempt.count({
    where: {
      email,
      ipAddress: ip,
      success: false,
      createdAt: { gte: windowStart },
    },
  });

  const admin = await db.administrator.findUnique({ where: { email } });

  if (recentFailures >= MAX_FAILED_ATTEMPTS && admin) {
    await db.administrator.update({
      where: { id: admin.id },
      data: {
        failedLoginCount: recentFailures,
        lockedUntil: new Date(Date.now() + ACCOUNT_LOCKOUT_MS),
      },
    });

    void logSecurityEvent({
      adminId: admin.id,
      action: 'ACCOUNT_LOCKED',
      entity: 'Administrator',
      entityId: admin.id,
      ipAddress: ip,
      userAgent: req.get('user-agent') ?? undefined,
      metadata: { failures: recentFailures, lockoutMinutes: ACCOUNT_LOCKOUT_MS / 60000 } as any,
    }).catch(() => {});

    next(new AppError('Account temporarily locked due to failed login attempts', 429));
    return;
  }

  next();
};

export interface LoginAttemptRecord {
  email: string;
  ipAddress: string;
  userAgent?: string | null;
  success: boolean;
  adminId?: string | null;
}

export async function recordLoginAttempt(record: LoginAttemptRecord): Promise<void> {
  await db.loginAttempt.create({
    data: {
      email: record.email,
      ipAddress: record.ipAddress,
      userAgent: record.userAgent ?? null,
      success: record.success,
    },
  });

  if (record.success && record.adminId) {
    await db.administrator.update({
      where: { id: record.adminId },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });
  }
}

function getClientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

function getUserAgent(req: Request): string | undefined {
  return req.get('user-agent') ?? undefined;
}

export { getClientIp, getUserAgent };


