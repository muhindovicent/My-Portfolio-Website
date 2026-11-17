import { Request, Router } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import { requireAdmin, requireMfa, requireRole, AuthenticatedRequest } from '../../middleware/auth';
import { bruteForceProtection, loginRateLimiter, recordLoginAttempt } from '../../middleware/rateLimit';
import { csrfMiddleware, generateCsrfToken, getCsrfToken, setCsrfToken } from '../../lib/csrf';
import { logSecurityEvent } from '../../lib/securityEvent';
import {
  generateMfaSecret,
  generateMfaQrCode,
  verifyMfaToken,
  generateBackupCodes,
} from '../../lib/mfa';
import { hashPassword, comparePassword } from '../../lib/password';
import { db } from '../../config/db';

const router = Router();

const adminLoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

const mfaVerifySchema = z.object({
  token: z.string().length(6, 'MFA token must be 6 digits'),
});

const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const provisionOwnerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().trim().min(1).max(120).optional(),
});

function getClientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

function getUserAgent(req: Request): string | undefined {
  return req.get('user-agent') ?? undefined;
}

// ---------------------------------------------------------------------------
// Provision the single authorized owner (one-time, only if no admins exist)
// ---------------------------------------------------------------------------
router.post(
  '/setup',
  csrfMiddleware,
  validate({ body: provisionOwnerSchema }),
  asyncHandler(async (req, res) => {
    const count = await db.administrator.count();
    if (count > 0) {
      throw new AppError('Administrator already initialized', 403);
    }

    const { email, password, name } = req.body as { email: string; password: string; name?: string };
    const passwordHash = await hashPassword(password);

    const admin = await db.administrator.create({
      data: { email, passwordHash, name, role: 'ADMIN', isActive: true },
      select: { id: true, email: true, name: true, role: true },
    });

    await logSecurityEvent({
      adminId: admin.id,
      action: 'PROVISION_OWNER',
      entity: 'Administrator',
      entityId: admin.id,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata: { email },
    });

    res.status(201).json({ ok: true, admin });
  })
);

// ---------------------------------------------------------------------------
// CSRF token endpoint (public, no auth required)
// ---------------------------------------------------------------------------
router.get(
  '/csrf-token',
  asyncHandler(async (req, res) => {
    const session = req.session as any;
    let token = session?.csrfToken;
    if (!token) {
      token = generateCsrfToken();
      session.csrfToken = token;
    }
    res.json({ ok: true, csrfToken: token });
  })
);

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
router.post(
  '/login',
  loginRateLimiter,
  bruteForceProtection,
  csrfMiddleware,
  validate({ body: adminLoginSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    const admin = await db.administrator.findUnique({
      where: { email },
      include: { mfaSecret: true },
    });

    if (!admin || !(await comparePassword(password, admin.passwordHash))) {
      await recordLoginAttempt({ email, ipAddress: ip, userAgent, success: false });
      await logSecurityEvent({
        adminId: null,
        action: 'LOGIN_FAILED',
        entity: 'Administrator',
        entityId: email,
        ipAddress: ip,
        userAgent,
        metadata: { reason: 'invalid_credentials' },
      });
      throw new AppError('Invalid email or password', 401);
    }

    if (!admin.isActive) {
      await recordLoginAttempt({ email, ipAddress: ip, userAgent, success: false });
      await logSecurityEvent({
        adminId: admin.id,
        action: 'LOGIN_FAILED',
        entity: 'Administrator',
        entityId: admin.id,
        ipAddress: ip,
        userAgent,
        metadata: { reason: 'account_inactive' },
      });
      throw new AppError('Administrator account is inactive', 403);
    }

    await recordLoginAttempt({ email, ipAddress: ip, userAgent, success: true });

    // Regenerate session to prevent session fixation
    await new Promise<void>((resolve, reject) => {
      (req.session as any).regenerate((err?: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const session = req.session as any;
    session.adminId = admin.id;
    session.mfaVerified = false;
    session.csrfToken = generateCsrfToken();
    session.save = () => {};

    await logSecurityEvent({
      adminId: admin.id,
      action: 'LOGIN',
      entity: 'Administrator',
      entityId: admin.id,
      ipAddress: ip,
      userAgent,
      metadata: { mfaRequired: Boolean(admin.mfaSecret?.enabled) },
    });

    // If MFA is enabled, require MFA verification before granting full access
    if (admin.mfaSecret?.enabled) {
      res.status(202).json({
        ok: true,
        mfaRequired: true,
        message: 'MFA verification required',
        csrfToken: session.csrfToken,
      });
      return;
    }

    session.mfaVerified = true;
    await db.administrator.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    res.json({
      ok: true,
      mfaRequired: false,
      admin: { id: admin.id, email: admin.email, role: admin.role },
      csrfToken: session.csrfToken,
    });
  })
);

// ---------------------------------------------------------------------------
// MFA verification during login
// ---------------------------------------------------------------------------
router.post(
  '/login/mfa',
  csrfMiddleware,
  validate({ body: mfaVerifySchema }),
  asyncHandler(async (req, res) => {
    const session = req.session as any;
    const adminId = session?.adminId;
    const token = req.body.token;

    if (!adminId) {
      throw new AppError('Authentication session not found', 401);
    }
    if (session?.mfaVerified) {
      throw new AppError('MFA already verified', 400);
    }

    const admin = await db.administrator.findUnique({
      where: { id: adminId },
      include: { mfaSecret: true },
    });
    if (!admin || !admin.isActive) {
      throw new AppError('Administrator not found', 404);
    }
    if (!admin.mfaSecret?.enabled) {
      throw new AppError('MFA is not enabled for this account', 400);
    }

    const valid = verifyMfaToken(admin.mfaSecret.secret, token);
    if (!valid) {
      await logSecurityEvent({
        adminId: admin.id,
        action: 'MFA_VERIFY',
        entity: 'Administrator',
        entityId: admin.id,
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
        metadata: { result: 'invalid_token' },
      });
      throw new AppError('Invalid MFA token', 401);
    }

    session.mfaVerified = true;
    await db.administrator.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    await logSecurityEvent({
      adminId: admin.id,
      action: 'MFA_VERIFY',
      entity: 'Administrator',
      entityId: admin.id,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata: { result: 'success' },
    });

    res.json({
      ok: true,
      admin: { id: admin.id, email: admin.email, role: admin.role },
      csrfToken: session.csrfToken,
    });
  })
);

// ---------------------------------------------------------------------------
// MFA setup (generate secret + QR code)
// ---------------------------------------------------------------------------
router.post(
  '/mfa/setup',
  requireAdmin,
  csrfMiddleware,
  asyncHandler(async (req, res) => {
    const authenticatedReq = req as unknown as AuthenticatedRequest;
    const admin = await db.administrator.findUnique({
      where: { id: authenticatedReq.admin!.id },
      include: { mfaSecret: true },
    });
    if (!admin) throw new AppError('Administrator not found', 404);

    let mfaSecret = admin.mfaSecret;
    if (!mfaSecret) {
      const secret = generateMfaSecret();
      mfaSecret = await db.mfaSecret.create({
        data: { adminId: admin.id, secret, enabled: false },
      });
    }

    const qrCode = await generateMfaQrCode(mfaSecret.secret, admin.email);
    const backupCodes = generateBackupCodes(8);
    const backupCodeHashes = await Promise.all(
      backupCodes.map((code) => hashPassword(code))
    );

    await db.backupCode.createMany({
      data: backupCodeHashes.map((hash) => ({
        adminId: admin.id,
        codeHash: hash,
      })),
    });

    await logSecurityEvent({
      adminId: admin.id,
      action: 'MFA_SETUP',
      entity: 'Administrator',
      entityId: admin.id,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata: { backupCodesCount: backupCodes.length },
    });

    res.json({
      ok: true,
      secret: mfaSecret.secret,
      qrCode,
      backupCodes, // only returned once; store securely
      enabled: mfaSecret.enabled,
    });
  })
);

// ---------------------------------------------------------------------------
// Verify and enable MFA
// ---------------------------------------------------------------------------
router.post(
  '/mfa/verify',
  requireAdmin,
  csrfMiddleware,
  validate({ body: mfaVerifySchema }),
  asyncHandler(async (req, res) => {
    const authenticatedReq = req as unknown as AuthenticatedRequest;
    const token = req.body.token;

    const admin = await db.administrator.findUnique({
      where: { id: authenticatedReq.admin!.id },
      include: { mfaSecret: true },
    });
    if (!admin || !admin.mfaSecret) {
      throw new AppError('MFA not set up', 400);
    }

    const valid = verifyMfaToken(admin.mfaSecret.secret, token);
    if (!valid) {
      throw new AppError('Invalid MFA token', 401);
    }

    await db.mfaSecret.update({
      where: { id: admin.mfaSecret.id },
      data: { enabled: true },
    });

    await logSecurityEvent({
      adminId: admin.id,
      action: 'MFA_VERIFY',
      entity: 'Administrator',
      entityId: admin.id,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata: { result: 'enabled' },
    });

    res.json({ ok: true, mfaEnabled: true });
  })
);

// ---------------------------------------------------------------------------
// Disable MFA
// ---------------------------------------------------------------------------
router.post(
  '/mfa/disable',
  requireAdmin,
  requireMfa,
  csrfMiddleware,
  asyncHandler(async (req, res) => {
    const authenticatedReq = req as unknown as AuthenticatedRequest;

    await db.mfaSecret.deleteMany({
      where: { adminId: authenticatedReq.admin!.id },
    });
    await db.backupCode.deleteMany({
      where: { adminId: authenticatedReq.admin!.id },
    });

    await logSecurityEvent({
      adminId: authenticatedReq.admin!.id,
      action: 'MFA_DISABLE',
      entity: 'Administrator',
      entityId: authenticatedReq.admin!.id,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata: {},
    });

    res.json({ ok: true, mfaEnabled: false });
  })
);

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------
router.post(
  '/logout',
  requireAdmin,
  csrfMiddleware,
  asyncHandler(async (req, res) => {
    const authenticatedReq = req as unknown as AuthenticatedRequest;
    const adminId = authenticatedReq.admin!.id;
    const sid = req.sessionID;

    // Revoke the session from the database
    if (sid) {
      await db.session.delete({ where: { sid } }).catch(() => {});
    }

    await new Promise<void>((resolve, reject) => {
      (req.session as any).destroy((err?: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.clearCookie('connect.sid', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    await logSecurityEvent({
      adminId,
      action: 'LOGOUT',
      entity: 'Administrator',
      entityId: adminId,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata: { sessionId: sid },
    });

    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------------------
// Password recovery request
// ---------------------------------------------------------------------------
router.post(
  '/recovery',
  loginRateLimiter,
  bruteForceProtection,
  csrfMiddleware,
  validate({ body: z.object({ email: z.string().email() }) }),
  asyncHandler(async (req, res) => {
    const { email } = req.body as { email: string };
    const admin = await db.administrator.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!admin) {
      res.json({ ok: true, message: 'If the account exists, a recovery token has been generated.' });
      return;
    }

    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    const passwordHash = await hashPassword(token);

    await db.passwordResetToken.create({
      data: {
        adminId: admin.id,
        tokenHash: passwordHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    await logSecurityEvent({
      adminId: admin.id,
      action: 'RECOVERY_REQUEST',
      entity: 'Administrator',
      entityId: admin.id,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata: {},
    });

    // In production, email this token. For this implementation, return it
    // so the admin can complete recovery via /admin/recovery/verify.
    res.json({
      ok: true,
      recoveryToken: token,
      message: 'Recovery token generated. Use it at /admin/recovery/verify to reset your password.',
    });
  })
);

// ---------------------------------------------------------------------------
// Verify recovery token and reset password
// ---------------------------------------------------------------------------
router.post(
  '/recovery/verify',
  csrfMiddleware,
  validate({ body: passwordResetSchema }),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body as { token: string; password: string };

    const resetToken = await db.passwordResetToken.findFirst({
      where: {
        used: false,
        expiresAt: { gt: new Date() },
      },
      include: { admin: true },
    });

    if (!resetToken) {
      throw new AppError('Invalid or expired recovery token', 400);
    }

    const valid = await comparePassword(token, resetToken.tokenHash);
    if (!valid) {
      throw new AppError('Invalid or expired recovery token', 400);
    }

    const newHash = await hashPassword(password);

    await db.$transaction([
      db.administrator.update({
        where: { id: resetToken.adminId },
        data: { passwordHash: newHash },
      }),
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
    ]);

    await logSecurityEvent({
      adminId: resetToken.adminId,
      action: 'RECOVERY_COMPLETE',
      entity: 'Administrator',
      entityId: resetToken.adminId,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata: {},
    });

    res.json({ ok: true, message: 'Password reset successful.' });
  })
);

export default router;
