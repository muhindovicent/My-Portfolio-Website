import { Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError } from './error';
import { logSecurityEvent } from '../lib/securityEvent';
import { db } from '../config/db';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const loginRateLimiter = rateLimit({
  windowMs: LOCKOUT_WINDOW_MS,
  max: MAX_FAILED_ATTEMPTS,
  message: 'Too many login attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.body?.email ?? req.ip ?? 'unknown';
  },
  skip: () => false,
});

export const bruteForceProtection: RequestHandler = async (req, res, next) => {
  const email = (req.body as any)?.email as string | undefined;
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';

  if (!email) {
    next();
    return;
  }

  const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MS);

  const [recentFailures, recentSuccesses] = await Promise.all([
    db.loginAttempt.count({
      where: {
        email,
        ipAddress: ip,
        success: false,
        createdAt: { gte: windowStart },
      },
    }),
    db.loginAttempt.count({
      where: {
        email,
        ipAddress: ip,
        success: true,
        createdAt: { gte: windowStart },
      },
    }),
  ]);

  if (recentFailures >= MAX_FAILED_ATTEMPTS && recentSuccesses === 0) {
    void logSecurityEvent({
      adminId: undefined,
      action: 'RATE_LIMIT_EXCEEDED',
      entity: 'LoginAttempt',
      entityId: email,
      ipAddress: ip,
      userAgent: req.get('user-agent') ?? undefined,
      metadata: { failures: recentFailures, windowMinutes: LOCKOUT_WINDOW_MS / 60000 } as any,
    }).catch(() => {});
    next(new AppError('Too many failed login attempts. Account temporarily locked.', 429));
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
}
